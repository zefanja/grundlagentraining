# Sprint-Tracker Grundaufgaben · Lehrer- und Schüler-App mit Supabase

Selbst gehostete Web-App für das Grundaufgaben-Training (1+1, 1·1) in Klasse 5–7.

- **Lehrer-App** (`lehrer.html`): Klassen und Schüler anlegen, PINs erzeugen, Zugangskarten mit QR-Code drucken, Papierwerte eintragen, Fortschritt in Papier und App getrennt verfolgen, Faktenanalyse (welche Aufgaben sind in der Klasse langsam oder fehleranfällig).
- **Schüler-App** (`schueler.html`): Login mit Klassencode, Kürzel und PIN; 1-Minuten-Sprint, Reparatur der Fehler, Üben ohne Zeit, Tipptest. Eigene Zifferntastatur, die Bildschirmtastatur des Handys öffnet sich nie.
- **Backend:** Supabase (Postgres mit Zugriffsregeln). Keine externen Skripte, Schriften oder CDNs zur Laufzeit.

## Inhalt

| Datei | Zweck |
|---|---|
| `supabase/schema.sql` | Tabellen, Zugriffsregeln (RLS), Login- und Speicherfunktionen |
| `web/index.html` | Startseite mit zwei Knöpfen (Schüler / Lehrkraft) |
| `web/lehrer.html`, `web/schueler.html` | die beiden Apps |
| `web/shared.js` | gemeinsame Logik: Sätze A1–M7, Mischung 50/30/20, Ziele |
| `web/vendor/` | supabase-js und qrcode-generator (MIT), lokal mitgeliefert |
| `web/config.example.js` | Vorlage für die Zugangsdaten |
| `docker-compose.yml`, `nginx.conf` | statischer Webserver für Portainer |
| `tests/` | automatische Tests für Schema und Apps (optional) |

## Einrichtung (etwa 30 Minuten)

1. **Supabase bereitstellen.** Entweder Supabase Cloud mit Region *Frankfurt (eu-central-1)* und Auftragsverarbeitungsvertrag, oder selbst gehostet nach der offiziellen Docker-Anleitung auf deinem Server. Für den Datenschutz ist die selbst gehostete Variante am einfachsten zu begründen, braucht aber mehr Ressourcen (mehrere Container).
2. **Schema einspielen.** Im Supabase-Dashboard: *SQL Editor* → Inhalt von `supabase/schema.sql` einfügen → *Run*.
3. **Anmeldung absichern.** *Authentication → Sign In / Providers*: E-Mail aktiv lassen, **„Allow new users to sign up“ ausschalten**. Unter *Authentication → Users → Add user* jede Lehrkraft anlegen (Auto Confirm).
4. **Konfiguration.** `web/config.example.js` nach `web/config.js` kopieren und *Project URL* und *anon public key* eintragen (*Project Settings → API*). Der anon-Key darf öffentlich sein; geschützt wird alles über die Regeln im Schema.
5. **Content-Security-Policy.** In `nginx.conf` bei `connect-src` die Adresse deiner Supabase-Instanz eintragen.
6. **Starten.** In Portainer einen Stack aus `docker-compose.yml` anlegen (oder `docker compose up -d`). HTTPS über deinen vorhandenen Reverse Proxy. Ohne HTTPS funktioniert die App auf Handys nicht zuverlässig.
7. **Ausprobieren.** Lehrer-App öffnen → Klasse anlegen → Kürzel einfügen → „PINs für alle ohne PIN erzeugen“ → „Zugangskarten drucken“. Mit dem eigenen Handy den QR-Code scannen, PIN eintippen, Tipptest und einen Sprint machen. Der Wert erscheint in der Lehrer-App unter „Klasse“ und „Schüler“.

## Ablauf mit den Kindern

1. Zugangskarten austeilen. Der QR-Code enthält Klassencode, Kürzel und PIN: Scannen meldet das Kind sofort an (mit der Handykamera oder über „Zugangskarte scannen“ in der App). Auf eigenen Geräten bleibt die Anmeldung 180 Tage gespeichert. Die Karte deshalb wie einen Schlüssel behandeln.
2. Erster Start: **Tipptest** (30 Sekunden). Daraus berechnet die App das persönliche App-Ziel.
3. Im Unterricht: **Unterrichtssprint freigeben** (siehe unten), die Kinder starten den Sprint (1 Minute) → Ergebnis → **Reparieren** (jede falsche Aufgabe dreimal: anschauen, abdecken, eintippen). Optional **Üben**: jede Aufgabe des Satzes zweimal richtig und schnell.
4. Papier läuft weiter wie bisher: Kontrollsprint am Freitag auf Papier, Wert in der Lehrer-App unter „Papier erfassen“ eintragen.
5. Satzwechsel entscheidest du in der Lehrer-App („Weiter zu M6“). Die Schüler-App übernimmt den neuen Satz beim nächsten Öffnen.

