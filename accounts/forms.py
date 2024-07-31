from django import forms
from django.contrib.auth.forms import AuthenticationForm
from django.utils.translation import gettext_lazy as _

class CustomAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label=_("Identifiant"),
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Votre identifiant'
        })
    )
    password = forms.CharField(
        label=_("Mot de passe"),
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Votre mot de passe'
        })
    )
    remember_me = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(),
        label=_("Rester connecté")
    )


class Step1Form(forms.Form):
    profile_type = forms.ChoiceField(
        choices=[
            ('enseignant', 'Je suis enseignant(e) en activité'),
            ('retraite', 'Je suis enseignant(e) à la retraite'),
            ('etudiant', 'Je suis étudiant(e)'),
            ('salarie', 'Je suis salarié(e) ou indépendant(e)'),
            ('autre', 'J\'ai un autre profil')
        ],
        widget=forms.RadioSelect
    )

class Step2Form(forms.Form):
    subjects = forms.MultipleChoiceField(
        choices=[
            (1, 'Mathématiques'),
            (2, 'Français'),
            (3, 'Anglais'),
            (4, 'Physique'),
            (5, 'Chimie'),
            (6, 'Aide aux devoirs'),
            (7, 'Allemand'),
            (8, 'Comptabilité'),
            (9, 'Droit'),
            (10, 'Économie'),
            (11, 'Histoire'),
            (12, 'Coaching'),
            (13, 'Orientation'),
            (14, 'Espagnol'),
            (15, 'SVT/Biologie'),
            (16, 'Cours de musique')
        ],
        widget=forms.CheckboxSelectMultiple
    )

class Step3Form(forms.Form):
    niveaux = forms.MultipleChoiceField(
        choices=[
            (1, 'Primaire'),
            (2, 'Collège'),
            (3, 'Lycée'),
            (4, 'Supérieur')
        ],
        widget=forms.CheckboxSelectMultiple
    )

class Step4Form(forms.Form):
    bac3 = forms.ChoiceField(
        choices=[('oui', 'Oui'), ('non', 'Non')],
        widget=forms.RadioSelect
    )
    cv = forms.FileField(required=False)
    dernier_diplome = forms.CharField(max_length=100, required=False)

class Step5Form(forms.Form):
    civilite = forms.ChoiceField(
        choices=[(1, 'Madame'), (2, 'Monsieur')],
        widget=forms.RadioSelect
    )
    prenom = forms.CharField(max_length=100, label='Prénom')
    nom = forms.CharField(max_length=100, label='Nom')
    date_naissance = forms.DateField(widget=forms.DateInput(format='%d/%m/%Y'))
    ville = forms.CharField(max_length=100)
    email = forms.EmailField(label='Adresse e-mail')
    telephone = forms.CharField(max_length=15)


# forms pour souhaitant des cours
class NiveauScolaireForm(forms.Form):
    NIVEAUX = [
        ('Terminale', 'Terminale'),
        ('1re', '1re'),
        ('2de', '2de'),
        ('3e', '3e'),
        ('4e', '4e'),
        ('5e', '5e'),
        ('6e', '6e'),
        ('CM2', 'CM2'),
        ('CM1', 'CM1'),
        ('CE2', 'CE2'),
        ('CE1', 'CE1'),
        ('CP', 'CP'),
        ('Supérieur', 'Supérieur'),
    ]
    niveau = forms.ChoiceField(choices=NIVEAUX, widget=forms.RadioSelect)

class MatieresForm(forms.Form):
    MATIERES = [
        ('Mathématiques', 'Mathématiques'),
        ('Français', 'Français'),
        ('Physique', 'Physique'),
        ('Anglais', 'Anglais'),
        ('Chimie', 'Chimie'),
        ('Méthodologie', 'Méthodologie'),
        ('SVT', 'SVT'),
        ('Espagnol', 'Espagnol'),
    ]
    matieres = forms.MultipleChoiceField(choices=MATIERES, widget=forms.CheckboxSelectMultiple)

class AccompagnementForm(forms.Form):
    TYPES_COURS = [
        ('Cours à domicile', 'Cours à domicile'),
        ('Cours hebdomadaire en centre (près de chez vous)', 'Cours hebdomadaire en centre (près de chez vous)'),
        ('Stage de vacances', 'Stage de vacances'),
        ('Cours en ligne (avec un prof en visio)', 'Cours en ligne (avec un prof en visio)'),
        ('Je ne sais pas et souhaite être conseillé(e)', 'Je ne sais pas et souhaite être conseillé(e)'),
    ]
    types_cours = forms.MultipleChoiceField(choices=TYPES_COURS, widget=forms.CheckboxSelectMultiple)

from .utils import email_exists

class EmailValidationMixin:
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email_exists(email):
            raise forms.ValidationError("Cette adresse e-mail est déjà utilisée.")
        return email

class CoordonneeForm(forms.Form):
    CIVILITE_CHOICES = [('Madame', 'Madame'), ('Monsieur', 'Monsieur')]
    civilite = forms.ChoiceField(choices=CIVILITE_CHOICES, widget=forms.RadioSelect)
    prenom = forms.CharField(max_length=100)
    nom = forms.CharField(max_length=100)
    email = forms.EmailField()
    ville_ou_code_postal = forms.CharField(max_length=100)
    telephone = forms.CharField(max_length=20)
