from django.contrib.auth.models import User

def email_exists(email):
    return User.objects.filter(email=email).exists()