release: python backend/manage.py collectstatic --noinput
web: gunicorn backend.config.wsgi:application --bind 0.0.0.0:$PORT