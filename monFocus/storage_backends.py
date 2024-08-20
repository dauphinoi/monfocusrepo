from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage

class StaticStorage(S3Boto3Storage):
    location = settings.AWS_STATIC_LOCATION
    default_acl = None  # Désactive l'utilisation des ACLs

class MediaStorage(S3Boto3Storage):
    location = settings.AWS_MEDIA_LOCATION
    default_acl = None  # Désactive l'utilisation des ACLs
    file_overwrite = False

    def get_accessed_time(self, name):
        return None

    def get_created_time(self, name):
        return None

    def path(self, name):
        return None