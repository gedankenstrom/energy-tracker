# Energie-Tracker

Weboberfläche zum Erfassen und Auswerten von Strom-, Gas- und Wasserzählerständen. Der Server speichert Einträge, Zählernummern, Zählerhistorie und Anbieterdaten im Ordner `data/`.

## Mit Docker Compose starten

Voraussetzung: Docker mit Docker Compose.

```sh
docker compose up -d --build
```

Anschließend ist die Anwendung unter [http://localhost:9092](http://localhost:9092) erreichbar. Die Daten bleiben im Docker-Volume `energy_data` erhalten, auch wenn der Container neu erstellt wird.

Zum Stoppen:

```sh
docker compose down
```

`READING_DAY` steuert den konfigurierten Ablesetag (Standard in `compose.yaml`: `1`).

## Lokal starten

Voraussetzung: Node.js 18 oder neuer.

```sh
npm install
npm start
```

Die Anwendung läuft dann auf Port 3000. Die JSON-Datendateien werden automatisch unter `data/` angelegt.
