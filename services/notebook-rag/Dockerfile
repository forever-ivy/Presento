FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      libreoffice \
      git \
      nodejs \
      npm \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --default-timeout=1000 --retries=20 -r requirements.txt
RUN npm install -g repomix

COPY app ./app

EXPOSE 8011
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8011"]
