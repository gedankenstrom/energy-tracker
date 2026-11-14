# Energie-Tracker

Weboberfläche zum Erfassen und Auswerten von Strom-, Gas- und Wasserzählerständen. Der Server speichert Einträge, Zählernummern, Zählerhistorie und Anbieterdaten im Ordner `/app/data`.

## Portainer-Stack

Der Stack verwendet das Container-Image `ghcr.io/gedankenstrom/energy-tracker:latest` und speichert die Anwendungsdaten im Docker-Volume `energy_tracker_data`.

In Portainer unter **Stacks → Add stack** den Stack-Namen `energy-tracker` eintragen, dann die Datei `compose.yaml` aus diesem Repository als Stack-Definition verwenden. Alternativ den Inhalt der Compose-Datei in den Web-Editor kopieren.

Nach dem Start ist die Anwendung auf Port `9302` erreichbar. `READING_DAY` kann in der Stack-Definition angepasst werden.

## Image-Veröffentlichung

GitHub Actions baut und veröffentlicht das Image bei jedem Push auf `main` nach GHCR. Nach dem ersten erfolgreichen Workflow-Lauf muss das Paket `energy-tracker` in GitHub unter **Packages → Package settings → Change visibility** auf **Public** gesetzt werden, damit Portainer das Image ohne Registry-Anmeldung herunterladen kann.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer.

```sh
npm install
npm start
```

Die Anwendung läuft standardmäßig auf Port 9302. Die JSON-Datendateien werden automatisch unter `data/` angelegt.
