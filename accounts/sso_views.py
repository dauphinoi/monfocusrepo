import jwt
import logging
import time
import json
import uuid
from urllib.parse import urlencode
from django.shortcuts import render, redirect
from django.contrib.auth import login
from django.conf import settings
from django.views import View
from django.http import JsonResponse, HttpResponseBadRequest
from django.urls import reverse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ObjectDoesNotExist
from .models import User, Institution

logger = logging.getLogger(__name__)

class SSOLoginView(View):
    def get(self, request):
        token = request.GET.get('token')
        if not token:
            logger.warning("SSO login attempt without token")
            return redirect('login')
        
        try:
            # Decode and validate the token
            payload = jwt.decode(token, settings.SSO_SECRET_KEY, algorithms=['HS256'])
            
            # Get or create the user
            user, created = User.objects.update_or_create(
                email=payload['email'],
                defaults={
                    'first_name': payload['first_name'],
                    'last_name': payload['last_name'],
                    'institution_user_id': payload['institution_user_id'],
                }
            )
            
            # Get the institution (it should always exist at this point)
            institution = Institution.objects.get(id=payload['institution_id'])
            user.institution = institution
            user.save()
            
            # Log in the user
            login(request, user)
            logger.info(f"Successful SSO login for user {user.id}")
            
            return redirect('dashboard')
        except jwt.ExpiredSignatureError:
            logger.warning("SSO login attempt with expired token")
            return redirect('login')
        except jwt.DecodeError:
            logger.warning("SSO login attempt with invalid token")
            return redirect('login')
        except Exception as e:
            logger.error(f"Error during SSO login: {str(e)}")
            return redirect('login')

class InstitutionSSOView(APIView):
    def post(self, request):
        auth_key = request.data.get('auth_key')
        user_data = request.data.get('user_data')

        if not auth_key or not user_data:
            return Response({"error": "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            institution = Institution.objects.get(auth_key=auth_key, is_active=True)
        except Institution.DoesNotExist:
            logger.warning(f"SSO attempt with invalid auth key: {auth_key}")
            return Response({"error": "Invalid or inactive institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user, created = User.objects.update_or_create(
                email=user_data['email'],
                defaults={
                    'first_name': user_data['first_name'],
                    'last_name': user_data['last_name'],
                    'institution': institution,
                    'institution_user_id': user_data['institution_user_id']
                }
            )

            sso_token = generate_sso_token(user_data, institution.id)

            return Response({
                "success": True,
                "user_id": user.id,
                "sso_token": sso_token
            })
        except Exception as e:
            logger.error(f"Error during institution SSO: {str(e)}")
            return Response({"error": "An error occurred during SSO process"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class InstitutionSSORedirectView(APIView):
    def get(self, request):
        auth_key = request.GET.get('auth_key')
        user_data = request.GET.get('user_data')

        if not auth_key or not user_data:
            return Response({"error": "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            institution = Institution.objects.get(auth_key=auth_key, is_active=True)
        except Institution.DoesNotExist:
            return Response({"error": "Invalid or inactive institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_data = json.loads(user_data)
        except json.JSONDecodeError:
            return Response({"error": "Invalid user data format"}, status=status.HTTP_400_BAD_REQUEST)

        sso_token = generate_sso_token(user_data, institution.id)
        redirect_url = f"{request.build_absolute_uri('/accounts/sso-login/')}?token={sso_token}"
        
        return redirect(redirect_url)

def institution_selection(request):
    if request.method == 'GET':
        # Afficher la page de sélection d'institution
        institutions = Institution.objects.filter(is_active=True)
        return render(request, 'accounts/institution_selection.html', {'institutions': institutions})
    
    elif request.method == 'POST':
        institution_id = request.POST.get('institution_id')
        if not institution_id:
            return HttpResponseBadRequest("Institution non sélectionnée")
        
        try:
            institution = Institution.objects.get(id=institution_id, is_active=True)
        except Institution.DoesNotExist:
            return HttpResponseBadRequest("Institution invalide")
        
        # Générer un état unique pour cette requête SSO
        state = str(uuid.uuid4())
        
        # Stocker l'état dans la session pour une vérification ultérieure
        request.session['sso_state'] = state
        
        # Construire l'URL de redirection SSO
        callback_url = request.build_absolute_uri(reverse('accounts:sso_callback'))
        sso_params = {
            'callback_url': callback_url,
            'state': state,
            # Ajoutez d'autres paramètres nécessaires pour votre SSO
        }
        
        # Construire l'URL SSO complète
        sso_url = f"{institution.sso_url}?{'&amp;'.join([f'{k}={v}' for k, v in sso_params.items()])}"
        
        # Rediriger l'utilisateur vers l'URL SSO de l'institution
        return redirect(sso_url)

def sso_callback(request):
    # Vérifier l'état pour s'assurer que la requête est valide
    state = request.GET.get('state')
    if state != request.session.get('sso_state'):
        return HttpResponseBadRequest("État SSO invalide")

    # Nettoyer l'état de la session
    del request.session['sso_state']

    # Récupérer le token ou les informations d'authentification de l'institution
    sso_token = request.GET.get('sso_token')
    if not sso_token:
        return HttpResponseBadRequest("Token SSO manquant")

    # Valider le token et récupérer l'utilisateur
    user = validate_sso_token(sso_token)
    if not user:
        return HttpResponseBadRequest("Token SSO invalide")

    # Connecter l'utilisateur
    login(request, user)

    # Rediriger vers l'espace utilisateur dans votre plateforme
    return redirect('dashboard')

def generate_sso_token(user_data, institution_id):
    """
    Generate a secure SSO token using JWT.
    """
    payload = {
        'email': user_data['email'],
        'first_name': user_data['first_name'],
        'last_name': user_data['last_name'],
        'institution_id': institution_id,
        'institution_user_id': user_data['institution_user_id'],
        'exp': int(time.time()) + 300  # Token expires in 5 minutes
    }
    return jwt.encode(payload, settings.SSO_SECRET_KEY, algorithm='HS256')

def validate_sso_token(token):
    """
    Validate the SSO token and return the associated user.
    """
    try:
        payload = jwt.decode(token, settings.SSO_SECRET_KEY, algorithms=['HS256'])
        user = User.objects.get(email=payload['email'], institution_id=payload['institution_id'])
        return user
    except (jwt.DecodeError, jwt.ExpiredSignatureError, ObjectDoesNotExist):
        return None

class GetSSOTokenView(APIView):
    def post(self, request):
        auth_key = request.data.get('auth_key')
        user_data = request.data.get('user_data')

        if not auth_key or not user_data:
            return Response({"error": "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            institution = Institution.objects.get(auth_key=auth_key, is_active=True)
        except Institution.DoesNotExist:
            logger.warning(f"Token request with invalid auth key: {auth_key}")
            return Response({"error": "Invalid or inactive institution"}, status=status.HTTP_400_BAD_REQUEST)

        jwt_token = generate_sso_token(user_data, institution.id)
        return Response({
            "success": True,
            "jwt_token": jwt_token
        })

# Middleware pour vérifier l'authentification SSO
class SSOAuthenticationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        sso_token = request.COOKIES.get('sso_token')
        if sso_token:
            user = validate_sso_token(sso_token)
            if user:
                request.user = user

        response = self.get_response(request)
        return response