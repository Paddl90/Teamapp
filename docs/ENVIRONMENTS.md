# Umgebungen und Git-Workflow

## Stufen

| Branch | System | Web | Supabase API | Zweck |
|---|---|---:|---:|---|
| `dev` | DEV | `100.111.63.48:8080` | `100.111.63.48:54321` | laufende Entwicklung |
| `qs` | QS | `100.111.63.48:8180` | `100.111.63.48:55321` | fachliche Abnahme und Regression |
| `prd` | PRD | `100.111.63.48:8280` | `100.111.63.48:56321` | freigegebener Stand |

Alle Adressen sind vorerst nur im privaten Tailscale-Netz erreichbar. Jede Stufe besitzt eigene Supabase-Container, Datenbank-Volumes, Ports und Web-Images. Daten werden nicht zwischen den Stufen geteilt.

## Uebernahmeweg

```text
Feature-Branch -> dev -> qs -> prd
```

- Neue Arbeit beginnt auf einem kurzen Feature-Branch von `dev`.
- Pull Requests nach `dev` muessen die CI-Pruefungen bestehen.
- Eine QS-Freigabe wird per Pull Request von `dev` nach `qs` uebernommen.
- Eine Produktionsfreigabe wird per Pull Request von `qs` nach `prd` uebernommen.
- Auf `qs` und `prd` werden keine eigenen Funktionsaenderungen entwickelt.

## VPS-Betrieb

```bash
deploy/scripts/start-environment.sh dev
deploy/scripts/start-environment.sh qs
deploy/scripts/start-environment.sh prd

deploy/scripts/status-environment.sh dev
```

Die drei lokalen Supabase-Stacks dienen dem privaten Aufbau. Vor einer oeffentlichen PRD-Freigabe sind gehaertete Geheimnisse, TLS, taegliche externe Backups, Monitoring und ein Wiederherstellungstest verpflichtend.
