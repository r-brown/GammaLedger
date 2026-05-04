FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy

RUN pip install --no-cache-dir uv

WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/src ./src
COPY backend/alembic.ini ./
COPY backend/alembic ./alembic

RUN uv pip install --system --no-cache .

EXPOSE 8765
CMD ["uvicorn", "gammaledger.main:app", "--host", "0.0.0.0", "--port", "8765"]
