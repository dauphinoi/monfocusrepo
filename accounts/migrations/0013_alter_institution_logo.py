# Generated by Django 5.0.7 on 2024-08-20 00:45

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0012_alter_institution_logo"),
    ]

    operations = [
        migrations.AlterField(
            model_name="institution",
            name="logo",
            field=models.FileField(
                blank=True, null=True, upload_to="institution_logos/"
            ),
        ),
    ]
