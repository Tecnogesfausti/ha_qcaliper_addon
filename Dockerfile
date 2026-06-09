FROM python:3.12-alpine

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1     PYTHONUNBUFFERED=1     PORT=8080     RESULTS_DIR=/data/resultados     HA_URL=http://supervisor/core

RUN apk add --no-cache bash curl ca-certificates && update-ca-certificates

COPY . /app

RUN chmod +x /app/run.sh

EXPOSE 8080

CMD ["/app/run.sh"]
