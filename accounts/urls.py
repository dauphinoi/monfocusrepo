from django.urls import path, include

from . import views
from .views import InstitutionSSOView

app_name = 'accounts'
urlpatterns = [
    path("login_view/", views.login_view, name="login_view"),
    path('postuler/<int:step>/', views.postuler, name='postuler_with_step'),
    path('parent-form/<int:step>/', views.parent_form_view, name='parent_form_step'),
    path('eleve-etudiant-form/<int:step>/', views.eleve_etudiant_form_view, name='eleve_etudiant_form_step'),
    path('institution-sso/', InstitutionSSOView.as_view(), name='institution_sso'),
    path('reset-password/', views.reset_password_request, name='reset_password_request'),
    path('reset-password/<uidb64>/<token>/', views.reset_password_confirm, name='password_reset_confirm'),
]