# Builds the website, then packages it with the Python API in one image.
FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.13-slim
WORKDIR /srv
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./backend
COPY --from=web /web/dist ./frontend/dist
WORKDIR /srv/backend
ENV MHD_STATIC_DIR=/srv/frontend/dist
EXPOSE 8000
CMD ["sh", "-c", "python -m app.wait_and_seed && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
