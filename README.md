# Energie-Tracker

Weboberfläche zum Erfassen und Auswerten von Strom-, Gas- und Wasserzählerständen. Die App speichert Messwerte, Zählernummern, Zählerhistorie und Anbieterdaten als JSON-Dateien unter `/app/data`.

## Installation mit Portainer

Das Container-Image wird als `ghcr.io/gedankenstrom/energy-tracker:latest` veröffentlicht. Das Daten-Volume `energy_data` bleibt beim Ersetzen des Containers erhalten. Entferne das Volume nicht, wenn die gespeicherten Messwerte behalten werden sollen.

In Portainer **Stacks → Add stack → Git Repository** auswählen und eintragen:

- Repository: `https://github.com/gedankenstrom/energy-tracker`
- Branch: `main`
- Compose path: `compose.yaml`

Lege im Abschnitt **Environment variables** die folgenden Variablen an. Sie enthalten Zugangsdaten und dürfen nicht ins Repository eingecheckt werden.

| Variable | Wert |
| --- | --- |
| `AUTH_USERNAME` | Anmeldename für die Webseite |
| `AUTH_PASSWORD` | eigenes Passwort, mindestens 12 Zeichen |
| `SESSION_SECRET` | zufälliger, geheimer Schlüssel, mindestens 32 Zeichen |
| `HA_API_TOKEN` | eigener Token für Home Assistant, mindestens 32 Zeichen |
| `SESSION_COOKIE_SECURE` | `false` bei direktem HTTP-Zugriff; `true` bei HTTPS |
| `TRUST_PROXY` | `false` ohne Reverse Proxy; `true` bei HTTPS hinter einem Reverse Proxy |

Erzeuge für `SESSION_SECRET` und `HA_API_TOKEN` jeweils einen eigenen Zufallswert, zum Beispiel mit:

```sh
openssl rand -hex 32
```

Die Stack-Konfiguration lautet:

```yaml
version: '3.8'

services:
  energy-tracker:
    image: ghcr.io/gedankenstrom/energy-tracker:latest
    container_name: energy-tracker-new
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
      - TRUST_PROXY=${TRUST_PROXY:-false}
    volumes:
      - energy_data:/app/data

volumes:
  energy_data:
```

Nach dem Deploy ist die Webseite unter `http://<IP-deines-Servers>:9092` erreichbar. Melde dich mit `AUTH_USERNAME` und `AUTH_PASSWORD` an. Bei direktem Zugriff über HTTP sollte die App nur im vertrauenswürdigen Heimnetz erreichbar sein.

## Home Assistant

Die Webseite und alle normalen API-Endpunkte verlangen eine Anmeldung. Home Assistant kann mit `HA_API_TOKEN` weiterhin lesend auf diese beiden Endpunkte zugreifen:

- `/api/consumption-stats`
- `/api/providers`

Trage in Home Assistants `secrets.yaml` den Token mit `Bearer ` davor ein. Ersetze den Platzhalter durch denselben Wert wie `HA_API_TOKEN` in Portainer:

```yaml
energy_tracker_ha_token: "Bearer DEIN_HA_API_TOKEN"
```

Füge bei **jedem REST-Sensor**, der Daten vom Energie-Tracker liest, den Header auf derselben Ebene wie `resource` hinzu:

```yaml
headers:
  Authorization: !secret energy_tracker_ha_token
```

Danach Home Assistants REST-Konfiguration neu laden (`rest.reload`). Zur Kontrolle sollten die Sensoren in **Entwicklerwerkzeuge → Zustände** Werte statt `unavailable` anzeigen. Ein direkter Aufruf der API im Browser ohne Login oder Authorization-Header liefert erwartungsgemäß `401 Unauthorized`.

## Updates und Veröffentlichung

GitHub Actions baut und veröffentlicht das Image bei jedem Push auf `main`, sowohl mit dem Tag `latest` als auch mit dem Commit-Tag. Damit Portainer das Image ohne Registry-Anmeldung laden kann, muss das GitHub-Paket `energy-tracker` öffentlich sein.

Nach einem Update des Stacks in Portainer **Re-pull image** beziehungsweise **Pull latest image** aktivieren, damit die neue Version geladen wird.

## Lokal starten

Voraussetzung: Node.js 18 oder neuer. Die App benötigt auch lokal `AUTH_USERNAME`, `AUTH_PASSWORD`, `SESSION_SECRET` und `HA_API_TOKEN`:

```sh
npm install
export AUTH_USERNAME=admin
export AUTH_PASSWORD='eigenes-sicheres-passwort'
export SESSION_SECRET="$(openssl rand -hex 32)"
export HA_API_TOKEN="$(openssl rand -hex 32)"
npm start
```

Der Server läuft standardmäßig auf Port `3000`. JSON-Datendateien werden automatisch unter `data/` angelegt.
