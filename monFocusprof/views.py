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

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

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

            # Contexte pour les templates d'e-mail
            context = {
                'institution_name': institution_name,
                'contact_name': contact_name,
                'email': email,
                'institution_type': institution_type,
                'message': message,
            }

            # Email pour l'équipe monFocus
            team_html_content = render_to_string('monFocusprof/monfocus_team_email.html', context)
            team_text_content = strip_tags(team_html_content)

            msg_team = EmailMultiAlternatives(
                f'Nouvelle demande de collaboration de {institution_name}',
                team_text_content,
                settings.DEFAULT_FROM_EMAIL,
                [settings.DEFAULT_FROM_EMAIL]
            )
            msg_team.attach_alternative(team_html_content, "text/html")
            msg_team.send()

            # Email de confirmation pour l'institution (utilisant le template précédemment créé)
            institution_html_content = render_to_string('monFocusprof/institution_contact_email.html', context)
            institution_text_content = strip_tags(institution_html_content)

            msg_institution = EmailMultiAlternatives(
                'Confirmation de votre demande de collaboration - monFocus',
                institution_text_content,
                settings.DEFAULT_FROM_EMAIL,
                [email]
            )
            msg_institution.attach_alternative(institution_html_content, "text/html")
            msg_institution.send()

            return JsonResponse({'success': True})

    else:
        form = InstitutionContactForm()

    context = {
        'form': form,
    }
    return render(request, 'monFocusprof/about.html', context)