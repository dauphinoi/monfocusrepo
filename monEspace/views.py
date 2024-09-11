from datetime import timezone
from django.core.files.storage import default_storage
import json
import os
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ChatMessage, ChatSession, Homework, HourDeclaration, Note, Attachment, TodoItem
from .serializers import HomeworkSerializer, NoteSerializer, AttachmentSerializer, TodoItemSerializer
from django.db.models import Q
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError, PermissionDenied
from .services import analyze_homework_with_claude, analyze_image_with_gpt4, send_email_to_teacher, update_note_embedding, semantic_search
import logging
from django.shortcuts import get_object_or_404, render
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from accounts.models import Visitor, Subject, Level, CoursType, VisitorSubjectCourse, Teacher
from django.http import JsonResponse
from transformers import pipeline
from pinecone import Pinecone
import boto3
from django.conf import settings
from botocore.exceptions import ClientError

#
from openai import OpenAI
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import ChatSession, ChatMessage, Note
from .services import semantic_search
from django.conf import settings
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)


from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv('openai_API_KEY')
hf_token = os.getenv('HF_TOKEN')
tinymceApiKey = os.getenv('tinymceApiKey')

class TodoItemViewSet(viewsets.ModelViewSet):
    serializer_class = TodoItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'delete']

    def get_queryset(self):
        user = self.request.user
        course_id = self.request.query_params.get('course')
        queryset = TodoItem.objects.all()
        
        if hasattr(user, 'teacher'):
            queryset = queryset.filter(course__teacher=user.teacher)
            if course_id:
                queryset = queryset.filter(course_id=course_id)
        elif hasattr(user, 'visitor'):
            queryset = queryset.filter(course__visitor=user.visitor)
            if course_id:
                queryset = queryset.filter(course_id=course_id)
        else:
            return TodoItem.objects.none()
        
        return queryset

    def create(self, request, *args, **kwargs):
        course_id = request.data.get('course')
        if not course_id:
            raise ValidationError({"course": "Un cours doit être spécifié."})

        try:
            course = VisitorSubjectCourse.objects.get(id=course_id)
        except VisitorSubjectCourse.DoesNotExist:
            raise ValidationError({"course": "Le cours spécifié n'existe pas."})

        user = request.user
        if not hasattr(user, 'teacher'):
            raise PermissionDenied("Seuls les enseignants peuvent créer des tâches.")
        if course.teacher != user.teacher:
            raise PermissionDenied("Vous n'êtes pas autorisé à ajouter des tâches à ce cours.")

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer, course)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer, course):
        serializer.save(created_by=self.request.user, course=course)

    def check_object_permissions(self, request, obj):
        super().check_object_permissions(request, obj)
        user = request.user
        if hasattr(user, 'teacher'):
            if obj.course.teacher != user.teacher:
                raise PermissionDenied("Vous n'êtes pas autorisé à modifier cette tâche.")
        elif hasattr(user, 'visitor'):
            if obj.course.visitor != user.visitor:
                raise PermissionDenied("Vous n'êtes pas autorisé à accéder à cette tâche.")
        else:
            raise PermissionDenied("Utilisateur non autorisé.")
        
    def destroy(self, request, *args, **kwargs):
        try:
            instance = self.get_object()
            self.perform_destroy(instance)
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            print(f"Error deleting todo item: {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_404_NOT_FOUND)

    def perform_destroy(self, instance):
        instance.delete()

    

@login_required
@require_POST
def add_course(request):
    try:
        visitor = request.user.visitor
        subject_id = request.POST.get('subject_id')
        course_types = request.POST.getlist('course_types')
        
        print(f"Attempting to add course: subject_id={subject_id}, course_types={course_types}")  # Log des données reçues
        print(f"All subjects in database: {list(Subject.objects.values_list('id', 'name'))}")
        
        try:
            subject = Subject.objects.get(id=subject_id)
        except Subject.DoesNotExist:
            print(f"Subject with id {subject_id} not found")  # Log si le sujet n'est pas trouvé
            return JsonResponse({'success': False, 'message': f"Subject with id {subject_id} not found"}, status=400)
        
        for course_type in course_types:
            try:
                course_type_obj = CoursType.objects.get(name=course_type)
                VisitorSubjectCourse.objects.create(
                    visitor=visitor,
                    subject=subject,
                    cours_type=course_type_obj
                )
                print(f"Course added: subject={subject.name}, type={course_type}")  # Log du cours ajouté
            except CoursType.DoesNotExist:
                print(f"CoursType '{course_type}' not found")  # Log si le type de cours n'est pas trouvé
                return JsonResponse({'success': False, 'message': f"CoursType '{course_type}' not found"}, status=400)
        
        return JsonResponse({'success': True, 'message': 'Cours ajouté avec succès'})
    except Exception as e:
        print(f"Error in add_course: {str(e)}")  # Log de l'erreur complète
        return JsonResponse({'success': False, 'message': str(e)}, status=400)


def get_subjects(request):
    subjects = Subject.objects.all().values('id', 'name')
    return JsonResponse(list(subjects), safe=False)

@login_required
def espacenote_view(request):
    user = request.user
    is_teacher = hasattr(user, 'teacher')
    is_visitor = hasattr(user, 'visitor')
    is_institutional = False

    if is_teacher:
        teacher = user.teacher
        is_institutional = bool(teacher.institution)
        courses = VisitorSubjectCourse.objects.filter(teacher=teacher)
        template = 'monEspace/teacher_espacenote.html'
    elif is_visitor:
        visitor = user.visitor
        is_institutional = bool(visitor.institution)
        courses = VisitorSubjectCourse.objects.filter(visitor=visitor).select_related(
            'teacher__user', 'subject', 'cours_type'
        )
        template = 'monEspace/espacenote.html'
    else:
        return render(request, 'monEspace/error.html', {'message': 'Profil utilisateur non trouvé'})

    courses_data = [
        {
            'id': course.id,
            'visitor_first_name': course.visitor.user.first_name,
            'visitor_last_name': course.visitor.user.last_name,
            'subject_name': course.subject.name,
            'course_type': course.cours_type.name
        }
        for course in courses
    ]

    context = {
        'is_teacher': is_teacher,
        'is_visitor': is_visitor,
        'is_institutional': is_institutional,
        'courses_data': json.dumps(courses_data),
        'courses': courses,
        'first_name': user.first_name,
        'tinymceApiKey': tinymceApiKey,
    }

    return render(request, template, context)

class NoteViewSet(viewsets.ModelViewSet):
    serializer_class = NoteSerializer
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Note.objects.none()

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'teacher'):
            return Note.objects.filter(course__teacher=user.teacher)
        else:
            return Note.objects.filter(user=user)

    def perform_create(self, serializer):
        course_id = self.request.data.get('course')
        course = None
        if course_id:
            user = self.request.user
            if hasattr(user, 'teacher'):
                course = get_object_or_404(VisitorSubjectCourse, id=course_id, teacher=user.teacher)
            else:
                course = get_object_or_404(VisitorSubjectCourse, id=course_id, visitor__user=user)
        note = serializer.save(user=self.request.user, course=course)
        update_note_embedding(note)

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except ValidationError as e:
            logger.error(f"Validation error: {e.detail}")
            raise

    def perform_update(self, serializer):
        # A REVOIR
        note = serializer.save()
        update_note_embedding(note)

    @action(detail=False, methods=['GET'])
    def search(self, request):
        query = request.query_params.get('q', '')
        if len(query) < 4:
            return Response([])
        results = semantic_search(query, request.user)
        serialized_results = []
        for result in results[:3]:
            note = Note.objects.get(id=result['id'])
            serializer = self.get_serializer(note)
            serialized_results.append({
                **result,
                'full_note': serializer.data
            })
        return Response(serialized_results)      

    @action(detail=True, methods=['GET'])
    def get_note(self, request, pk=None):
        try:
            user = request.user
            if hasattr(user, 'teacher'):
                note = Note.objects.get(pk=pk, course__teacher=user.teacher)
            else:
                note = Note.objects.get(pk=pk, user=user)
            serializer = self.get_serializer(note)
            return Response(serializer.data)
        except Note.DoesNotExist:
            return Response({'error': 'Note not found'}, status=404)

    @action(detail=False, methods=['GET'])
    def course_notes(self, request):
        course_id = request.query_params.get('course_id')
        if not course_id or course_id == 'null':
            return Response({'error': 'Valid course_id is required'}, status=400)
        
        try:
            course_id = int(course_id)
            user = request.user
            if hasattr(user, 'teacher'):
                course = get_object_or_404(VisitorSubjectCourse, id=course_id, teacher=user.teacher)
                notes = Note.objects.filter(course=course)
            else:
                course = get_object_or_404(VisitorSubjectCourse, id=course_id, visitor__user=user)
                notes = Note.objects.filter(user=user, course=course)
            serializer = self.get_serializer(notes, many=True)
            return Response(serializer.data)
        except ValueError:
            return Response({'error': 'Invalid course_id'}, status=400)   

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)    

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        
        try:
            # Supprimer les fichiers du bucket S3
            self.delete_s3_files(instance)
            
            # Supprimer l'embedding de Pinecone
            pc = Pinecone(api_key=settings.PINECONE_API_KEY)
            index = pc.Index(settings.PINECONE_INDEX_NAME)
            index.delete(ids=[str(instance.id)])
            
            # Supprimer la note de la base de données
            self.perform_destroy(instance)
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Erreur lors de la suppression de la note et de ses fichiers associés : {str(e)}")
            return Response({"detail": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def delete_s3_files(self, note):
        s3 = boto3.client('s3',
                          aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                          aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY)
        
        # Supprimer tous les attachements liés à cette note
        for attachment in note.attachments.all():
            if attachment.file:
                try:
                    s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=attachment.file.name)
                except ClientError as e:
                    logger.error(f"Erreur lors de la suppression du fichier S3 {attachment.file.name}: {str(e)}")

    def perform_destroy(self, instance):
        instance.delete() 
try:
    from django.core.files.storage import get_storage_class
except ImportError:
    try:
        from django.core.files.storage import storages
        get_storage_class = storages.get_storage_class
    except AttributeError:
        from django.core.files.storage import Storage
        def get_storage_class(import_path=None):
            return Storage
from django.core.files.base import ContentFile
from monFocus.storage_backends import MediaStorage
logger = logging.getLogger(__name__)

class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Attachment.objects.none()

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'teacher'):
            return Attachment.objects.filter(note__course__teacher=user.teacher)
        else:
            return Attachment.objects.filter(note__user=user)

    def perform_create(self, serializer):
        try:
            note_id = self.request.data.get('note_id')
            file_type = self.request.data.get('type')
            
            if note_id:
                user = self.request.user
                if hasattr(user, 'teacher'):
                    note = Note.objects.get(id=note_id, course__teacher=user.teacher)
                else:
                    note = Note.objects.get(id=note_id, user=user)
                if note.user != self.request.user and not hasattr(user, 'teacher'):
                    raise ValidationError("Vous ne pouvez ajouter des attachements qu'à vos propres notes.")

            file = self.request.FILES.get('file')
            if file:
                # Renommer le fichier
                new_filename = self.generate_new_filename(note, file)
                file.name = new_filename
                attachment = serializer.save(note_id=note_id, file_type=file_type, file=file)
                
                if file_type == 'image':
                    try:
                        with attachment.file.open('rb') as image_file:
                            image_content = analyze_image_with_gpt4(image_file)
                        attachment.content = image_content
                        attachment.save()
                    except Exception as e:
                        logger.error(f"Erreur lors de l'analyse de l'image: {str(e)}")
                
                update_note_embedding(attachment.note)
                print(f"Attachment created: {attachment.file_url}")
                
                return {
                    'id': attachment.id,
                    'file': attachment.file_url,
                    'file_type': attachment.file_type,
                    'created_at': attachment.created_at.isoformat(),
                    'note': attachment.note_id,
                    'content': attachment.content if file_type == 'image' else None
                }
            else:
                raise ValidationError("Aucun fichier n'a été fourni.")
        except Exception as e:
            logger.error(f"Erreur lors de la création de l'attachement: {str(e)}")
            raise ValidationError(str(e))

    def generate_new_filename(self, note, file):
        # Obtenir le nombre actuel d'attachements pour cette note
        attachment_count = Attachment.objects.filter(note=note).count() + 1
        
        # Obtenir l'extension du fichier original
        _, extension = os.path.splitext(file.name)
        
        # Générer le nouveau nom de fichier
        new_filename = f"{note.title.replace(' ', '_')}_P{attachment_count}{extension}"
        
        return new_filename
    def perform_update(self, serializer):
        attachment = serializer.save()
        
        if attachment.file_type == 'image' and 'file' in serializer.validated_data:
            try:
                with attachment.file.open('rb') as image_file:
                    image_content = analyze_image_with_gpt4(image_file)
                attachment.content = image_content
                attachment.save()
            except Exception as e:
                logger.error(f"Erreur lors de la mise à jour de l'analyse de l'image: {str(e)}")
        
        update_note_embedding(attachment.note)

    def perform_destroy(self, instance):
        note = instance.note
        instance.delete()
        update_note_embedding(note)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            attachment_data = self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(attachment_data, status=status.HTTP_201_CREATED, headers=headers)
        except ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)





