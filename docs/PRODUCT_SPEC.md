# Teamapp – Produktspezifikation für den Vereinspiloten

Status: Entwurf 1.0

Ziel: Pilotbetrieb im eigenen Verein

Plattformen: Web, iOS und Android

## 1. Produktvision

Teamapp organisiert einen vollständigen Jugendjahrgang mit mehreren Mannschaften in einem gemeinsamen Arbeitsbereich. Spieler, Trainer und Eltern werden nur einmal verwaltet. Gemeinsame Trainings, getrennte Spiele, flexible Kaderzuordnungen und jahrgangsweite Auswertungen funktionieren ohne voneinander isolierte Teamkonten.

Der erste Pilot wird für einen B-Jugend-Jahrgang mit mindestens B1 und B2 entwickelt. Das Modell muss später weitere Jahrgänge, Mannschaften und Sportarten unterstützen können.

## 2. Ziele des Piloten

- B1 und B2 aus einem gemeinsamen Spieler- und Trainerpool organisieren.
- Gemeinsame und mannschaftsspezifische Termine abbilden.
- Geeignete Trainingszeiten anhand verfügbarer Spieler und Trainer erkennen.
- Kader beider Mannschaften vor einer Saison planen.
- Spieltagskader und Aufstellungen erstellen.
- Anwesenheit, Einsätze und Spielereignisse statistisch auswerten.
- Mannschaftskassen und Strafen nachvollziehbar verwalten.
- Individuelle Trainingseinheiten und Trainervorgaben dokumentieren.
- Fitness- und Verbandsdaten über austauschbare Integrationen importieren.
- Den gesamten Pilotumfang ohne Monetarisierung im eigenen Verein testen.

## 3. Nicht-Ziele des Piloten

- Abonnements, Preispläne oder In-App-Käufe
- öffentliche Vermarktung an andere Vereine
- integrierte Zahlungsabwicklung
- vollständiges Vereins-ERP mit Buchhaltung
- medizinische Diagnosen oder automatisierte Trainingsempfehlungen
- garantierte Verfügbarkeit externer Schnittstellen ohne Freigabe des Anbieters

## 4. Organisationsmodell

```text
Verein
└── Abteilung / Sportart
    └── Saison
        └── Jahrgang, z. B. B-Jugend
            ├── gemeinsamer Mitgliederpool
            ├── B1
            └── B2
```

Ein Mitglied besitzt genau ein persönliches Profil und kann innerhalb einer Saison mehreren Mannschaften oder Gruppen zugeordnet werden. Spieler können ein Stammteam sowie weitere Einsatzberechtigungen besitzen.

## 5. Nutzerrollen

### Vereinsadministrator

- verwaltet Verein, Abteilungen, Saisons und Jahrgänge
- vergibt Rollen und grundlegende Berechtigungen
- besitzt Zugriff auf alle Pilotdaten des Vereins

### Jahrgangsadministrator

- verwaltet Mannschaften und den gemeinsamen Mitgliederpool
- bestätigt die finale Kaderplanung
- verwaltet jahrgangsweite Einstellungen

### Trainer

- erstellt Termine, Nominierungen und Aufstellungen
- sieht erforderliche Verfügbarkeiten und Statistiken
- erstellt individuelle Trainingsvorgaben
- erfasst Spielereignisse

### Spieler

- beantwortet Termine
- pflegt Abwesenheiten und regelmäßige Verfügbarkeiten
- sieht eigene Nominierungen und freigegebene Aufstellungen
- dokumentiert individuelles Training
- bearbeitet persönliche Trainingsvorgaben

### Elternteil / Stellvertretung

- verwaltet Antworten und relevante Daten eines oder mehrerer Kinder
- sieht ausschließlich freigegebene Informationen

### Kassenwart

- verwaltet Kassen, Buchungen, Beiträge und Strafen
- erstellt Berichte und Exporte
- erhält keinen automatischen Zugriff auf sportliche oder sensible Gesundheitsdaten

