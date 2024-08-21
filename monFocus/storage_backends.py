from django.conf import settings
from storages.backends.s3boto3 import S3Boto3Storage
from urllib.parse import urljoin
import posixpath
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

    def _clean_name(self, name):
        """
        Cleans the name so that Windows style paths work
        """
        # Normalize Windows style paths
        clean_name = posixpath.normpath(name).replace('\\', '/')

        # os.path.normpath() can strip trailing slashes so we implement
        # a workaround here.
        if name.endswith('/') and not clean_name.endswith('/'):
            # Add a trailing slash as it was stripped.
            clean_name += '/'
        return clean_name

    def _normalize_name(self, name):
        """
        Normalizes the name so that paths like /path/to/ignored/../foo.txt
        work. We check to make sure that the path pointed to is not outside
        the directory specified by the LOCATION setting.
        """
        base_path = self.location
        base_path = base_path.rstrip('/')

        final_path = posixpath.normpath(posixpath.join(base_path, name))
        base_path_len = len(base_path)
        if (not final_path.startswith(base_path) or
                final_path[base_path_len:base_path_len + 1] not in ('', '/')):
            raise ValueError("Attempted access to '%s' denied." % name)
        return final_path.lstrip('/')

    def exists(self, name):
        name = self._normalize_name(self._clean_name(name))
        try:
            self.client.head_object(Bucket=self.bucket_name, Key=name)
            return True
        except ClientError:
            return False

    def url(self, name):
        return urljoin(settings.MEDIA_URL, name)

    def size(self, name):
        name = self._normalize_name(self._clean_name(name))
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=name)
            return response['ContentLength']
        except ClientError:
            raise ValueError("File not found")

    def get_modified_time(self, name):
        name = self._normalize_name(self._clean_name(name))
        try:
            response = self.client.head_object(Bucket=self.bucket_name, Key=name)
            return response['LastModified']
        except ClientError:
            raise ValueError("File not found")

    get_created_time = get_modified_time

    def get_accessed_time(self, name):
        return self.get_modified_time(name)

    def path(self, name):
        return None

class StaticStorage(S3Boto3Storage):
    location = settings.AWS_STATIC_LOCATION
    default_acl = 'public-read'