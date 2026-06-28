FROM python:3.12-slim

WORKDIR /app

# Orchid Pharmed Nexus PyPI proxy (on-prem). Comment out for open-internet builds.
ENV PIP_INDEX_URL=https://nexus.orchidpharmed.com/repository/pip-proxy/simple
ENV PIP_TRUSTED_HOST=nexus.orchidpharmed.com

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/var/uploads

EXPOSE 5000

CMD ["gunicorn", "-c", "gunicorn.conf.py", "run:app"]
