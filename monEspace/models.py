from datetime import timedelta
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import Teacher, VisitorSubjectCourse
import numpy as np
from monFocus.storage_backends import MediaStorage
from django.conf import settings
from django.utils import timezone

class Note(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    #embedding = models.BinaryField(null=True, blank=True)
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, related_name='notes', null=True)

    def set_embedding(self, embedding):
        self.embedding = np.array(embedding).tobytes()

    def get_embedding(self):
        return np.frombuffer(self.embedding, dtype=np.float32) if self.embedding else None

    def __str__(self):
        return self.title



def attachment_file_path(instance, filename):
    # Utilise le note_id comme dossier
    return f'media/image/{instance.note.id}/{filename}'
class Attachment(models.Model):
    note = models.ForeignKey(Note, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to=attachment_file_path, storage=MediaStorage())
    file_type = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    content = models.TextField(blank=True, null=True)  # Pour stocker la description de l'image

    def __str__(self):
        return f"{self.file_type} attachment for {self.note.title}"

    def save(self, *args, **kwargs):
        if not self.file:
            raise ValueError("Le fichier est obligatoire pour créer un attachement.")
        super().save(*args, **kwargs)

    @property
    def file_url(self):
        if self.file:
            return f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{self.file.name}"
        return None 

class TodoItem(models.Model):
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, related_name='todo_items')
    content = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)


# Dans models.py

class ChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    is_task_session = models.BooleanField(default=False)

class ChatMessage(models.Model):
    ROLE_CHOICES = (
        ('user', 'User'),
        ('ai', 'AI'),
    )
    session = models.ForeignKey(ChatSession, on_delete=models.CASCADE, related_name='messages')
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    related_note = models.ForeignKey(Note, on_delete=models.SET_NULL, null=True, blank=True)

# Gestion des Homeworks


class Homework(models.Model):
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, related_name='homeworks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_date = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    is_corrected = models.BooleanField(default=False)
    
    def __str__(self):
        return self.title

    @property
    def is_past_due(self):
        return timezone.now() > self.due_date

class HomeworkFeedback(models.Model):
    homework = models.OneToOneField(Homework, on_delete=models.CASCADE, related_name='feedback')
    content = models.TextField()
    grade = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)

    def __str__(self):
        return f"Feedback for {self.homework.title}"