## Was zählt: Unterrichtssprint statt Üben zu Hause

Für das Kriterium zählen nur Papierwerte und **App-Sprints im Unterrichtsfenster**. Üben zu Hause ist erlaubt und erwünscht, wird gespeichert und angezeigt („geübt“), zählt aber nicht. Das Fenster öffnet sich auf zwei Wegen, eine Codeeingabe gibt es nicht:

- **Freigeben:** In der Lehrer-App „Unterrichtssprint freigeben“ (12 Minuten, verlängerbar). Die Schüler-App zeigt dann „Unterrichtssprint starten“ und prüft alle 30 Sekunden, ob freigegeben ist.
- **Automatisch:** Unter „Verwalten“ feste Zeiten pro Klasse eintragen (z. B. Montag 07:50, 15 min). In diesen Zeiten zählen Sprints ohne Klick.

Nach dem Ende gibt es 3 Minuten Nachlauf, damit ein laufender Sprint noch zählt. Die Prüfung passiert auf dem Server nach deutscher Zeit; die Uhr des Handys spielt keine Rolle.

## Gemeinsame Geräte (Klassensatz)

- **Feste Zuordnung** (Gerät 7 gehört Kind 7): nichts einstellen, die Anmeldung bleibt gespeichert. Im Kiosk-Modus darf der Browser-Speicher (localStorage) für die App-Adresse dann nicht gelöscht werden.
- **Wechselnde Kinder:** Einmal pro Gerät `schueler.html#geraet=gemeinsam` öffnen. Dann wird nichts gespeichert, das Kind meldet sich per Karte an und ist nach „Fertig“ (oder 3 Minuten ohne Aktivität) wieder abgemeldet. Zurück mit `#geraet=persoenlich`.
- Die Kamera-Anmeldung braucht HTTPS und einen Browser mit Kamerazugriff.

## Papier und App vergleichen

Die beiden Werte werden **nicht direkt verglichen**. Jedes Kind hat zwei Ziele:

- **Papier:** Schreibtempo ÷ 2,5 (richtige Aufgaben pro Minute)
- **App:** Tipptempo ÷ 4 (pro Aufgabe etwa 1,7 Ziffern plus ein Tipp auf OK)

Das Kriterium „zweimal in Folge über dem Ziel, höchstens 2 Fehler“ gilt als erfüllt, wenn es in **einem** der beiden Medien erreicht ist. Der Teiler 4 für die App ist ein begründeter Startwert, keine geprüfte Norm. **Kalibrieren nach 2–3 Wochen:** Vergleiche für Kinder mit Werten in beiden Medien das Verhältnis App/Papier. Weicht es deutlich ab, passe in `web/shared.js` die Funktion `goalApp` an oder setze einzelne Ziele in „Verwalten“ von Hand.

## Datenschutz und Sicherheit

- Nur **Kürzel** speichern, keine Namen. Die Zuordnung bleibt im Notenbuch.
- Schüler haben keine Konten mit E-Mail. Die PIN wird nur als bcrypt-Hash gespeichert; Lehrkräfte können sie nicht lesen, nur neu setzen.
- Nach **5 falschen PINs** ist das Kind 15 Minuten gesperrt. Eine neue PIN meldet das Kind auf allen Geräten ab.
- Schüler erreichen die Datenbank nur über vier Funktionen (`student_login`, `student_state`, `student_save`, `student_logout`). Lehrkräfte sehen nur ihre eigenen Klassen (Row Level Security).
- Eine gelöschte Klasse löscht alle zugehörigen Kinder, Sprints und Antworten.
- Vor dem Einsatz mit Schulleitung und Datenschutzbeauftragter/m klären: Rechtsgrundlage für pseudonyme Leistungsdaten, Nutzung privater Handys, Elterninformation. Bei Supabase Cloud: AVV abschließen.

## Tests

```
cd tests && npm install && npm test
```

`test_schema.mjs` prüft Schema, Zugriffsregeln und Login in einer eingebetteten Postgres-Datenbank (PGlite). `test_student.mjs` und `test_teacher.mjs` spielen die Apps in einem simulierten Browser durch. Nicht automatisch getestet: echte Supabase-Instanz, echte Handys (Tastatur, Tempo, Darstellung). Vor dem Einsatz mit der Klasse also selbst auf einem iPhone und einem Android-Gerät ausprobieren.
