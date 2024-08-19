#!/usr/bin/env bash
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install -U django-storages
pip install -U boto3
python nltk_download.py
python manage.py collectstatic --no-input
python manage.py migrate