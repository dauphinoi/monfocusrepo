from django import forms

class InstitutionContactForm(forms.Form):
    institution_name = forms.CharField(max_length=100, label="Nom de l'institution")
    contact_name = forms.CharField(max_length=100, label="Nom du contact")
    email = forms.EmailField(label="Votre email professionnel")
    institution_type = forms.ChoiceField(choices=[('type1', 'Soutien scolaire'), ('type2', 'Éducation supérieur'), ('type3', 'Formation pro'), ('type4', 'Autre')], label="Type d'institution")
    message = forms.CharField(widget=forms.Textarea, label="Message")