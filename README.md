# Energie-Tracker

Weboberfläche zum Erfassen und Auswerten von Strom-, Gas- und Wasserzählerständen. Der Server speichert Einträge, Zählernummern, Zählerhistorie und Anbieterdaten im Ordner `/app/data`.

## Portainer-Stack

Der Stack verwendet das Container-Image `ghcr.io/gedankenstrom/energy-tracker:latest` und speichert die Anwendungsdaten im Docker-Volume `energy_data`.

In Portainer unter **Stacks → Add stack** den Stack-Namen `energy-tracker` eintragen und die Datei `compose.yaml` aus diesem Repository auswählen. Lege im Abschnitt **Environment variables** diese Werte an:

- `AUTH_USERNAME`: Anmeldename für die Webseite
- `AUTH_PASSWORD`: starkes Passwort für die Webseite
- `SESSION_SECRET`: geheimer Session-Schlüssel, mindestens 32 Zeichen
- `HA_API_TOKEN`: eigener API-Schlüssel für Home Assistant, mindestens 32 Zeichen
- `SESSION_COOKIE_SECURE`: `false` bei direktem Zugriff über HTTP; bei HTTPS hinter einem Reverse Proxy `true`
- `TRUST_PROXY`: `true`, wenn HTTPS durch einen Reverse Proxy terminiert wird; sonst `false`

`SESSION_SECRET` und `HA_API_TOKEN` kannst du jeweils mit `openssl rand -hex 32` erzeugen. Speichere die Werte in Portainer und Home Assistant, nicht im GitHub-Repository.

Nach dem Start ist die Webseite auf Port `9092` des Docker-Hosts erreichbar. `READING_DAY` kann in der Stack-Definition angepasst werden.

```yaml
version: '3.8'

services:
  energy-tracker:
    image: ghcr.io/gedankenstrom/energy-tracker:latest
    container_name: energy-tracker
    restart: unless-stopped
    ports:
      - "9092:3000"
    environment:
      - PORT=3000
      - READING_DAY=1
      - AUTH_USERNAME=${AUTH_USERNAME:?Set AUTH_USERNAME in Portainer}
      - AUTH_PASSWORD=${AUTH_PASSWORD:?Set AUTH_PASSWORD in Portainer}
      - SESSION_SECRET=${SESSION_SECRET:?Set SESSION_SECRET in Portainer}
      - HA_API_TOKEN=${HA_API_TOKEN:?Set HA_API_TOKEN in Portainer}
      - SESSION_COOKIE_SECURE=${SESSION_COOKIE_SECURE:-false}
    volumes:
      - energy_data:/app/data

volumes:
  energy_data:
```

## Home Assistant

Die Webseite und alle normalen API-Endpunkte erfordern eine Anmeldung. Home Assistant kann mit `HA_API_TOKEN` weiterhin lesend auf `/api/consumption-stats` und `/api/providers` zugreifen. Schreibe in Home Assistants `secrets.yaml`:

```yaml
energy_tracker_ha_token: "Bearer DEIN_HA_API_TOKEN"
```

Füge bei jedem REST-Sensor, der Energie-Tracker-Daten liest, diesen Header hinzu:

```yaml
headers:
  Authorization: !secret energy_tracker_ha_token
```

Der Wert hinter `Bearer` muss derselbe sein wie `HA_API_TOKEN` in Portainer. Die HA-Sensoren behalten ihre bisherigen URLs und Templates; nur der Header kommt dazu. Der Token erlaubt ausschließlich lesende GET-Abfragen auf die beiden genannten API-Bereiche.

## Image-Veröffentlichung

GitHub Actions baut und veröffentlicht das Image bei jedem Push auf `main` nach GHCR. Nach dem ersten erfolgreichen Workflow-Lauf muss das Paket `energy-tracker` in GitHub unter **Packages → Package settings → Change visibility** auf **Public** gesetzt werden, damit Portainer das Image ohne Registry-Anmeldung herunterladen kann.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer.

```sh
npm install
export AUTH_USERNAME=admin
export AUTH_PASSWORD='set-a-strong-password-here'
export SESSION_SECRET="$(openssl rand -hex 32)"
export HA_API_TOKEN="$(openssl rand -hex 32)"
npm start
```

Die Anwendung läuft standardmäßig auf Port 3000. Die JSON-Datendateien werden automatisch unter `data/` angelegt.
