from django.contrib import admin
from .models import CoursType, Institution, Level, Subject, Teacher, TeacherSubject, Visitor, VisitorSubjectCourse

admin.site.register(Teacher)
admin.site.register(Subject)
admin.site.register(TeacherSubject)
admin.site.register(Level)
admin.site.register(CoursType)
admin.site.register(Visitor)
admin.site.register(VisitorSubjectCourse)
admin.site.register(Institution)
