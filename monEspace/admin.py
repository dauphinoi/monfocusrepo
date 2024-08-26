from django.contrib import admin

# Register your models here.

from .models import Attachment, Homework, Note, TodoItem

admin.site.register(Note)
admin.site.register(Attachment)
admin.site.register(TodoItem)
admin.site.register(Homework)
