from django import template
from django.utils.safestring import mark_safe

register = template.Library()

@register.filter(name='get_subject_icon')
def get_subject_icon(subject_name):
    icons = {
        'Mathématiques': '🧮',
        'Français': '📚',
        'Anglais': '🇬🇧',
        'Physique': '⚛️',
        'Chimie': '🧪',
        'Aide aux devoirs': '📝',
        'Allemand': '🇩🇪',
        'Comptabilité': '💼',
        'Droit': '⚖️',
        'Économie': '📊',
        'Histoire': '🏛️',
        'Coaching': '🏆',
        'Orientation': '🧭',
        'Espagnol': '🇪🇸',
        'SVT/Biologie': '🧬',
        'SVT': '🧬',
        'Cours de musique': '🎵'
    }
    return mark_safe(icons.get(subject_name, '📚'))