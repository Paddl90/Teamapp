# Teamapp – Bildschirmstruktur und UX-Abläufe

Status: Entwurf 1.0

Grundlage: [Produktspezifikation](./PRODUCT_SPEC.md)

## 1. Navigationsprinzip

Der aktive Kontext ist jederzeit sichtbar und umschaltbar:

```text
Verein → Saison → B-Jugend → gesamter Jahrgang | B1 | B2
```

Ein Kontextwechsel filtert Kalender, Mitglieder, Statistiken und Kasse, ohne einen getrennten Team-Arbeitsbereich zu öffnen. Jahrgangsweite Inhalte bleiben als solche gekennzeichnet.

## 2. Hauptnavigation

### Mobil

- Start
- Kalender
- Kader
- Mehr

Unter „Mehr“ liegen Spieltag, Training, Statistik, Kasse, Mitglieder und Einstellungen. Häufig verwendete Bereiche können später personalisiert werden.

### Web und Tablet

- Start
- Kalender und Planung
- Kaderplanung
- Spieltag
- Individuelles Training
- Statistik
- Kasse
- Mitglieder
- Einstellungen

## 3. Globale Oberflächenelemente

- Kontextwähler für Saison, Jahrgang und Mannschaft
- globale Suche nach Mitgliedern und Terminen
- Benachrichtigungszentrum
- Schnellaktion zum Anlegen eines Termins, einer Vorgabe oder einer Buchung
- sichtbare Kennzeichnung für Entwurf, veröffentlicht und abgeschlossen
- konsistente Filterleiste auf Listen- und Statistikseiten

## 4. Rollenbasierte Startseiten

### Trainer

- nächster Termin mit Rückmeldestatus
- offene Zu-/Absagen
- Besetzungswarnungen und Terminkonflikte
- nächste Spiele und unvollständige Aufstellungen
- offene individuelle Vorgaben
- Schnellzugriff auf Wochenplanung

### Spieler

- nächste Termine und erforderliche Antworten
- Nominierungen und veröffentlichte Aufstellungen
- offene Trainingsvorgaben
- letzte eigene Aktivitäten
- eigene relevante Statistiken

### Elternteil

- Kindwähler
- nächste Termine und offene Antworten pro Kind
- Nominierungen und freigegebene Informationen
- offene Beiträge oder Strafen, sofern sichtbar

### Kassenwart

- aktueller Kassensaldo
- offene Beiträge und Strafen
- überfällige Posten
- letzte Buchungen

## 5. Kernabläufe

### 5.1 Jahrgang und Mannschaften einrichten

```text
Verein/Saison wählen
→ Jahrgang anlegen
→ B1 und B2 anlegen
→ Mitglieder importieren oder einladen
→ Rollen und Positionen vergeben
→ Stammteam und Einsatzberechtigungen festlegen
→ Einrichtung prüfen
```

Der Einrichtungsassistent zeigt Fortschritt, fehlende Pflichtangaben und mögliche Duplikate.

### 5.2 Termin erstellen

```text
Kalender öffnen
→ Zeitfenster wählen
→ Terminart festlegen
→ Zielgruppe wählen: Jahrgang, B1, B2, Gruppe oder Personen
→ Ort, Frist und Mindestbesetzung festlegen
→ Vorschau der Empfänger und Konflikte prüfen
→ als Entwurf speichern oder veröffentlichen
```

Vor Veröffentlichung zeigt die App Anzahl und Namen der betroffenen Mitglieder sowie erkannte Überschneidungen.

### 5.3 Kapazitätsplanung

```text
Planungsansicht öffnen
→ Kontext und Terminart wählen
→ Zeitraum und Dauer einstellen
→ Verfügbarkeitsraster prüfen
→ Zeitfenster öffnen
→ verfügbare und fehlende Rollen prüfen
→ Termin aus Zeitfenster erstellen
```

Jede Zelle zeigt Spieler, Torhüter und Trainer als Zahl sowie eine Ampelfarbe. Die Farbe darf nie die Zahlen ersetzen.

### 5.4 Vorsaison-Kader planen

```text
Saison und Jahrgang wählen
→ Planungsvariante erstellen oder kopieren
→ Soll-Kadergrößen und Positionsbedarf festlegen
→ Spieler zwischen Pool, B1 und B2 verschieben
→ Warnungen und Positionsabdeckung prüfen
→ Variante speichern und kommentieren
→ Variante bestätigen
→ offizielle Kaderzuordnung übernehmen
```

Die Bestätigung benötigt eine Zusammenfassung aller Änderungen und eine erneute Bestätigung. Bestehende Saisonzuordnungen bleiben bis dahin unverändert.

### 5.5 Spieltagskader und Aufstellung

