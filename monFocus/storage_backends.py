from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from urllib.parse import urljoin
from django.core.exceptions import SuspiciousOperation
import os

class StaticStorage(S3Boto3Storage):
    location = settings.AWS_STATIC_LOCATION
    default_acl = None

class MediaStorage(S3Boto3Storage):
    location = settings.AWS_MEDIA_LOCATION
    default_acl = None
    file_overwrite = False

    def url(self, name):
        return urljoin(settings.MEDIA_URL, name)

    def exists(self, name):
        try:
            self.connection.meta.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return True
        except:
            return False

    def size(self, name):
        try:
            obj = self.connection.meta.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return int(obj['ContentLength'])
        except:
            raise SuspiciousOperation("Size not available.")

    def modified_time(self, name):
        try:
            obj = self.connection.meta.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return obj['LastModified']
        except:
            raise SuspiciousOperation("Modification time not available.")

    def get_accessed_time(self, name):
        return None

    def get_created_time(self, name):
        return None

    def path(self, name):
        return None