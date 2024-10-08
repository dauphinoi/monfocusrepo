from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import StreamingHttpResponse
from django.shortcuts import get_object_or_404
from openai import OpenAI
import os
from rest_framework import status
import json
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.core.mail import send_mail

from accounts.models import VisitorSubjectCourse

from .models import ChatMessage, ChatSession, Note, TodoItem

from .services import semantic_search

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

class ChatViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['POST'])
    def chat(self, request):
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
        if session_id:
            return get_object_or_404(ChatSession, id=session_id, user=user)
        return ChatSession.objects.create(user=user)

    def _save_user_message(self, chat_session, content):
        ChatMessage.objects.create(
            session=chat_session,
            role='user',
            content=content
        )

    def _prepare_context(self, search_results):
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
        print("Generating AI response...")
        messages = self._prepare_messages(chat_session, query, context)

        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=1000,
                temperature=0.7,
                stream=True
            )

            full_response = ""
            for chunk in response:
                content = getattr(chunk.choices[0].delta, "content", None)
                if content:
                    full_response += content
                    yield f"data: {json.dumps({'content': content})}\n\n"

            related_note = self._get_related_note(search_results)
            self._save_ai_message(chat_session, full_response, related_note)

            yield f"data: {json.dumps({'type': 'source', 'source': related_note.id if related_note else None})}\n\n"
            yield f"data: {json.dumps({'type': 'end'})}\n\n"

        except Exception as e:
            print(f"Erreur lors de la génération de la réponse : {str(e)}")
            yield f"data: {json.dumps({'content': 'Désolé, je n ai pas pu générer une réponse appropriée. Pouvez-vous reformuler votre question ?'})}\n\n"
            yield f"data: {json.dumps({'type': 'end'})}\n\n"

    def _prepare_messages(self, chat_session, query, context):
        system_message = """
    Je suis un tuteur en ligne qui guide l'élève par des questions ciblées, en me basant sur les notes de cours fournies. Mon rôle est de stimuler la réflexion sans donner de réponses directes. Voici les règles à suivre :

    1. Utiliser le français.
    2. Se baser sur les notes de cours fournies.
    3. Poser au maximum une question à la fois pour encourager la réflexion.
    4. Être concis : formuler les questions en 1 phrase maximum.
    5. Si l'élève est bloqué, le guider progressivement avec une question plus simple ou un indice sous forme de question, en faisant référence aux notes de cours.
    6. Encourager la réflexion en demandant d'expliquer le raisonnement ou de développer les idées en lien avec le contenu des notes.
    7. Adapter la complexité des questions en fonction des réponses et du niveau de détail des notes de cours.
    8. Si l'élève donne une réponse fausse, le signaler et aider à comprendre pourquoi c'est faux.
    9. Assurer une progression naturelle de la conversation en évitant de répéter les mêmes questions.
    10. Tenir compte de l'ensemble de l'historique de la conversation pour fournir des réponses pertinentes et progressives.

    Instructions de formatage :
    - Utiliser **texte** pour mettre en gras les points importants.
    - Utiliser *texte* pour l'italique pour les termes techniques ou les concepts clés.
    - Utiliser des listes à puces pour énumérer des points :
      • Point 1
      • Point 2
    - Pour les équations mathématiques, utiliser la syntaxe LaTeX entre $ : $equation$
    - Pour les blocs de code, utiliser la syntaxe ```langage\ncode\n```
    """

        messages = [
            {"role": "system", "content": system_message},
            {"role": "system", "content": f"Contexte des notes pertinentes : {context}"}
        ]
        
        # Récupérer tous les messages de la session, limités à un nombre raisonnable (par exemple, 6)
        recent_messages = chat_session.messages.order_by('-timestamp')[:6][::-1]
        
        for msg in recent_messages:
            messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({"role": "user", "content": query})
        return messages

    def _save_ai_message(self, chat_session, content, related_note):
        ChatMessage.objects.create(
            session=chat_session,
            role='assistant',
            content=content,
            related_note=related_note
        )

    def _get_related_note(self, search_results):
        if search_results:
            return Note.objects.get(id=search_results[0]['id'])
        return None

    @action(detail=False, methods=['POST'])
    def start_session(self, request):
        course_id = request.data.get('course_id')
        is_task_session = request.data.get('is_task_session', False)
        user = request.user
        
        chat_session = ChatSession.objects.create(user=user, course_id=course_id, is_task_session=is_task_session)
        
        return Response({
            "session_id": chat_session.id,
            "message": "Session de chat démarrée avec succès"
        })

    @action(detail=False, methods=['POST'])
    def end_session(self, request):
        session_id = request.data.get('session_id')
        
        try:
            chat_session = ChatSession.objects.get(id=session_id, user=request.user)
            chat_session.ended_at = timezone.now()
            chat_session.save()
            return Response({"message": "Session de chat terminée avec succès"})
        except ChatSession.DoesNotExist:
            return Response({"error": "Session de chat non trouvée"}, status=404)

    @action(detail=False, methods=['POST'])
    def generate_report(self, request):
        session_id = request.data.get('session_id')
        todo_id = request.data.get('todo_id')
        user = request.user

        try:
            chat_session = ChatSession.objects.get(id=session_id, user=user, is_task_session=True)
            todo_item = TodoItem.objects.select_related(
                'created_by',
                'course__subject',
                'course__cours_type',
                'course__teacher__user'
            ).get(id=todo_id)
        except (ChatSession.DoesNotExist, TodoItem.DoesNotExist):
            return Response({"error": "Session de tâche ou tâche non trouvée"}, status=status.HTTP_404_NOT_FOUND)

        # Vérifier les permissions
        if not self.can_delete_todo(user, todo_item):
            return Response({"error": "Vous n'êtes pas autorisé à supprimer cette tâche"}, status=status.HTTP_403_FORBIDDEN)

        messages = chat_session.messages.all().order_by('timestamp')

        teacher = todo_item.course.teacher
        if not teacher:
            return Response({"error": "Aucun enseignant associé à ce cours"}, status=status.HTTP_400_BAD_REQUEST)

        context = {
            'student_name': f"{user.first_name} {user.last_name}",
            'date': chat_session.started_at.strftime("%d/%m/%Y"),
            'course_name': f"{todo_item.course.subject.name} - {todo_item.course.cours_type.name}",
            'task_content': todo_item.content,
            'messages': messages,
            'teacher_name': f"{teacher.user.first_name} {teacher.user.last_name}"
        }

        html_content = render_to_string('monEspace/task_report.html', context)
        
        teacher_email = teacher.user.email
        subject = f"Rapport de tâche - {user.first_name} {user.last_name} - {todo_item.course.subject.name}"
        plain_message = strip_tags(html_content)
        from_email = settings.DEFAULT_FROM_EMAIL

        try:
            send_mail(subject, plain_message, from_email, [teacher_email], html_message=html_content)
            email_sent = True
        except Exception as e:
            print(f"Erreur lors de l'envoi de l'email : {str(e)}")
            email_sent = False

        # Supprimer la tâche
        todo_item.delete()

        return Response({
            "report_html": html_content,
            "message": "Rapport généré avec succès" + (" et envoyé à l'enseignant" if email_sent else " mais non envoyé"),
            "task_deleted": True,
            "task_id": todo_id
        }, status=status.HTTP_200_OK)

    def can_delete_todo(self, user, todo_item):
        if hasattr(user, 'teacher'):
            return todo_item.course.teacher == user.teacher
        elif hasattr(user, 'visitor'):
            return todo_item.course.visitor == user.visitor
        return False