### Medizinische Betreuung

- erhält nur bei ausdrücklicher Vergabe Zugriff auf freigegebene Verletzungs- oder Reha-Informationen

## 6. Funktionsumfang

### 6.1 Konten und Mitglieder

- Registrierung und Anmeldung
- Einladung per Link oder Code
- persönliches Profil ohne doppelte Anlage pro Mannschaft
- Zuordnung zu Verein, Jahrgang, Mannschaft und Gruppen
- Haupt- und Nebenpositionen
- Stammteam und flexible Einsatzberechtigungen
- mehrere Kinder pro Elternkonto
- Status aktiv, inaktiv oder ausgeschieden

### 6.2 Termine und Anwesenheit

- Terminarten Training, Spiel, Turnier, Besprechung und sonstiger Termin
- einmalige und wiederkehrende Termine
- Zielgruppe gesamter Jahrgang, einzelne Mannschaft, Gruppe oder ausgewählte Personen
- Antworten zugesagt, vielleicht, abgesagt und offen
- Antwortfrist und Erinnerungen
- Abwesenheiten für Urlaub, Krankheit, Verletzung und sonstige Gründe
- regelmäßige Verfügbarkeiten und Sperrzeiten
- Konflikterkennung bei überschneidenden Terminen
- Kalenderfilter und ICS-Export

### 6.3 Kapazitäts- und Terminplanung

- Wochenansicht in konfigurierbaren Zeitrastern
- Anzahl verfügbarer Spieler, Torhüter und Trainer pro Zeitfenster
- Filter nach Jahrgang, Mannschaft, Gruppe und Rolle
- Berücksichtigung bestehender Termine, Abwesenheiten und regelmäßiger Sperrzeiten
- konfigurierbare Mindestbesetzung je Terminart
- Bewertung geeignet, knapp oder ungeeignet
- Detailansicht für berechtigte Trainer
- Terminerstellung aus einem vorgeschlagenen Zeitfenster
- optional spätere Einbindung von Platz- und Hallenbelegungen

### 6.4 Vorsaison-Kaderplanung

- neuer Plan pro Saison und Jahrgang
- mehrere gespeicherte Planungsvarianten
- Bereiche nicht zugeordnet, B1, B2 und weitere Mannschaften
- Drag-and-drop-Zuordnung von Spielern
- Soll-Kadergröße je Mannschaft
- Soll-Besetzung je Positionsgruppe
- getrennte Betrachtung von Haupt- und Nebenpositionen
- Anzeige von Unter-, Soll- und Überbesetzung
- Kommentare und Änderungsverlauf
- Bestätigung einer Variante als offizieller Saisonkader
- keine Veränderung des laufenden Kaders vor der Bestätigung

### 6.5 Spieltagsplanung und Aufstellung

- Nominierung aus dem gemeinsamen spielberechtigten Pool
- Prüfung von Abwesenheiten, Konflikten und Doppel-Nominierungen
- Startelf, Ersatzbank und nicht nominierte Spieler
- frei wählbare Formation
- visuelle Zuordnung auf einem Spielfeld
- Trikotnummer, Kapitän und optionale Rollen
- Speicherung von Vorlagen und Kopieren früherer Aufstellungen
- kontrollierte Veröffentlichung für Spieler und Eltern
- druckbarer beziehungsweise als PDF exportierbarer Spielbericht

### 6.6 Spielereignisse

- Spielbeginn und Spielende
- Ein- und Auswechslungen
- Tore und Vorlagen
- gelbe, gelb-rote und rote Karten
- optionale Notizen
- Berechnung von Einsatzminuten
- nachträgliche Korrektur mit Änderungsprotokoll

### 6.7 Mannschaftskasse und Strafenkatalog

