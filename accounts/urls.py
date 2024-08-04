from django.urls import path
from . import views
from .sso_views import InstitutionSSOView, SSOLoginView, institution_selection, fake_sso_endpoint

app_name = 'accounts'
urlpatterns = [
    path("login/", views.login_view, name="login_view"),
    path('postuler/<int:step>/', views.postuler, name='postuler_with_step'),
    path('parent-form/<int:step>/', views.parent_form_view, name='parent_form_step'),
    path('eleve-etudiant-form/<int:step>/', views.eleve_etudiant_form_view, name='eleve_etudiant_form_step'),
    path('reset-password/', views.reset_password_request, name='reset_password_request'),
    path('reset-password/<uidb64>/<token>/', views.reset_password_confirm, name='password_reset_confirm'),
    
    # SSO related URLs
    path('select-institution/', institution_selection, name='institution_selection'),
    path('api/sso/', InstitutionSSOView.as_view(), name='institution_sso'),
    path('sso-login/', SSOLoginView.as_view(), name='sso_login'),
    path('fake-sso-endpoint/', fake_sso_endpoint, name='fake_sso_endpoint'),
]