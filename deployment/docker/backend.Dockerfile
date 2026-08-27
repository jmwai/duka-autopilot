FROM ghcr.io/astral-sh/uv:0.11.13 AS uv
FROM python:3.12.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8080

COPY --from=uv /uv /usr/local/bin/uv

RUN groupadd --system --gid 10001 duka \
    && useradd --system --uid 10001 --gid duka --home-dir /app duka

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-editable

COPY --chown=duka:duka agents ./agents
COPY --chown=duka:duka app ./app
COPY --chown=duka:duka deployment/compatibility.json ./deployment/compatibility.json

USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