- gemeinsame Jahrgangskasse oder getrennte Mannschaftskassen
- Einnahmen, Ausgaben und Korrekturbuchungen
- Beiträge und frei definierbare Strafen
- Zuweisung an einzelne oder mehrere Personen
- Status offen, bezahlt, erlassen, storniert oder teilweise bezahlt
- Fälligkeit und Erinnerung
- Beleg als optionaler Anhang
- Salden und Kassenbericht
- CSV- und PDF-Export
- lückenloses Änderungsprotokoll
- keine Zahlungsabwicklung im Pilot

### 6.8 Statistiken

- Trainings- und Spielbeteiligung
- Zu-, Absagen, offene Antworten und unentschuldigtes Fehlen
- Einsätze, Startelfeinsätze und Einwechslungen
- Einsatzminuten
- Tore, Vorlagen und Karten
- Einsätze je Mannschaft bei jahrgangsübergreifendem Pool
- Positionsverteilung und Kaderabdeckung
- individuelle Trainingseinheiten und erledigte Vorgaben
- Filter nach Saison, Zeitraum, Mannschaft, Gruppe und Spieler
- Mannschafts- und Jahrgangsansicht
- alters- und rollenabhängige Sichtbarkeit

### 6.9 Individuelles Training

- manuelle Erfassung von Lauf-, Stabilisations-, Kraft-, Beweglichkeits-, Regenerations-, Reha- und Balltraining
- Datum, Dauer, Strecke, subjektive Belastung und Notiz
- persönliche Trainingshistorie
- Vorgaben an einzelne Spieler, Gruppen, Mannschaften oder den Jahrgang
- einmalige und wiederkehrende Vorgaben
- Frist, Wiederholungszahl und optionale Anhänge
- Status offen, erledigt, teilweise erledigt oder nicht möglich
- Erinnerung und Trainerübersicht
- einfache Wochenübersicht der dokumentierten Belastung
- keine medizinische Bewertung oder automatische Diagnose

### 6.10 Benachrichtigungen

- In-App-Benachrichtigungen
- Push-Benachrichtigungen auf Mobilgeräten
- optionale E-Mail-Erinnerungen
- persönliche Einstellungen pro Benachrichtigungstyp
- Ereignisse für Termine, Nominierungen, Aufstellungen, Vorgaben, Beiträge und Strafen

## 7. Integrationen

Alle Integrationen werden über eine austauschbare Adapter-Schicht angebunden. Importierte Datensätze speichern Quelle, externe ID, Synchronisationszeit und Einwilligungsstatus.

### Strava

- OAuth-Verknüpfung durch den Spieler
- Import freigegebener Aktivitäten
- Zuordnung zu individuellen Trainingseinträgen
- Schutz vor doppeltem Import

### Apple HealthKit

- Zugriff ausschließlich auf iOS mit ausdrücklicher Einwilligung
- Import ausgewählter Trainingseinheiten und relevanter Aktivitätswerte
- keine Speicherung nicht benötigter Gesundheitsdaten

### Android Health Connect

- Zugriff ausschließlich auf unterstützten Android-Geräten mit ausdrücklicher Einwilligung
- Import ausgewählter Trainingsdaten
- transparente Berechtigungsverwaltung

### Garmin

- Umsetzung abhängig von Bewerbung und Freigabe für das Garmin Developer Program
- zunächst technischer Adapter und manueller Fallback
- keine Annahme einer kostenlosen kommerziellen Nutzung

### FUSSBALL.DE / DFBnet

- Import von Spielplänen, Gegnern, Orten und Ergebnissen, soweit ein offizieller Zugang verfügbar ist
- Vereins- beziehungsweise Mannschaftszuordnung
- CSV-, Excel- und ICS-Import als Fallback
- keine nicht genehmigte Umgehung von Zugangsbeschränkungen

## 8. Statistik- und Datenschutzgrundsätze

