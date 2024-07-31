# Generated by Django 5.0.6 on 2024-07-12 09:55

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
        ("monEspace", "0003_note_embedding"),
    ]

    operations = [
        migrations.AddField(
            model_name="note",
            name="est_partagee",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="note",
            name="subject",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="notes",
                to="accounts.subject",
            ),
        ),
    ]
