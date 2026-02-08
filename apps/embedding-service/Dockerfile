FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir fastapi uvicorn sentence-transformers torch --extra-index-url https://download.pytorch.org/whl/cpu

COPY main.py .

EXPOSE 8001

CMD ["uvicorn", "main.py:app", "--host", "0.0.0.0", "--port", "8001"]