- Es werden nur Daten erhoben, die für Organisation und Training erforderlich sind.
- Fitness- und Gesundheitsdaten benötigen eine ausdrückliche, widerrufbare Einwilligung.
- Minderjährige und Eltern erhalten verständliche Informationen zur Datenverarbeitung.
- Spieler sehen standardmäßig ihre eigenen Daten sowie freigegebene Mannschaftsdaten.
- Trainer sehen nur Daten ihrer zugeordneten Jahrgänge und Mannschaften.
- Kasseninformationen und sportliche Informationen besitzen getrennte Berechtigungen.
- Änderungen an Kassenbuchungen, Rollen, Kadern und Spielereignissen werden protokolliert.
- Löschung, Export und Widerruf müssen im Pilot vorgesehen werden.
- Statistiken dienen der sportlichen Organisation und dürfen nicht unkontrolliert öffentlich veröffentlicht werden.

## 9. Zentrale Datenobjekte

- Verein, Abteilung, Saison und Jahrgang
- Mannschaft und Gruppe
- Benutzer, Profil, Eltern-Kind-Beziehung und Mitgliedschaft
- Rolle und Berechtigung
- Position und Spielerposition
- Termin, Zielgruppe, Teilnahme und Abwesenheit
- Verfügbarkeitsregel und Planungsgrenzwert
- Kaderplan, Kaderplanversion und geplante Zuordnung
- Spiel, Nominierung, Formation, Aufstellungsplatz und Spielereignis
- Kasse, Buchung, Beitrag, Strafentyp und zugewiesene Strafe
- Trainingsaktivität, Trainingsvorgabe und Erledigung
- Benachrichtigung
- Integrationskonto und importierter Datensatz
- Änderungsprotokoll

## 10. Zentrale Nutzerabläufe

### Jahrgang einrichten

1. Administrator legt Verein, Saison und B-Jugend an.
2. B1 und B2 werden unter dem Jahrgang erstellt.
3. Mitglieder werden einmalig eingeladen oder importiert.
4. Rollen, Positionen und Einsatzberechtigungen werden vergeben.

### Gemeinsames Training planen

1. Trainer öffnet die Wochenplanung für die gesamte B-Jugend.
2. Die App zeigt verfügbare Spieler und Trainer je Zeitfenster.
3. Trainer prüft Konflikte und Mindestbesetzung.
4. Aus einem geeigneten Zeitfenster wird ein Termin für B1 und B2 erstellt.
5. Mitglieder erhalten eine Benachrichtigung und antworten.

### Saisonkader planen

1. Jahrgangsadministrator erstellt eine neue Planungsvariante.
2. Spieler werden aus dem gemeinsamen Pool auf B1 und B2 verteilt.
3. Positionsabdeckung und Kadergrößen werden geprüft.
4. Varianten werden verglichen und kommentiert.
5. Eine Variante wird bestätigt und als offizieller Saisonkader übernommen.

### Spieltag durchführen

1. Trainer öffnet einen Spieltermin.
2. Verfügbare und spielberechtigte Spieler werden nominiert.
3. Startelf und Bank werden auf dem Spielfeld angeordnet.
4. Aufstellung wird für das Team veröffentlicht.
5. Während oder nach dem Spiel werden Ereignisse und Wechsel erfasst.
6. Statistiken werden aus den bestätigten Ereignissen aktualisiert.

### Individuelle Vorgabe bearbeiten

1. Trainer erstellt eine wiederkehrende Vorgabe für Spieler oder Gruppe.
2. Spieler erhält eine Erinnerung und dokumentiert die Durchführung.
3. Trainer sieht den Status in der Wochenübersicht.
4. Importierte Aktivitäten können mit der Vorgabe verknüpft werden.

## 11. Qualitätsanforderungen

