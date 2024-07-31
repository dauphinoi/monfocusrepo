from datetime import timezone
import json
import os
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import ChatMessage, ChatSession, HourDeclaration, Note, Attachment, TodoItem
from .serializers import NoteSerializer, AttachmentSerializer, TodoItemSerializer
from django.db.models import Q
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import ValidationError, PermissionDenied
from .services import analyze_image_with_gpt4, update_note_embedding, semantic_search
import logging
from django.shortcuts import get_object_or_404, render
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from accounts.models import Visitor, Subject, Level, CoursType, VisitorSubjectCourse, Teacher
from django.http import JsonResponse
from transformers import pipeline

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
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        instance.delete() 

class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    permission_classes = [IsAuthenticated]
    queryset = Attachment.objects.none()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context.update({"request": self.request})
        return context

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
                    raise ValidationError({"error": "Vous ne pouvez ajouter des attachements qu'à vos propres notes."})

            # Renommage du fichier
            file = self.request.FILES.get('file')
            if file and file_type == 'image':
                new_name = f'page_{self._get_next_page_number(note)}'
                file.name = new_name

            attachment = serializer.save(note_id=note_id, file_type=file_type)
            
            # Analyse de l'image si c'est une image
            if file_type == 'image':
                image_content = analyze_image_with_gpt4(attachment.file.path)
                attachment.content = image_content
                attachment.save()
            
            update_note_embedding(attachment.note)
            
            # Renvoyer les données de l'attachement
            return {
                'id': attachment.id,
                'file': self.request.build_absolute_uri(attachment.file.url),
                'file_type': attachment.file_type,
                'created_at': attachment.created_at.isoformat(),
                'note': attachment.note_id,
                'content': attachment.content if file_type == 'image' else None
            }
        except Exception as e:
            raise ValidationError({"error": str(e)})
    

    def _get_next_page_number(self, note):
        existing_attachments = Attachment.objects.filter(note=note, file_type='image')
        return len(existing_attachments) + 1
    
    def perform_update(self, serializer):
        attachment = serializer.save()
        
        # Ré-analyser l'image si c'est une image et que le fichier a été mis à jour
        if attachment.file_type == 'image' and 'file' in serializer.validated_data:
            image_content = analyze_image_with_gpt4(attachment.file.path)
            attachment.content = image_content
            attachment.save()
        
        update_note_embedding(attachment.note)

    def perform_destroy(self, instance):
        note = instance.note
        instance.delete()
        update_note_embedding(note)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachment_data = self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(attachment_data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        if getattr(instance, '_prefetched_objects_cache', None):
            # If 'prefetch_related' has been applied to a queryset, we need to
            # forcibly invalidate the prefetch cache on the instance.
            instance._prefetched_objects_cache = {}

        return Response(serializer.data)


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


class ChatViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['POST'])
    def chat(self, request):
        """
        Gère les requêtes de chat et retourne une réponse en streaming.
        """
        query = request.data.get('message', '')
        session_id = request.data.get('session_id')
        user = request.user
        
        chat_session = self._get_or_create_session(session_id, user)
        self._save_user_message(chat_session, query)
        
        search_results = semantic_search(query, user)
        context = self._prepare_context(search_results)
        
        return StreamingHttpResponse(
            self._generate_ai_response_stream(chat_session, query, context, search_results),
            content_type='text/event-stream'
        )

    def _get_or_create_session(self, session_id, user):
        """
        Récupère une session existante ou en crée une nouvelle.
        """
        if session_id:
            return get_object_or_404(ChatSession, id=session_id, user=user)
        return ChatSession.objects.create(user=user)

    def _save_user_message(self, chat_session, content):
        """
        Enregistre le message de l'utilisateur dans la base de données.
        """
        ChatMessage.objects.create(
            session=chat_session,
            role='user',
            content=content
        )

    def _prepare_context(self, search_results):
        """
        Prépare le contexte à partir des résultats de recherche.
        """
        if not search_results:
            return ""
        
        context = []
        for result in search_results[:3]:
            note_context = f"Note: {result['title']}\n{result['content_preview']}\n"
            for attachment in result['attachments']:
                if attachment['file_type'] == 'image' and attachment['content']:
                    note_context += f"Image '{attachment['file_name']}': {attachment['content']}\n"
                else:
                    note_context += f"{attachment['file_type']} '{attachment['file_name']}'\n"
            context.append(note_context)
        return "\n".join(context)
    
    def _generate_ai_response_stream(self, chat_session, query, context, search_results):
        """
        Génère la réponse de l'IA en streaming en utilisant l'API Hugging Face.
        """
        print("Generating AI response...")
        messages = self._prepare_messages(chat_session, query, context)
        
        try:
            # Initialisez le client Hugging Face
            token = hf_token
            client = InferenceClient(model="mistralai/Mixtral-8x7B-Instruct-v0.1", token=token)
            
            # Préparez l'entrée pour le modèle
            input_text = self._format_input_for_mixtral(messages)
            
            # Générez la réponse en streaming
            full_response = ""
            for chunk in client.text_generation(input_text, max_new_tokens=300, temperature=0.7, stream=True):
                full_response += chunk
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            
            related_note = self._get_related_note(search_results)
            self._save_ai_message(chat_session, full_response, related_note)
            
            yield f"data: {json.dumps({'type': 'source', 'source': related_note.id if related_note else None})}\n\n"
            yield f"data: {json.dumps({'type': 'end'})}\n\n"
        
        except Exception as e:
            print(f"Erreur lors de la génération de la réponse : {str(e)}")
            yield f"data: {json.dumps({'content': 'Désolé, je n ai pas pu générer une réponse appropriée. Pouvez-vous reformuler votre question ?'})}\n\n"
            yield f"data: {json.dumps({'type': 'end'})}\n\n"

    def _format_input_for_mixtral(self, messages):
        formatted_messages = []
        for msg in messages:
            if msg['role'] == 'system':
                formatted_messages.append(f"[INST] {msg['content']} [/INST]")
            elif msg['role'] == 'user':
                formatted_messages.append(f"[INST] {msg['content']} [/INST]")
            elif msg['role'] == 'assistant':
                formatted_messages.append(msg['content'])
        return "\n".join(formatted_messages)

    def _prepare_messages(self, chat_session, query, context):
        """
        Prépare les messages pour l'API du modèle de langage.
        """
        recent_messages = chat_session.messages.order_by('timestamp')[:5]
        
        messages = [
            {"role": "system", "content": """
                Tu es un tuteur en ligne qui guide les étudiants par des questions ciblées. Ton rôle est de stimuler la réflexion sans jamais donner de réponses directes. Suis ces règles strictement :

                1. Adapte la langue : Utilise TOUJOURS la même langue que celle employée par l'étudiant dans sa question initiale c'est a dire FRANCAIS.
                2. Pose uniquement des questions : Chaque réponse doit être une question qui encourage l'étudiant à réfléchir.
                3. Une seule question à la fois : Limite-toi à une question par réponse pour permettre à l'étudiant de répondre.
                4. Sois concis : Formule tes questions en 1-2 phrases maximum.
                5. Guide progressivement : Si l'étudiant est bloqué, pose une question plus simple ou donne un indice sous forme de question.
                6. Encourage la réflexion : Demande à l'étudiant d'expliquer son raisonnement ou de développer ses idées.
                7. Adapte-toi au niveau : Ajuste la complexité de tes questions en fonction des réponses de l'étudiant.

                N'oublie jamais : ton rôle est de poser des questions dans la langue de l'étudiant, pas de donner des explications ou des réponses.
            """},
            {"role": "system", "content": f"Contexte des notes pertinentes : {context}"}
        ]
        
        for msg in recent_messages:
            messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({"role": "user", "content": query})
        return messages

    def _save_ai_message(self, chat_session, content, related_note):
        """
        Enregistre la réponse de l'IA dans la base de données.
        """
        ChatMessage.objects.create(
            session=chat_session,
            role='assistant',
            content=content,
            related_note=related_note
        )

    def _get_related_note(self, search_results):
        """
        Récupère la note la plus pertinente des résultats de recherche.
        """
        if search_results:
            return Note.objects.get(id=search_results[0]['id'])
        return None

    @action(detail=False, methods=['POST'])
    def start_session(self, request):
        """
        Démarre une nouvelle session de chat.
        """
        course_id = request.data.get('course_id')
        user = request.user
        
        chat_session = ChatSession.objects.create(user=user, course_id=course_id)
        
        return Response({
            "session_id": chat_session.id,
            "message": "Session de chat démarrée avec succès"
        })

    @action(detail=False, methods=['POST'])
    def end_session(self, request):
        """
        Termine une session de chat existante.
        """
        session_id = request.data.get('session_id')
        
        try:
            chat_session = ChatSession.objects.get(id=session_id, user=request.user)
            chat_session.ended_at = timezone.now()
            chat_session.save()
            return Response({"message": "Session de chat terminée avec succès"})
        except ChatSession.DoesNotExist:
            return Response({"error": "Session de chat non trouvée"}, status=404)


