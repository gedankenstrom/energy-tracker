# Energie-Tracker

Weboberfläche zum Erfassen und Auswerten von Strom-, Gas- und Wasserzählerständen. Der Server speichert Einträge, Zählernummern, Zählerhistorie und Anbieterdaten im Ordner `data/`.

## Als Portainer-Stack starten

In Portainer unter **Stacks → Add stack → Git Repository** einen Stack anlegen:

- Repository URL: `https://github.com/gedankenstrom/energy-tracker`
- Repository reference: `main`
- Compose path: `compose.yaml`
- **Enable relative path volumes** aktivieren, damit Portainer `server.js`, `index.html` und `package.json` aus dem geklonten Repository einbindet.

Dann den Stack deployen. Die Anwendung ist unter [http://localhost:9092](http://localhost:9092) erreichbar.

Die Messdaten bleiben im Docker-Volume `energy_data` erhalten, auch wenn der Container neu erstellt wird. Der Stack installiert beim Start die Abhängigkeiten aus `package.json`.

## Mit Docker Compose starten

Voraussetzung: Docker mit Docker Compose. Im Projektordner ausführen:

```sh
docker compose up -d
```

Anschließend ist die Anwendung unter [http://localhost:9092](http://localhost:9092) erreichbar. Die Daten bleiben im Docker-Volume `energy_data` erhalten.

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
