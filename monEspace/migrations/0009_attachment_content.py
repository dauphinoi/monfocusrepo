# Generated by Django 5.0.6 on 2024-07-21 10:50

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("monEspace", "0008_chatsession_chatmessage"),
    ]

    operations = [
        migrations.AddField(
            model_name="attachment",
            name="content",
            field=models.TextField(blank=True, null=True),
        ),
    ]
