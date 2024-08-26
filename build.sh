#!/usr/bin/env bash
python -m pip install --upgrade pip
pip install -r requirements.txt
python nltk_download.py
python manage.py collectstatic --no-input
python manage.py migrate