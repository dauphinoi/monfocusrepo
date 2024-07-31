# monEspace/urls.py
from django.urls import path
from . import views

app_name = 'monEspace'  # Ceci définit un namespace pour l'application

urlpatterns = [
    path('espacenote/', views.espacenote_view, name='espacenote'),
    path('espacenote/add-course/', views.add_course, name='add_course'),
    path('espacenote/declare-hours/', views.declare_hours, name='declare_hours'),
    path('espacenote/get-total-hours/', views.get_total_hours, name='get_total_hours'),
    path('espacenote/subjects/', views.get_subjects, name='get_subjects'),
    # ... autres urls ...
]