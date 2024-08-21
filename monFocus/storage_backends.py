from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from urllib.parse import urljoin
import posixpath
import boto3
from botocore.exceptions import ClientError

class MediaStorage(S3Boto3Storage):
    location = 'media'
    default_acl = None  # Désactive l'utilisation des ACLs
    file_overwrite = False
    bucket_name = settings.AWS_STORAGE_BUCKET_NAME
    custom_domain = settings.AWS_S3_CUSTOM_DOMAIN

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client = boto3.client('s3',
                                   aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                                   aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                                   region_name=settings.AWS_S3_REGION_NAME)

    def _clean_name(self, name):
        return posixpath.normpath(name).replace('\\', '/')

    def _normalize_name(self, name):
        base_path = self.location.rstrip('/')
        name = self._clean_name(name)
        return posixpath.normpath(posixpath.join(base_path, name)).lstrip('/')

    def exists(self, name):
        name = self._normalize_name(name)
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=name)
            return True
        except ClientError:
            return False
    
    def url(self, name):
        return urljoin(f'https://{self.custom_domain}/', self._normalize_name(name))

    def size(self, name):
        name = self._normalize_name(name)
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=name)
            return response['ContentLength']
        except ClientError:
            raise ValueError("File not found")

    def get_modified_time(self, name):
        name = self._normalize_name(name)
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=name)
            return response['LastModified']
        except ClientError:
            raise ValueError("File not found")

    get_created_time = get_modified_time
    get_accessed_time = get_modified_time

    def path(self, name):
        return None

class StaticStorage(S3Boto3Storage):
    location = settings.AWS_STATIC_LOCATION
    default_acl = None  # Désactive l'utilisation des ACLs