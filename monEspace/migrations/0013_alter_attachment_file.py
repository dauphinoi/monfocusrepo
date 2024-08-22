# Generated by Django 5.0.7 on 2024-08-22 10:07

import monEspace.models
import monFocus.storage_backends
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monEspace", "0012_remove_note_embedding"),
    ]

    operations = [
        migrations.AlterField(
            model_name="attachment",
            name="file",
            field=models.FileField(
                storage=monFocus.storage_backends.MediaStorage(),
                upload_to=monEspace.models.attachment_file_path,
            ),
        ),
    ]
