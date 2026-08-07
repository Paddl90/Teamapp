# Teamapp

Plattformübergreifende Vereins- und Jahrgangsorganisation für Web, iOS und Android.

## Voraussetzungen

- Node.js und npm
- für native Tests: Expo Go oder eine lokale iOS-/Android-Entwicklungsumgebung

## Lokaler Start

```bash
npm install
cp .env.example .env.local
npm run web
```

Weitere Befehle:

```bash
npm run ios
npm run android
npm run typecheck
```

Die App startet ohne Supabase-Zugangsdaten im unverbundenen Grundzustand. Für Authentifizierung und persistente Daten müssen `EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` gesetzt werden.

## Dokumentation

- [Produktspezifikation](./docs/PRODUCT_SPEC.md)
- [UX-Abläufe](./docs/UX_FLOWS.md)
- [Architektur und Datenmodell](./docs/ARCHITECTURE.md)
- [Privater VPS-Pilot](./docs/VPS_PILOT.md)
- [Umgebungen und Git-Workflow](./docs/ENVIRONMENTS.md)

## Projektstruktur

```text
app/                Expo-Router-Seiten und Navigation
src/components/     wiederverwendbare UI-Komponenten
src/lib/            Infrastruktur und externe Clients
src/theme/          Design-Tokens
docs/               Produkt- und Technikdokumentation
```
