from django.contrib import admin
from .models import CoursType, Institution, Level, Subject, Teacher, TeacherSubject, Visitor, VisitorSubjectCourse

admin.site.register(Teacher)
admin.site.register(Subject)
admin.site.register(TeacherSubject)
admin.site.register(Level)
admin.site.register(CoursType)
admin.site.register(Visitor)
admin.site.register(VisitorSubjectCourse)

@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'is_active', 'is_partner', 'partner_order')
    list_editable = ('is_active', 'is_partner', 'partner_order')
    list_filter = ('type', 'is_active', 'is_partner')
    search_fields = ('name', 'contact_name', 'email')
