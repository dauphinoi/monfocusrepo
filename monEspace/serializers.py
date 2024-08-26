from accounts.models import VisitorSubjectCourse
from rest_framework import serializers
from django.conf import settings
from .models import Homework, HomeworkFeedback, Note, Attachment, TodoItem

class TodoItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = TodoItem
        fields = ['id', 'course', 'content', 'created_by', 'created_at', 'completed']
        read_only_fields = ['id', 'created_at', 'created_by']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)

class AttachmentSerializer(serializers.ModelSerializer):
    note = serializers.PrimaryKeyRelatedField(queryset=Note.objects.all(), required=False)
    file_type = serializers.CharField(required=False)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ['id', 'file', 'file_type', 'created_at', 'note', 'file_url']
        read_only_fields = ['file_url']

    def get_file_url(self, obj):
        return obj.file_url

    def create(self, validated_data):
        request = self.context['request']
        file = request.FILES.get('file')
        if not file:
            raise serializers.ValidationError("Le fichier est obligatoire.")
        
        note_id = request.data.get('note_id')
        if not note_id:
            raise serializers.ValidationError("L'ID de la note est obligatoire.")
        
        file_type = request.data.get('type')
        if not file_type:
            raise serializers.ValidationError("Le type de fichier est obligatoire.")
        
        validated_data['file'] = file
        validated_data['note_id'] = note_id
        validated_data['file_type'] = file_type
        
        return super().create(validated_data)

class NoteSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    course = serializers.PrimaryKeyRelatedField(queryset=VisitorSubjectCourse.objects.all(), required=False)
    todo_items = TodoItemSerializer(many=True, read_only=True, source='course.todo_items')

    class Meta:
        model = Note
        fields = ['id', 'title', 'content', 'created_at', 'updated_at', 'attachments', 'course', 'todo_items']
        read_only_fields = ['id', 'created_at', 'updated_at', 'attachments', 'todo_items']

    def create(self, validated_data):
        course = validated_data.pop('course', None)
        note = Note.objects.create(**validated_data)
        if course:
            note.course = course
            note.save()
        return note

#home work

class HomeworkFeedbackSerializer(serializers.ModelSerializer):
    created_by = serializers.ReadOnlyField(source='created_by.username')

    class Meta:
        model = HomeworkFeedback
        fields = ['id', 'content', 'grade', 'created_at', 'updated_at', 'created_by']
        read_only_fields = ['created_at', 'updated_at', 'created_by']

class HomeworkSerializer(serializers.ModelSerializer):
    is_past_due = serializers.BooleanField(read_only=True)
    feedback = HomeworkFeedbackSerializer(read_only=True)
    course_name = serializers.CharField(source='course.subject.name', read_only=True)
    created_by = serializers.ReadOnlyField(source='created_by.username')
    
    class Meta:
        model = Homework
        fields = ['id', 'course', 'course_name', 'title', 'description', 'due_date', 
                  'created_at', 'updated_at', 'created_by', 'is_corrected', 
                  'is_past_due', 'feedback']
        read_only_fields = ['created_at', 'updated_at', 'created_by', 'is_past_due']

    def create(self, validated_data):
        user = self.context['request'].user
        return Homework.objects.create(**validated_data, created_by=user)

class HomeworkListSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source='course.subject.name', read_only=True)

    class Meta:
        model = Homework
        fields = ['id', 'course', 'course_name', 'title', 'due_date', 'is_corrected', 'is_past_due']

class CourseHomeworkSerializer(serializers.ModelSerializer):
    homeworks = HomeworkListSerializer(many=True, read_only=True)

    class Meta:
        model = VisitorSubjectCourse
        fields = ['id', 'subject', 'homeworks']