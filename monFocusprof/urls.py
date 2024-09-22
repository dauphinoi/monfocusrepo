from django.urls import path, include

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path('institution-contact/', views.institution_contact_view, name='institution_contact'),
    path('product/', views.product_view, name='product'),
]