from datetime import timedelta
from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from accounts.models import Teacher, VisitorSubjectCourse
import numpy as np

class Note(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    embedding = models.BinaryField(null=True, blank=True)
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, related_name='notes', null=True)

    def set_embedding(self, embedding):
        self.embedding = np.array(embedding).tobytes()

    def get_embedding(self):
        return np.frombuffer(self.embedding, dtype=np.float32) if self.embedding else None

    def __str__(self):
        return self.title

class Attachment(models.Model):
    note = models.ForeignKey(Note, related_name='attachments', on_delete=models.CASCADE)
    file = models.FileField(upload_to='attachments/')
    file_type = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    content = models.TextField(blank=True, null=True)  # Pour stocker la description de l'image

    def __str__(self):
        return f"{self.file_type} attachment for {self.note.title}"

    def save(self, *args, **kwargs):
        if not self.file:
            raise ValueError("Le fichier est obligatoire pour créer un attachement.")
        super().save(*args, **kwargs)

class TodoItem(models.Model):
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, related_name='todo_items')
    content = models.TextField()
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    completed = models.BooleanField(default=False)

class HourDeclaration(models.Model):
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE)
    date = models.DateField()
    duration = models.DurationField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

# Dans models.py

class ChatSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    course = models.ForeignKey(VisitorSubjectCourse, on_delete=models.CASCADE, null=True, blank=True)
    started_at = models.DateTimeField(auto_now_add=True)
    ended_at = models.DateTimeField(null=True, blank=True)

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