#Gestions de la declaration des heures

from django.core.mail import send_mail
from datetime import timedelta

@login_required
@require_POST
def declare_hours(request):
    if not hasattr(request.user, 'teacher'):
        return JsonResponse({"error": "Only teachers can declare hours"}, status=403)
    
    course_id = request.POST.get('course_id')
    date = request.POST.get('date')
    duration_minutes = int(request.POST.get('duration_minutes', 0))
    
    if not all([course_id, date, duration_minutes]):
        return JsonResponse({"error": "Missing required fields"}, status=400)
    
    try:
        course = VisitorSubjectCourse.objects.get(id=course_id, teacher=request.user.teacher)
    except VisitorSubjectCourse.DoesNotExist:
        return JsonResponse({"error": "Invalid course"}, status=400)
    
    duration = timedelta(minutes=duration_minutes)
    
    declaration = HourDeclaration.objects.create(
        teacher=request.user.teacher,
        course=course,
        date=date,
        duration=duration
    )
    
    # Envoyer un email à l'enseignant
    send_mail(
        'Déclaration d\'heures enregistrée',
        f'Votre déclaration de {duration} pour le cours de {course.subject.name} a été enregistrée. Le paiement sera déclenché sous une semaine.',
        settings.DEFAULT_FROM_EMAIL,
        [request.user.email],
        fail_silently=False,
    )
    
    # Envoyer un email à l'élève
    send_mail(
        'Heures de cours déclarées',
        f'Votre enseignant a déclaré {duration} pour le cours de {course.subject.name}. Cliquez ici pour gérer le paiement: [lien]',
        settings.DEFAULT_FROM_EMAIL,
        [course.visitor.user.email],
        fail_silently=False,
    )
    
    return JsonResponse({"success": True, "message": "Hours declared successfully"})

from django.db.models import Sum
@login_required
def get_total_hours(request):
    if not hasattr(request.user, 'teacher'):
        return JsonResponse({"error": "Only teachers can view total hours"}, status=403)
    
    total_duration = HourDeclaration.objects.filter(teacher=request.user.teacher).aggregate(
        total=Sum('duration')
    )['total'] or timedelta()
    
    total_hours = total_duration.total_seconds() / 3600
    
    return JsonResponse({"total_hours": f"{total_hours:.2f}"})