- responsive Bedienung auf Web, Smartphone und Tablet
- klare Trennung zwischen Jahrgang und Mannschaft
- sichere Mandantentrennung zwischen Vereinen
- rollenbasierter Zugriff auf alle Datensätze
- barrierearme Bedienung und ausreichende Kontraste
- deutsche Benutzeroberfläche im Pilot; spätere Übersetzbarkeit vorbereiten
- Zeitzonen- und Sommerzeitkorrektheit
- nachvollziehbare Fehlerzustände und Offline-Hinweise
- automatisierte Tests für Rechte, Terminüberschneidungen, Statistiken und Kassenberechnungen
- regelmäßige Backups und wiederherstellbare Datenbankmigrationen

## 12. Entwicklungsphasen

### Phase 1 – Fundament

- Projektstruktur für Web, iOS und Android
- Anmeldung, Profile, Rollen und Berechtigungen
- Verein, Saison, Jahrgang, Mannschaft und Mitgliederpool

### Phase 2 – Termine

- Kalender, Zielgruppen und Rückmeldungen
- Abwesenheiten, Verfügbarkeiten und Benachrichtigungen
- Kapazitätsplanung und Konflikterkennung

### Phase 3 – Kader und Spieltag

- Vorsaison-Kaderplanung
- Nominierung und visuelle Aufstellung
- Spielereignisse und Einsatzzeiten

### Phase 4 – Statistik und Finanzen

- sportliche Auswertungen
- Kassen, Beiträge und Strafenkatalog
- Berichte und Exporte

### Phase 5 – Individuelles Training

- Aktivitäten, Vorgaben und Wochenübersicht
- Einwilligungen für sensible Daten

### Phase 6 – Integrationen

- Strava
- Apple HealthKit und Android Health Connect
- Garmin nach Freigabe
- FUSSBALL.DE / DFBnet sowie Datei-Fallbacks

### Phase 7 – Vereinspilot

- Import beziehungsweise Anlage echter Pilotdaten
- Test mit Trainern, Spielern, Eltern und Kassenwart
- Fehlerbehebung und Bedienungsverbesserungen
- Entscheidung über nächste Ausbaustufe

## 13. Abnahmekriterien für den Pilotstart

- Ein Administrator kann einen Jahrgang mit B1 und B2 anlegen.
- Ein Spielerprofil kann ohne Duplikat beiden Mannschaften zugeordnet werden.
- Ein gemeinsamer Trainingstermin erreicht Mitglieder beider Mannschaften.
- Die Planungsansicht bewertet mindestens Spieler-, Torhüter- und Trainerverfügbarkeit.
- Eine Kaderplanvariante kann erstellt, gespeichert und bestätigt werden.
- Ein Spieler kann für genau einen kollidierenden Spieltermin konfliktfrei nominiert werden.
- Eine Aufstellung kann erstellt, veröffentlicht und exportiert werden.
- Spielereignisse erzeugen nachvollziehbare Statistiken.
- Kassenbuchungen und Strafen besitzen korrekte Salden und einen Änderungsverlauf.
- Spieler können Aktivitäten erfassen und Trainervorgaben abschließen.
- Externe Aktivitäten werden nur nach Einwilligung importiert.
- Rollen verhindern den Zugriff auf nicht freigegebene sportliche, finanzielle und sensible Daten.
- Die Kernabläufe funktionieren im Web sowie in Testversionen für iOS und Android.

## 14. Noch zu konkretisierende Produktentscheidungen

- genaue Sportart und gewünschte Positionssysteme im ersten Pilot
- benötigte Mannschafts- und Jahrgangshierarchie des Pilotvereins
- bestehende Datenquellen und Importformate
- Sichtbarkeit einzelner Statistiken für Spieler und Eltern
- Regeln für Einsätze zwischen B1 und B2
- Kassenstruktur und vereinsinterne Buchungsregeln
- Umfang der gewünschten Platz- oder Hallenplanung
- verfügbare Zugänge zu FUSSBALL.DE, DFBnet und Garmin
- endgültiger Produktname und visuelle Identität