# gestion des homewoks
class HomeworkViewSet(viewsets.ModelViewSet):
    serializer_class = HomeworkSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        now = timezone.now()

        try:
            if hasattr(user, 'visitor'):
                queryset = Homework.objects.filter(course__visitor=user.visitor)
            elif hasattr(user, 'teacher'):
                queryset = Homework.objects.filter(course__teacher=user.teacher)
            else:
                raise PermissionDenied("You don't have permission to access homeworks.")

            course_id = self.request.query_params.get('course_id')
            if course_id:
                queryset = queryset.filter(course_id=course_id)

            status = self.request.query_params.get('status')

            if status == 'upcoming':
                queryset = queryset.filter(due_date__gt=now)
            elif status == 'past':
                queryset = queryset.filter(due_date__lte=now)

            return queryset

        except PermissionDenied as e:
            logger.error(f"Permission denied: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_queryset: {str(e)}", exc_info=True)
            return Homework.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if hasattr(user, 'visitor'):
            serializer.save()
        else:
            logger.warning(f"User {user.username} attempted to create homework but is not a student")
            raise PermissionDenied("Only students can create homeworks.")

    @action(detail=True, methods=['POST'])
    def analyze_attachments(self, request, pk=None):
        homework = self.get_object()
         # Marquer le devoir comme analysé
        homework.is_corrected = True
        homework.save()
        files = request.FILES.getlist('attachments')
        
        if homework.due_date > timezone.now():
            return Response({"error": "You can only analyze attachments after the due date"}, status=400)

        analysis_results = []
        for file in files:
            if file.content_type.startswith('image/'):
                # Analyse de l'image
                analysis_result = analyze_homework_with_claude(file)
                analysis_results.append(analysis_result)

                # Envoi de l'email à l'enseignant
                send_email_to_teacher(homework, file.name, analysis_result)

        return Response({"message": "Attachments analyzed successfully", "results": analysis_results}, status=200)

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import Homework, HomeworkFeedback
from .serializers import HomeworkFeedbackSerializer

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def analyze_homework_and_create_feedback(request, homework_id):
    try:
        homework = Homework.objects.get(id=homework_id)
    except Homework.DoesNotExist:
        return Response({"error": "Homework not found"}, status=status.HTTP_404_NOT_FOUND)

    # Vérifiez si l'utilisateur a le droit de corriger ce devoir
    if not request.user.has_perm('can_correct_homework', homework):
        return Response({"error": "Permission denied"}, status=status.HTTP_403_FORBIDDEN)

    # Récupérez le fichier image du devoir corrigé
    corrected_homework_file = request.FILES.get('corrected_homework')
    if not corrected_homework_file:
        return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

    # Ici, vous intégreriez votre logique d'analyse d'image
    # Par exemple :
    # analyzed_content = analyze_image(corrected_homework_file)
    # grade = calculate_grade(analyzed_content)

    # Pour cet exemple, nous utiliserons des valeurs factices
    analyzed_content = "Bon travail sur les exercices 1 et 2. L'exercice 3 nécessite plus de travail."
    grade = 15.5

    # Créez ou mettez à jour le feedback
    feedback, created = HomeworkFeedback.objects.update_or_create(
        homework=homework,
        defaults={
            'content': analyzed_content,
            'grade': grade,
            'created_by': request.user
        }
    )

    # Marquez le devoir comme corrigé
    homework.is_corrected = True
    homework.save()

    serializer = HomeworkFeedbackSerializer(feedback)
    return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)