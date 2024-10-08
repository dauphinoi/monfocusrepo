# Generated by Django 5.0.7 on 2024-08-13 21:17

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0009_institution_sso_url"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="institution",
            options={
                "ordering": ["partner_order", "name"],
                "verbose_name": "Institution",
                "verbose_name_plural": "Institutions",
            },
        ),
        migrations.AddField(
            model_name="institution",
            name="description",
            field=models.TextField(blank=True, verbose_name="Description"),
        ),
        migrations.AddField(
            model_name="institution",
            name="is_partner",
            field=models.BooleanField(default=False, verbose_name="Est un partenaire"),
        ),
        migrations.AddField(
            model_name="institution",
            name="logo",
            field=models.ImageField(
                blank=True,
                null=True,
                upload_to="institution_logos/",
                verbose_name="Logo",
            ),
        ),
        migrations.AddField(
            model_name="institution",
            name="partner_order",
            field=models.PositiveIntegerField(
                default=0, verbose_name="Ordre d'affichage (partenaire)"
            ),
        ),
        migrations.AddField(
            model_name="institution",
            name="website",
            field=models.URLField(blank=True, verbose_name="Site web"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="auth_key",
            field=models.CharField(
                max_length=255, unique=True, verbose_name="Clé d'API"
            ),
        ),
        migrations.AlterField(
            model_name="institution",
            name="contact_name",
            field=models.CharField(max_length=100, verbose_name="Nom du contact"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True, verbose_name="Date de création"
            ),
        ),
        migrations.AlterField(
            model_name="institution",
            name="email",
            field=models.EmailField(max_length=254, verbose_name="Email"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="is_active",
            field=models.BooleanField(default=False, verbose_name="Actif"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="name",
            field=models.CharField(max_length=100, verbose_name="Nom"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="sso_url",
            field=models.URLField(max_length=255, verbose_name="URL de connexion SSO"),
        ),
        migrations.AlterField(
            model_name="institution",
            name="type",
            field=models.CharField(
                choices=[
                    ("soutien_scolaire", "Soutien scolaire"),
                    ("education_superieur", "Éducation supérieur"),
                    ("formation_pro", "Formation professionnelle"),
                    ("autre", "Autre"),
                ],
                max_length=50,
                verbose_name="Type",
            ),
        ),
    ]
