# Generated by Django 5.0.6 on 2024-07-29 12:46

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0006_institution_visitor_institution_user_id_and_more"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="teacher",
            name="birth_date",
        ),
        migrations.AddField(
            model_name="teacher",
            name="institution",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="teachers",
                to="accounts.institution",
            ),
        ),
        migrations.AddField(
            model_name="teacher",
            name="institution_user_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name="teacher",
            name="city",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AlterField(
            model_name="teacher",
            name="phone_number",
            field=models.CharField(blank=True, max_length=20, null=True),
        ),
        migrations.AlterField(
            model_name="teacher",
            name="status",
            field=models.CharField(
                blank=True,
                choices=[
                    ("enseignant", "Je suis enseignant(e) en activité"),
                    ("retraite", "Je suis enseignant(e) à la retraite"),
                    ("etudiant", "Je suis étudiant(e)"),
                    ("salarie", "Je suis salarié(e) ou indépendant(e)"),
                    ("autre", "J'ai un autre profil"),
                ],
                max_length=20,
            ),
        ),
    ]