```text
Spieltermin öffnen
→ Nominierung starten
→ verfügbare und spielberechtigte Spieler auswählen
→ Konflikte lösen
→ Formation wählen
→ Spieler per Drag-and-drop auf Startelf und Bank verteilen
→ Trikotnummer und Kapitän ergänzen
→ Vorschau prüfen
→ Aufstellung veröffentlichen
```

Auf Mobilgeräten muss jede Drag-and-drop-Aktion zusätzlich über eine zugängliche Auswahlaktion möglich sein.

### 5.6 Spiel dokumentieren

```text
Spiel starten oder Nachbearbeitung öffnen
→ Ereignisart wählen
→ Spieler und Spielminute angeben
→ Ereignis speichern
→ bei Wechsel Ein- und Auswechselspieler verknüpfen
→ Spiel abschließen
→ Ereignisse prüfen und Statistik bestätigen
```

Die Nachbearbeitung zeigt einen Änderungsverlauf und berechnet Einsatzzeiten erneut.

### 5.7 Aktivität erfassen

```text
Individuelles Training öffnen
→ Aktivität hinzufügen
→ Typ, Datum und Dauer angeben
→ optionale Werte und Notiz ergänzen
→ speichern
```

Importierte Aktivitäten werden eindeutig gekennzeichnet und können einer Trainervorgabe zugeordnet werden.

### 5.8 Trainingsvorgabe erstellen

```text
Vorgabe erstellen
→ Empfänger wählen
→ Übung und Ziel beschreiben
→ einmalig oder wiederkehrend festlegen
→ Frist und erforderliche Wiederholungen definieren
→ Vorschau prüfen
→ veröffentlichen
```

### 5.9 Kassenbuchung und Strafe

```text
Kasse wählen
→ Einnahme, Ausgabe, Beitrag oder Strafe wählen
→ Betrag und betroffene Personen festlegen
→ Fälligkeit und optionalen Beleg ergänzen
→ Buchung bestätigen
```

Korrekturen erfolgen über nachvollziehbare Gegen- oder Korrekturbuchungen; bereits relevante Buchungen werden nicht spurlos gelöscht.

## 6. Zentrale Bildschirme

| Bereich | Bildschirm | Hauptinhalt |
|---|---|---|
| Start | Dashboard | Aufgaben, Warnungen und nächste Termine |
| Kalender | Kalender | Monat, Woche, Liste und Kontextfilter |
| Planung | Kapazitätsraster | Verfügbarkeit je Zeitfenster |
| Termine | Termindetail | Angaben, Antworten, Gruppen und Konflikte |
| Kader | Saisonplanung | Pool, B1, B2 und Positionsabdeckung |
| Spieltag | Nominierung | Verfügbarkeit und Spielberechtigung |
| Spieltag | Aufstellung | Spielfeld, Startelf und Bank |
| Spieltag | Ereignisse | Tore, Wechsel, Karten und Minuten |
| Training | Aktivitäten | eigene und freigegebene Trainingsdaten |
| Training | Vorgaben | Aufgaben, Fristen und Erledigung |
| Statistik | Übersicht | Kennzahlen und Filter |
| Kasse | Dashboard | Saldo, offene Posten und Buchungen |
| Kasse | Strafenkatalog | Regeln, Beträge und Zuweisungen |
| Mitglieder | Verzeichnis | Profile, Rollen und Zuordnungen |
| Einstellungen | Verwaltung | Organisation, Rechte und Integrationen |

## 7. Zustände und Rückmeldungen

Jeder zentrale Bildschirm benötigt definierte Zustände für:

- erstmalige Nutzung ohne Daten
- Laden
- teilweise verfügbare Daten
- Fehler mit erneuter Versuchsmöglichkeit
- fehlende Berechtigung
- Offline-Zustand
- erfolgreiche Speicherung
- ungespeicherte Änderungen
- archivierte Saison

## 8. Gestaltungsgrundsätze

- Jahrgang und Mannschaft dürfen visuell nie verwechselt werden.
- Zahlen begleiten jede farbliche Bewertung.
- Kritische Aktionen besitzen Vorschau und Bestätigung.
- Mobile Bedienung darf keine reine Desktop-Funktionalität verlieren.
- sensible Fitness-, Gesundheits- und Kassendaten sind nicht auf allgemeinen Dashboards sichtbar.
- Listen unterstützen Suche, Filter und Sortierung.
- historische Daten werden über Saisonfilter zugänglich und nicht mit aktuellen Daten vermischt.

## 9. Erste Wireframes

Die erste Wireframe-Runde umfasst:

1. Trainer-Dashboard
2. Kalender mit Kontextwähler
3. Kapazitätsplaner
4. Vorsaison-Kaderplanung
5. Spieltagsnominierung
6. visuelle Aufstellung
7. Statistikübersicht
8. Kassenübersicht
9. individuelles Training für Spieler
