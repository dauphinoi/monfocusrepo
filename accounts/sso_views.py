import traceback
from django.shortcuts import render, redirect
from django.urls import reverse
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import login
from django.core.signing import Signer, BadSignature
from django.conf import settings
from django.contrib.auth.models import User
from .models import Institution, Teacher, Visitor, Subject, Level
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
import json
import time
from django.db import transaction

from django.views.decorators.http import require_http_methods
from django.middleware.csrf import get_token

@require_http_methods(["GET", "POST"])
def institution_selection(request):
    if request.method == 'POST':
        institution_id = request.POST.get('institution')
        if institution_id:
            institution = Institution.objects.get(id=institution_id)
            context = {
                'institution_id': institution_id,
                'sso_url': reverse('accounts:fake_sso_endpoint'),
                'csrf_token': get_token(request),
            }
            return render(request, 'accounts/sso_redirect.html', context)
    
    institutions = Institution.objects.filter(is_active=True)
    return render(request, 'accounts/institution_selection.html', {'institutions': institutions})

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.signing import Signer
from django.conf import settings
from .models import Institution, Teacher, Visitor, Subject, Level
from django.contrib.auth.models import User
from django.db import transaction
import json
import time

class InstitutionSSOView(APIView):
    def post(self, request):
        print("InstitutionSSOView.post called")
        print(f"Request POST: {request.POST}")
        print(f"Request data: {request.data}")

        # Essayez d'abord request.data, puis request.POST si data est vide
        data = request.data if request.data else request.POST

        auth_key = '9mt5iqIVVT7d9E7Icv5W1Ln5CvfdVpHN'
        user_type = 'teacher'
        user_data_str = '{"institution_user_id": "TEST001", "civilite": "Monsieur", "first_name": "Test", "last_name": "User", "email": "test.user@universite-test.com"}'

        print(f"auth_key: {auth_key}")
        print(f"user_type: {user_type}")
        print(f"user_data (raw): {user_data_str}")

        if not auth_key or not user_type or not user_data_str:
            return Response({"error": "Missing required data"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user_data = json.loads(user_data_str)
            print(f"user_data (parsed): {user_data}")
        except json.JSONDecodeError:
            return Response({"error": "Invalid user_data format"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            institution = Institution.objects.get(auth_key=auth_key, is_active=True)
            print(f"Institution found: {institution}")
        except Institution.DoesNotExist:
            return Response({"error": "Invalid or inactive institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                if user_type == 'teacher':
                    user, teacher = self.get_or_create_teacher(institution, user_data)
                    print(f"Teacher created/updated: {teacher}")
                elif user_type == 'visitor':
                    user, visitor = self.get_or_create_visitor(institution, user_data)
                    print(f"Visitor created/updated: {visitor}")
                else:
                    return Response({"error": "Invalid user type"}, status=status.HTTP_400_BAD_REQUEST)

            sso_token = self.generate_sso_token(user.id, institution.id, user_type)
            print(f"SSO token generated: {sso_token}")

            return Response({
                "success": True, 
                "user_type": user_type,
                "user_id": user.id,
                "sso_token": sso_token
            })
        except Exception as e:
            print(f"Error occurred: {str(e)}")
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    def generate_sso_token(self, user_id, institution_id, user_type):
        signer = Signer(settings.SECRET_KEY)
        token_data = f"{user_id}:{institution_id}:{user_type}:{int(time.time())}"
        return signer.sign(token_data)

    def get_or_create_teacher(self, institution, user_data):
        print(f"get_or_create_teacher called with data: {user_data}")
        teacher, created = Teacher.objects.get_or_create(
            institution=institution,
            institution_user_id=user_data['institution_user_id'],
            defaults={
                'civilite': user_data['civilite'],
                'first_name': user_data['first_name'],
                'last_name': user_data['last_name'],
                'email': user_data['email']
            }
        )
        if not created:
            print(f"Updating existing teacher: {teacher}")
            for field in ['civilite', 'first_name', 'last_name', 'email']:
                setattr(teacher, field, user_data[field])
            teacher.save()

        user = teacher.user
        if 'subjects' in user_data:
            self.update_teacher_subjects(teacher, user_data['subjects'])

        return user, teacher

    def get_or_create_visitor(self, institution, user_data):
        print(f"get_or_create_visitor called with data: {user_data}")
        visitor, created = Visitor.objects.get_or_create(
            institution=institution,
            institution_user_id=user_data['institution_user_id'],
            defaults={
                'profile_type': user_data['profile_type'],
                'first_name': user_data['first_name'],
                'last_name': user_data['last_name'],
                'email': user_data['email']
            }
        )
        if not created:
            print(f"Updating existing visitor: {visitor}")
            for field in ['profile_type', 'first_name', 'last_name', 'email']:
                setattr(visitor, field, user_data[field])
            visitor.save()

        user = visitor.user
        if 'level' in user_data:
            level, _ = Level.objects.get_or_create(name=user_data['level'])
            visitor.level = level
            visitor.save()

        return user, visitor

    def update_teacher_subjects(self, teacher, subjects):
        print(f"Updating subjects for teacher: {teacher}")
        current_subjects = set(teacher.subjects.values_list('name', flat=True))
        new_subjects = set(subjects)

        for subject_name in new_subjects - current_subjects:
            subject, _ = Subject.objects.get_or_create(name=subject_name)
            teacher.subjects.add(subject)
            print(f"Added subject: {subject}")

        for subject_name in current_subjects - new_subjects:
            subject = Subject.objects.get(name=subject_name)
            teacher.subjects.remove(subject)
            print(f"Removed subject: {subject}")
class SSOLoginView(APIView):
    def get(self, request):
        institution_id = request.GET.get('institution_id')
        sso_token = request.GET.get('sso_token')
        
        if not institution_id or not sso_token:
            return Response({"error": "Missing parameters"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            institution = Institution.objects.get(id=institution_id, is_active=True)
        except Institution.DoesNotExist:
            return Response({"error": "Invalid institution"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user, user_type = self.validate_sso_token(sso_token, institution)
            if user:
                login(request, user)
                return self.get_redirect_response(user_type)
            else:
                return Response({"error": "Invalid SSO token"}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

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
            raise ValueError(f"Invalid token: {str(e)}")

    def get_redirect_response(self, user_type):
        if user_type == 'teacher' or user_type == 'visitor':
            redirect_url = reverse('monEspace:espacenote')
        else:
            return Response({"error": "Invalid user type"}, status=status.HTTP_400_BAD_REQUEST)

        return redirect(redirect_url)

from django.http import HttpResponse, QueryDict
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect
from django.urls import reverse
from .models import Institution
import json

@csrf_exempt
def fake_sso_endpoint(request):
    if request.method != 'POST':
        return HttpResponse("Method not allowed", status=405)
    
    print("fake_sso_endpoint called")
    print(f"Original POST data: {request.POST}")
    
    try:
        institution_id = request.POST.get('institution_id')
        print(f"Institution ID: {institution_id}")
        
        institution = Institution.objects.get(id=institution_id)
        print(f"Institution found: {institution}")
        
        user_data = {
            'institution_user_id': 'TEST001',
            'civilite': 'Monsieur',
            'first_name': 'Test',
            'last_name': 'User',
            'email': 'test.user@universite-test.com'
        }
        
        # Créer un nouveau QueryDict avec les données mises à jour
        new_data = QueryDict('', mutable=True)
        new_data.update(request.POST)
        new_data.update({
            'auth_key': institution.auth_key,
            'user_type': 'teacher',
            'user_data': json.dumps(user_data)
        })
        
        print(f"Updated POST data: {new_data}")

        # Créer une nouvelle requête avec les données mises à jour
        request.POST = new_data
        request.data = new_data

        view = InstitutionSSOView.as_view()
        response = view(request)
        
        print(f"InstitutionSSOView response: {response.status_code} - {response.data}")
        
        if response.status_code == 200:
            response_data = response.data
            sso_token = response_data.get('sso_token')
            return redirect(reverse('accounts:sso_login') + f'?institution_id={institution.id}&sso_token={sso_token}')
        else:
            return HttpResponse(f"Erreur lors de l'authentification SSO: {response.data}", status=400)
    except Exception as e:
        error_message = f"Une erreur s'est produite : {str(e)}"
        print(error_message)
        import traceback
        print(traceback.format_exc())
        return HttpResponse(error_message, status=500)