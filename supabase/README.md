# Supabase-Einrichtung

Die Migration `migrations/20260804120000_foundation.sql` legt das Fundament für Anmeldung, Vereine, Saisons, Jahrgänge, Mannschaften, Mitgliedschaften und Rollen an.

## Verbindung

1. Ein Supabase-Projekt in einer passenden EU-Region anlegen.
2. Die Projekt-URL und den öffentlichen Anon-Key in `.env.local` eintragen.
3. Die Migration mit der Supabase CLI oder über den SQL-Editor anwenden.
4. In Supabase Auth die gewünschten Anmelde- und E-Mail-Einstellungen konfigurieren.

Die Funktion `create_club_workspace` erstellt atomar einen Verein, eine Saison, einen Jahrgang, B1/B2 sowie die erste Administratorrolle.

Service-Role-Schlüssel dürfen niemals in `.env.local` oder in der Client-App abgelegt werden.
