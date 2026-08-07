# Privater VPS-Pilot

Die Pilotumgebung ist nur ueber das private Tailscale-Netz erreichbar. Es werden keine oeffentlichen DNS-Eintraege benoetigt.

## Adressen

- Web-App: `http://100.111.63.48:8080`
- Supabase API: `http://100.111.63.48:54321`
- Supabase Studio: `http://100.111.63.48:54323`
- Mailpit: `http://100.111.63.48:54324`

Diese Adressen funktionieren nur auf Geraeten, die im selben Tailscale-Netz angemeldet sind.

## Erstinstallation auf dem VPS

Im Repository unter `/srv/teamapp`:

```bash
supabase start
supabase status -o env
cp deploy/.env.vps.example deploy/.env.vps
```

Den von `supabase status -o env` ausgegebenen `ANON_KEY` als `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `deploy/.env.vps` eintragen. Danach:

```bash
docker compose --env-file deploy/.env.vps -f deploy/compose.vps.yml up -d --build
```

## Betrieb

```bash
supabase status
docker compose --env-file deploy/.env.vps -f deploy/compose.vps.yml ps
docker compose --env-file deploy/.env.vps -f deploy/compose.vps.yml logs --tail=100
```

Die lokale Supabase-Umgebung ist ausschliesslich fuer Entwicklung und den privaten Pilotbetrieb gedacht. Vor einer Freigabe fuer weitere Vereinsmitglieder wird auf eine gehaertete, TLS-geschuetzte Self-Hosting-Konfiguration umgestellt.

Um auf dem 8-GB-Pilotserver ausreichend Reserve zu halten, sind Analytics, Vector-Speicher und Edge Runtime deaktiviert. Sie koennen spaeter gezielt aktiviert werden.
