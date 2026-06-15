"""
wsgi.py — ponto de entrada para Gunicorn em produção.

Uso:
    gunicorn wsgi:application -w 4 -b 0.0.0.0:5000
"""

from app import app, init_db

init_db()
application = app
