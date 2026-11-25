# Grundlagentraining Arithmetik · Klasse 5–7

Ein Trainingsprogramm, mit dem Schülerinnen und Schüler der Klassen 5–7 ihre Lücken bei den Grundaufgaben (1+1, 1−1, 1·1, 1:1) schließen: täglich 10 Minuten, kleine Faktensätze, 1-Minuten-Sprints mit Selbstauswertung, Reparatur der Fehler und verteilte Wiederholung. Grundlage sind Facts on Fire (Brian Poncy), Engelmanns Direkte Instruktion, die Atomisierung nach Kris Boulton und Forschung zu gemischtem und verteiltem Üben.

## Inhalt

| Ordner | Was | Wie benutzen |
|---|---|---|
| [`app/`](app/) | Lehrer- und Schüler-App mit Supabase: Schülerkonten mit PIN, Zugangskarten mit QR-Code, Sprints am Handy mit eigener Zifferntastatur, Papierwerte, Faktenanalyse | Selbst hosten, Anleitung in [`app/README.md`](app/README.md) |
| [`material/`](material/) | Generator für das Druckmaterial: Eingangstest (Form A/B, Interview, Klassenauswertung), 14 Satzblätter mit Einführungsskripten, 56 Sprintblätter mit Lösungen, Kurvenblatt, Reparaturliste | `pip install -r material/requirements.txt && python material/build.py` → PDFs in `material/out/` |
| [`legacy/`](legacy/) | Erste Version der Lehrer-App als einzelne HTML-Datei (lief als Artifact auf claude.ai, speichert nur dort oder im Browser) | Nur noch als Referenz |

## Die 14 Sätze

| Addition/Subtraktion | Multiplikation/Division |
|---|---|
| A1 +0, +1, +2 · A2 Zehnerfreunde, +10 · A3 Verdoppeln · A4 Fast-Verdoppeln · A5 +9 · A6 Zehnerübergang mit 8 und 7 · A7 Rest | M1 ·0, ·1, ·10 · M2 ·2, ·5 · M3 ·9 · M4 Quadratzahlen · M5 ·4 · M6 ·3 · M7 6·7, 6·8, 7·8 |

Jeder Satz enthält die ganze Faktenfamilie (Tausch- und Umkehraufgaben). Ein Sprintblatt besteht ab dem dritten Satz aus 50 % aktuellem Satz, 30 % den zwei Sätzen davor und 20 % älteren Sätzen; M-Blätter enthalten zusätzlich 4 Plus-/Minusaufgaben, damit die Kinder die Operation unterscheiden lernen.

## Zählweise und Ziele

Gezählt werden **richtige Aufgaben pro Minute**: letzte bearbeitete Zeile × 4, minus Fehler und Lücken.

- Ziel auf Papier: Schreibtempo (Ziffern/min) ÷ 2,5
- Ziel in der App: Tipptempo (Ziffern/min) ÷ 4

Papier- und App-Werte werden getrennt geführt und nicht direkt verglichen.

## Automatisierung (GitHub Actions)

Bei jedem Push und Pull Request:

- **App-Tests:** Datenbankschema und Zugriffsregeln in einer eingebetteten Postgres-Datenbank (PGlite), Schüler- und Lehrer-App in einem simulierten Browser.
- **Druckmaterial:** Die PDFs werden neu gebaut und als Artefakt `druckmaterial` angehängt (90 Tage abrufbar unter *Actions* → Lauf → *Artifacts*).

Bei einem Tag `v…` (z. B. `git tag v1.0 && git push --tags`) entsteht zusätzlich ein **Release** mit den drei PDFs und der App als ZIP.

## Datenschutz

In die App gehören nur Kürzel, keine Namen. `app/web/config.js` (Zugangsdaten zur eigenen Supabase-Instanz) wird nicht eingecheckt; der Workflow bricht ab, falls sie doch im Repo landet.
