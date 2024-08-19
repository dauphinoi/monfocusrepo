import json
import time
import urllib.parse
import logging
from django.shortcuts import render, redirect
from django.urls import reverse
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.core.signing import Signer, BadSignature
from django.conf import settings
from django.contrib.auth import login
from django.contrib.auth.models import User
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Institution, Teacher, Visitor, Subject, Level

logger = logging.getLogger(__name__)

@require_http_methods(["GET"])
def institution_selection(request):
    institution_id = request.GET.get('institution_id')
    if institution_id:
        try:
            institution = Institution.objects.get(id=institution_id, is_active=True)
            redirect_url = request.build_absolute_uri(reverse('accounts:sso_callback'))
            return redirect(f"{institution.sso_url}?redirect_url={urllib.parse.quote(redirect_url)}")
        except Institution.DoesNotExist:
            logger.warning(f"Attempted access with invalid institution ID: {institution_id}")
            return JsonResponse({"error": "Institution invalide ou inactive"}, status=400)
    
    institutions = Institution.objects.filter(is_active=True)
    return render(request, 'accounts/institution_selection.html', {'institutions': institutions})

class InstitutionSSOView(APIView):
    def post(self, request):
        auth_key = request.data.get('auth_key')
        user_type = request.data.get('user_type')
        user_data_str = request.data.get('user_data')

        if not all([auth_key, user_type, user_data_str]):
            logger.warning("SSO attempt with missing data")
            return Response({"error": "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_data = json.loads(user_data_str)
        except json.JSONDecodeError:
            logger.warning("SSO attempt with invalid user data format")
            return Response({"error": "Invalid user data format"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            institution = Institution.objects.get(auth_key=auth_key, is_active=True)
        except Institution.DoesNotExist:
            logger.warning(f"SSO attempt with invalid auth key: {auth_key}")
            return Response({"error": "Invalid or inactive institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if user_type == 'teacher':
                    user, _ = self.get_or_create_teacher(institution, user_data)
                elif user_type == 'visitor':
                    user, _ = self.get_or_create_visitor(institution, user_data)
                else:
                    logger.warning(f"SSO attempt with invalid user type: {user_type}")
                    return Response({"error": "Invalid user type"}, status=status.HTTP_400_BAD_REQUEST)

            sso_token = self.generate_sso_token(user.id, institution.id, user_type)

            return Response({
                "success": True, 
                "user_type": user_type,
                "user_id": user.id,
                "sso_token": sso_token
            })
        except Exception as e:
            logger.error(f"SSO error: {str(e)}")
            return Response({"error": "An error occurred during SSO process"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def generate_sso_token(self, user_id, institution_id, user_type):
        signer = Signer(settings.SECRET_KEY)
        token_data = f"{user_id}:{institution_id}:{user_type}:{int(time.time())}"
        return signer.sign(token_data)

    def get_or_create_teacher(self, institution, user_data):
        teacher, created = Teacher.objects.update_or_create(
            institution=institution,
            institution_user_id=user_data['institution_user_id'],
            defaults={
                'civilite': user_data.get('civilite', ''),
                'first_name': user_data['first_name'],
                'last_name': user_data['last_name'],
                'email': user_data['email']
            }
        )

        if 'subjects' in user_data:
            self.update_teacher_subjects(teacher, user_data['subjects'])

        return teacher.user, created

    def get_or_create_visitor(self, institution, user_data):
        visitor, created = Visitor.objects.update_or_create(
            institution=institution,
            institution_user_id=user_data['institution_user_id'],
            defaults={
                'profile_type': user_data['profile_type'],
                'first_name': user_data['first_name'],
                'last_name': user_data['last_name'],
                'email': user_data['email']
            }
        )

        if 'level' in user_data:
            level, _ = Level.objects.get_or_create(name=user_data['level'])
            visitor.level = level
            visitor.save()

        return visitor.user, created

    def update_teacher_subjects(self, teacher, subjects):
        current_subjects = set(teacher.subjects.values_list('name', flat=True))
        new_subjects = set(subjects)

        for subject_name in new_subjects - current_subjects:
            subject, _ = Subject.objects.get_or_create(name=subject_name)
            teacher.subjects.add(subject)

        for subject_name in current_subjects - new_subjects:
            subject = Subject.objects.get(name=subject_name)
            teacher.subjects.remove(subject)

@require_http_methods(["GET"])
def sso_callback(request):
    sso_data_str = request.GET.get('sso_data', '{}')
    try:
        sso_data = json.loads(urllib.parse.unquote(sso_data_str))
    except json.JSONDecodeError:
        logger.warning("SSO callback with invalid data format")
        return JsonResponse({"error": "Invalid SSO data format"}, status=400)
    
    if verify_sso_data(sso_data):
        user = create_or_update_user(sso_data['user_data'])
        login(request, user)
        logger.info(f"Successful SSO login for user {user.id}")
        return redirect('user_dashboard')
    else:
        logger.warning("SSO callback with invalid data")
        return JsonResponse({"error": "Invalid SSO data"}, status=400)

def verify_sso_data(sso_data):
    try:
        institution = Institution.objects.get(auth_key=sso_data['auth_key'])
        return institution.is_active
    except Institution.DoesNotExist:
        logger.warning(f"SSO verification failed for auth key: {sso_data.get('auth_key')}")
        return False

def create_or_update_user(user_data):
    user, created = User.objects.update_or_create(
        email=user_data['email'],
        defaults={
            'username': user_data.get('username', user_data['email']),
            'first_name': user_data.get('first_name', ''),
            'last_name': user_data.get('last_name', ''),
        }
    )
    if created:
        logger.info(f"New user created during SSO: {user.id}")
    return user

class SSOLoginView(APIView):
    def get(self, request):
        institution_id = request.GET.get('institution_id')
        sso_token = request.GET.get('sso_token')
        
        if not institution_id or not sso_token:
            logger.warning("SSO login attempt with missing parameters")
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            institution = Institution.objects.get(id=institution_id, is_active=True)
        except Institution.DoesNotExist:
            logger.warning(f"SSO login attempt with invalid institution ID: {institution_id}")
            return Response({"error": "Invalid institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user, user_type = self.validate_sso_token(sso_token, institution)
            if user:
                login(request, user)
                logger.info(f"Successful SSO login for user {user.id}")
                return redirect(reverse('monEspace:espacenote'))
            else:
                logger.warning("SSO login attempt with invalid token")
                return Response({"error": "Invalid SSO token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"SSO login error: {str(e)}")
            return Response({"error": "An error occurred during SSO login"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def validate_sso_token(self, token, institution):
        signer = Signer(settings.SECRET_KEY)
        try:
            token_data = signer.unsign(token)
            user_id, institution_id, user_type, timestamp = token_data.split(':')
            
            if int(time.time()) - int(timestamp) > 300:  # 5 minutes expiration
                raise ValueError("Token has expired")

            if int(institution_id) != institution.id:
                raise ValueError("Token does not match the institution")

            user = User.objects.get(id=user_id)
            
            if user_type == 'teacher':
                if not hasattr(user, 'teacher') or user.teacher.institution_id != institution.id:
                    raise ValueError("Invalid teacher or institution")
            elif user_type == 'visitor':
                if not hasattr(user, 'visitor') or user.visitor.institution_id != institution.id:
                    raise ValueError("Invalid visitor or institution")
            else:
                raise ValueError("Invalid user type")

            return user, user_type
        except (BadSignature, ValueError, User.DoesNotExist) as e:
            logger.warning(f"SSO token validation failed: {str(e)}")
            raise ValueError(f"Invalid token: {str(e)}")