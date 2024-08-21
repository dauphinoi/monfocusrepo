from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from django.core.files.storage import Storage
from urllib.parse import urljoin
import boto3
from botocore.exceptions import ClientError

class MediaStorage(S3Boto3Storage):
    location = settings.AWS_MEDIA_LOCATION
    default_acl = 'public-read'
    file_overwrite = False

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.client = boto3.client('s3',
                                   aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                                   aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                                   region_name=settings.AWS_S3_REGION_NAME)

    def exists(self, name):
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return True
        except ClientError:
            return False

    def url(self, name):
        return urljoin(settings.MEDIA_URL, name)

    def size(self, name):
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return response['ContentLength']
        except ClientError:
            raise ValueError("File not found")

    def get_modified_time(self, name):
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=self._normalize_name(self._clean_name(name)))
            return response['LastModified']
        except ClientError:
            raise ValueError("File not found")

    get_created_time = get_modified_time

    def get_accessed_time(self, name):
        # S3 doesn't track access time, so we return modified time
        return self.get_modified_time(name)

    def path(self, name):
        # S3 doesn't use local file paths
        return None

class StaticStorage(S3Boto3Storage):
    location = settings.AWS_STATIC_LOCATION
    default_acl = 'public-read'