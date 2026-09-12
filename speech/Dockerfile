FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
ARG VOSK_MODEL_URL=https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip
COPY download_model.py .
RUN python download_model.py "$VOSK_MODEL_URL"
COPY server.py .
ARG VOCORA_SOURCE_HASH=manual
LABEL ir.vocora.source-hash="${VOCORA_SOURCE_HASH}"
USER 65534:65534
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=3)"
CMD ["python", "server.py"]
