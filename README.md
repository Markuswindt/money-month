# Money&gt;Month

Ausgaben-Tracker für fixe und variable Kosten. PWA, läuft offline, alle Daten
bleiben auf dem Gerät.

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # Unit-Tests der Domänenlogik
pnpm build && pnpm preview
```

Beim ersten Start lädt die App Demo-Daten (rund 260 Ausgaben über sieben
Monate, elf Fixkosten). Unter **Mehr → Demo-Daten** lassen sie sich löschen
oder neu laden.

## Aufbau

Vier Schichten, strikt getrennt:

```
data/     IndexedDB hinter einem Repository-Interface  ← Austauschpunkt für eine echte DB
lib/      reine Funktionen: Geld, Perioden, Wiederholung, Aggregation (ohne React)
store/    Zustand-Stores, die das Repository kapseln
features/ Bildschirme, components/ das Design-System
```

`lib/` ist das Herz — dort entstehen alle Zahlen, und nur dort gibt es Tests.
Die UI rechnet nie selbst.

### Fixkosten werden amortisiert

Kanonisch ist der Monatsbetrag. 240 €/Jahr = 20,00 €/Monat = 4,62 €/Woche.
Bewusst 12 Monate und 52 Wochen statt kalendergenauer 365,25 Tage: so ist die
Umrechnung rundreise-stabil und in einem Satz erklärbar. Start- und Enddatum
werden anteilig berücksichtigt, damit eine Jahresansicht nicht zwölf
Monatsmieten zeigt, wenn die Miete erst im Juli begann.

Variable Ausgaben werden **nicht** amortisiert, sondern in der echten
Kalenderperiode summiert. In der Wochen- und Jahresansicht ist der
Fixkostenanteil deshalb mit `Ø` gekennzeichnet.

### Beträge sind ganzzahlige Cent

Fließkomma-Euro summiert sich falsch (`0.1 + 0.2 = 0.30000000000000004`).
Gerundet wird ausschließlich bei der Anzeige. Die Kategoriezeilen nutzen das
Verfahren des größten Rests, damit sie sich exakt auf die angezeigte
Gesamtsumme addieren — dafür gibt es einen Test.

### Vorbereitet auf eine Datenbank

Jede Repository-Methode ist asynchron, auch wo das lokal unnötig wäre. Jeder
Datensatz trägt `id` (UUID), `updatedAt` und `deletedAt` (weiches Löschen).
Damit ist der Umstieg auf eine echte Datenbank ein Dateitausch statt einer
Datenmigration.

## Flächen und Farben

Radix Colors, Akzent `gold`, Neutral `sand`.

Keine Umrandungen: eine Karte hebt sich dadurch ab, dass sie **heller** ist
als die Seite, plus einem weichen Schatten aus zwei Lagen. Seite `gold-2`,
Karten `gold-1` — im Dunkelmodus getauscht, weil ein Schatten dort keine Höhe
mehr trägt und Elevation nur über die hellere Fläche entsteht. Trennlinien
innerhalb von Karten bleiben, Container-Rahmen gibt es keine mehr.

Die Hauptaktion ist invers zum Grund: in hell fast schwarz, in dunkel fast
weiß (`sand-1`/`sand-12` des jeweils anderen Modus, 16:1 in beide
Richtungen). Sie ist die einzige Fläche, die den Untergrund vollständig
umkehrt — dadurch ist immer eindeutig, was die Hauptaktion ist.

Die Farbentscheidungen stehen begründet in `src/styles/theme.css`. Drei davon
waren gemessen, nicht geraten:

- **Gold-9 trägt keinen weißen Text** (3,65:1, verfehlt AA). Die Button-Fläche
  ist deshalb `gold-11`, der Vordergrund kippt je nach Modus.
- **Kategoriefarben nutzen Stufe 11, nicht 9.** Gegen die helle App-Fläche
  fallen fünf der vierzehn Stufe-9-Farben unter 3:1 — yellow auf 1,24:1.
- **Als Text braucht die Kategoriefarbe Stufe 12.** Auf der getönten
  Chip-Fläche kommt orange mit Stufe 11 nur auf 3,99:1 — und keine
  Kombination aus Stufe 11 und einer getönten Fläche besteht im hellen
  Modus. Stufe 11 markiert deshalb nur noch Punkte und Symbole (3:1 genügt),
  Stufe 12 trägt den Text.

Die Rangliste zeichnet alle Balken in **einem** Farbton: vierzehn
Kategoriefarben sind als Chart-Palette messbar nicht unterscheidbar
(purple/violet ΔE 1,1). Die Identität steht als Wort daneben.

Unter **Mehr → Design-Tokens** rendert die App alle Skalen und misst die
Kontraste im laufenden Theme.

## Prüfen

```bash
pnpm test            # 70 Unit-Tests (Geld, Perioden, Amortisierung, Aggregation, Export)
pnpm check:a11y      # axe über alle Screens, hell und dunkel, plus Trefferflächen
pnpm check:flow      # Erfassen, Bearbeiten, Löschen, Rückgängig, Neuladen
pnpm check:offline   # Service Worker, Precache, Manifest, offline erfassen
pnpm check:visual    # Screenshots nach /tmp/mm-shots
```

Die vier `check:`-Skripte brauchen einen laufenden `pnpm preview` auf Port 4173.

## Auf dem iPhone testen

Service Worker brauchen HTTPS — über die LAN-IP per HTTP registriert sich
keiner:

```bash
pnpm build && pnpm preview
npx cloudflared tunnel --url http://localhost:4173
```

Die HTTPS-Adresse auf dem iPhone öffnen, dann Teilen → „Zum Home-Bildschirm“.

## Bewusst nicht drin

Geräte-Sync · Einnahmen und Saldo · Budgets · Belegfotos · Push-Erinnerungen ·
wiederkehrende variable Ausgaben · Mehrwährung.
