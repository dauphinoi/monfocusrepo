# Generated by Django 5.0.6 on 2024-07-29 12:49

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0007_remove_teacher_birth_date_teacher_institution_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="teacher",
            name="birth_date",
            field=models.DateField(blank=True, null=True),
        ),
    ]
