from django.shortcuts import render, redirect
from django.core.mail import send_mail
from django.contrib import messages

from django.conf import settings

from accounts.models import Institution
from .forms import InstitutionContactForm

try:
    from django.core.files.storage import get_storage_class
except ImportError:
    try:
        from django.core.files.storage import storages
        get_storage_class = storages.get_storage_class
    except AttributeError:
        from django.core.files.storage import Storage
        def get_storage_class(import_path=None):
            return Storage

# Create your views here.

def product_view(request):
    return render(request, 'monFocusprof/product.html')

# def index(request):
#     return render(request, "monFocusprof/index.html")

import logging
from django.shortcuts import render

logger = logging.getLogger(__name__)

def index(request):
    try:
        partners = Institution.objects.filter(is_active=True, is_partner=True).order_by('partner_order', 'name')
        
        # Pas besoin de boucle pour logo_url, c'est une propriété calculée
        
        return render(request, 'monFocusprof/index.html', {'partners': partners})
    except Exception as e:
        logger.error(f"Erreur dans la vue index: {str(e)}")
        return render(request, 'monFocusprof/index.html', {'partners': [], 'error': "Une erreur s'est produite lors du chargement des partenaires."})


from django.http import JsonResponse

def institution_contact_view(request):
    if request.method == 'POST':
        form = InstitutionContactForm(request.POST)
        if form.is_valid():
            # Récupérer les données du formulaire
            institution_name = form.cleaned_data['institution_name']
            contact_name = form.cleaned_data['contact_name']
            email = form.cleaned_data['email']
            institution_type = form.cleaned_data['institution_type']
            message = form.cleaned_data['message']

            send_mail(
                f'Nouvelle demande de collaboration de {institution_name}',
                f"""
                Nom de l'institution : {institution_name}
                Nom du contact : {contact_name}
                Email : {email}
                Type d'institution : {institution_type}
                Message : {message}
                """,
                settings.DEFAULT_FROM_EMAIL,
                [settings.DEFAULT_FROM_EMAIL],
                fail_silently=False,
            )
            # E-mail de confirmation pour l'institution
            send_mail(
                'Confirmation de votre demande de collaboration',
                f"""
                Cher/Chère {contact_name},

                Nous vous remercions pour votre demande de collaboration avec {institution_name}.

                Nous avons bien reçu votre message et nous vous contacterons dans les plus brefs délais.

                Cordialement,
                L'équipe de monFocus
                """,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
            return JsonResponse({'success': True})

    else:
        form = InstitutionContactForm()

    context = {
        'form': form,
    }
    return render(request, 'monFocusprof/about.html', context)