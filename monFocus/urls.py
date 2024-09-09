from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from monEspace.views import HomeworkViewSet, NoteViewSet, AttachmentViewSet, analyze_homework_and_create_feedback, espacenote_view, TodoItemViewSet
from monEspace.chat_view import ChatViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet, basename='note')
# router.register(r'notes', NoteViewSet)
router.register(r'upload', AttachmentViewSet)
router.register(r'chat', ChatViewSet, basename='chat')
# Ajoutez cette ligne
router.register(r'todo-items', TodoItemViewSet, basename='todo-item')
#homework
router.register(r'homeworks', HomeworkViewSet, basename='homework')

urlpatterns = [
    path("admin/", admin.site.urls),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path('monespace/', include('monEspace.urls', namespace='monEspace')),
    path("api/", include(router.urls)),
    path("", include("monFocusprof.urls")),
    path('api/chat/', ChatViewSet.as_view({'post': 'chat'}), name='chat'),
    path('api/homeworks/<int:homework_id>/analyze_and_feedback/', analyze_homework_and_create_feedback, name='analyze_homework'),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)