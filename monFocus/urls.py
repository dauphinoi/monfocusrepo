from django.conf import settings
from django.contrib import admin
from django.urls import path, include
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from monEspace.views import NoteViewSet, AttachmentViewSet, ChatViewSet, espacenote_view, TodoItemViewSet

router = DefaultRouter()
router.register(r'notes', NoteViewSet, basename='note')
# router.register(r'notes', NoteViewSet)
router.register(r'upload', AttachmentViewSet)
router.register(r'chat', ChatViewSet, basename='chat')
# Ajoutez cette ligne
router.register(r'todo-items', TodoItemViewSet, basename='todo-item')

urlpatterns = [
    path("admin/", admin.site.urls),
    path("monFocusprof/", include("monFocusprof.urls")),
    path("accounts/", include("accounts.urls", namespace="accounts")),
    path('monespace/', include('monEspace.urls', namespace='monEspace')),
    path("api/", include(router.urls)),
    path("", espacenote_view, name="espacenote"),  # La vue espacenote est maintenant la page d'accueil
    path('api/chat/', ChatViewSet.as_view({'post': 'chat'}), name='chat'),

]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)