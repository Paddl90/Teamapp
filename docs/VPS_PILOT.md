# Privater VPS-Pilot

Die Pilotumgebung ist nur ueber das private Tailscale-Netz erreichbar. Es werden keine oeffentlichen DNS-Eintraege benoetigt.

## Adressen

- Web-App: `http://100.111.63.48:8080`
- Supabase API: `http://100.111.63.48:54321`
- Supabase Studio: `http://100.111.63.48:54323`
- Mailpit: `http://100.111.63.48:54324`

Dies ist die DEV-Stufe. Die getrennten QS- und PRD-Adressen sowie der Freigabeweg sind in [ENVIRONMENTS.md](./ENVIRONMENTS.md) dokumentiert.

Diese Adressen funktionieren nur auf Geraeten, die im selben Tailscale-Netz angemeldet sind.

## Erstinstallation auf dem VPS

Im Repository unter `/srv/teamapp`:

```bash
deploy/scripts/start-environment.sh dev
```

## Betrieb

```bash
deploy/scripts/status-environment.sh dev
```

Die lokale Supabase-Umgebung ist ausschliesslich fuer Entwicklung und den privaten Pilotbetrieb gedacht. Vor einer Freigabe fuer weitere Vereinsmitglieder wird auf eine gehaertete, TLS-geschuetzte Self-Hosting-Konfiguration umgestellt.

Um auf dem 8-GB-Pilotserver ausreichend Reserve zu halten, sind Analytics, Vector-Speicher und Edge Runtime deaktiviert. Sie koennen spaeter gezielt aktiviert werden.
