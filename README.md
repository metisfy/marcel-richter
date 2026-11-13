# Marcel Richter – Website

Persönliche Website mit Projekten und dem aktuellen Spielplan des TSV Pfuhl (1. Herren, Volleyball,
Bezirksliga Schwaben). Zweisprachig (Deutsch als Standard, Englisch unter `/en`), statisch
generiert, ausgeliefert als Docker-Container. Spielplan, Ergebnisse und Tabelle kommen live vom
Bayerischen Volleyball-Verband.

- **Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS 4, next-intl, MDX/YAML-Inhalte
- **Betrieb:** Docker-Image in der GitHub Container Registry, Deployment per GitHub Actions + SSH
- **Qualität:** Lighthouse (mobil) 97–100 in allen Kategorien, WCAG AA, helles/dunkles Design,
  strukturierte Daten (Person, SportsTeam, SportsEvent, CreativeWork), OG-Bilder je Seite

> **Texte und Bilder sind größtenteils Platzhalter** (Verein, Liga und Spielplan sind echt). Was du
> ersetzen musst, steht unter
> [Vor dem Livegang](#vor-dem-livegang).

---

## Inhalt

1. [Lokal entwickeln](#lokal-entwickeln)
2. [Inhalte pflegen](#inhalte-pflegen)
3. [Seiten und URLs](#seiten-und-urls)
4. [Deployment](#deployment)
5. [GitHub Secrets & Variablen](#github-secrets--variablen)
6. [Rollback](#rollback)
7. [Reverse Proxy](#reverse-proxy)
8. [Technische Hinweise](#technische-hinweise)
9. [Vor dem Livegang](#vor-dem-livegang)

---

## Lokal entwickeln

Voraussetzung: Node.js 24 (siehe `.nvmrc`).

```bash
npm ci            # Abhängigkeiten installieren
npm run dev       # Entwicklungsserver auf http://localhost:3000
npm run lint      # ESLint
npm run typecheck # TypeScript
npm run build     # Produktions-Build (genau wie in der Pipeline)
```

Den fertigen Standalone-Server lokal starten (so läuft er auch im Container):

```bash
npm run build
cp -R public .next/standalone/ && cp -R .next/static .next/standalone/.next/
npm start         # http://localhost:3000
```

Das Docker-Image lokal bauen und starten:

```bash
docker build --build-arg SITE_URL=http://localhost:3100 -t marcel-richter:local .
docker run --rm -p 3100:3000 marcel-richter:local
```

---

## Inhalte pflegen

Alle Inhalte liegen im Ordner **`content/`** als YAML- und MDX-Dateien. Code musst du dafür
nicht anfassen. Ändern, committen, pushen: Nach wenigen Minuten ist die Änderung live.

Am einfachsten geht das direkt auf GitHub: Datei öffnen → Stift-Symbol → bearbeiten → „Commit
changes“. Neue Bilder lädst du über „Add file → Upload files“ in den passenden Ordner unter
`public/images/` hoch.

**Fehler werden vor dem Livegang abgefangen.** Jede Inhaltsdatei wird beim Build geprüft. Fehlt
ein Pflichtfeld, stimmt ein Datum nicht oder existiert ein Bild nicht, schlägt der Check fehl und
nennt Datei und Feld, z. B.:

```
Ungültiger Inhalt in content/saison/2026-27.yaml:
✖ Ergebnis als "Heim:Gast", z. B. "3:1"
  → at fixtures[9].result
```

Die Live-Seite bleibt dann unverändert.

### Zweisprachige Texte

Überall in den YAML-Dateien kann ein Text entweder für beide Sprachen gelten oder je Sprache
angegeben werden. Fehlt `en`, wird der deutsche Text angezeigt.

```yaml
name: Marcel Richter                 # gilt für beide Sprachen
tagline:
  de: Ich entwickle Websites und Web-Apps …
  en: I build websites and web apps …
label: { de: Asse, en: Aces }        # Kurzschreibweise
```

### Stammdaten: `content/site.yaml`

Name, Berufsbezeichnung, Kurzvorstellung, E-Mail, Porträt, Social-Profile, Copyright-Vermerk und
Verein (Name, Sportart, Liga, Position, Rückennummer, optional Website und Logo). Diese Angaben
stehen auf der Startseite, in der Fußzeile, auf der Kontaktseite und in den strukturierten Daten
für Suchmaschinen. Die Rückennummer erscheint zusätzlich im blauen Feld neben dem Namen.

```yaml
copyright:                           # Fußzeile: „© 2026 metisCode · metisOne“
  - label: metisCode
    url: https://metiscode.com
  - label: metisOne
    url: https://metisone.de
```

Die nummerierten Karten im Abschnitt „Über mich“ auf der Startseite (01, 02, …) kommen aus
`highlights`:

```yaml
highlights:
  - title: { de: Volleyball, en: Volleyball }
    text: { de: Erste Herrenmannschaft des TSV Pfuhl …, en: First men's team of TSV Pfuhl … }
```

### Projekte: `content/projekte/<slug>/de.mdx` (+ `en.mdx`)

Ein Ordner pro Projekt. Der Ordnername wird zur URL (`/projekte/vereins-app`,
`/en/projects/vereins-app`), also nur Kleinbuchstaben, Ziffern und Bindestriche verwenden.

```mdx
---
title: Vereins-App für einen Sportverein
summary: Ein Satz für Übersicht, Suchmaschinen und Vorschaubild.
date: 2026-05-01                        # sortiert die Liste (neueste zuerst)
cover: /images/projekte/vereins-app.jpg
coverAlt: Beschreibung des Titelbilds für Screenreader
role: Konzept & Entwicklung             # optional
tags: [Next.js, PWA]                    # optional
featured: true                          # optional: bevorzugt auf der Startseite
draft: false                            # optional: true = nur lokal sichtbar
links:                                  # optional
  - label: Zur App
    url: https://example.com
---

Hier steht der Text in **Markdown**. Überschriften mit `##`, Listen mit `-`.

<Figure src="/images/projekte/screenshot.jpg" alt="…" caption="Optionale Bildunterschrift" />
```

- **`en.mdx`** braucht nur, was sich unterscheidet (meist `title`, `summary`, `coverAlt` und den
  Text). Alles andere übernimmt es aus `de.mdx`.
- **Ohne `en.mdx`** zeigt die englische Seite den deutschen Text mit dem Hinweis „only available in
  German“. Ein Beispiel dafür ist `saison-in-bildern`.
- Für Bilder im Text `<Figure … />` verwenden. Die Bilder werden dann automatisch in passenden
  Größen und modernen Formaten (AVIF/WebP) ausgeliefert.

### Saison: `content/saison/<JJJJ-JJ>.yaml`

Eine Datei pro Saison. **Die Datei mit dem höchsten Namen ist die aktuelle Saison**, alle anderen
erscheinen unter „Frühere Saisons“. Für eine neue Saison die alte Datei kopieren, z. B.
`2027-28.yaml`, und anpassen.

#### Spielplan live vom BVV (Standard)

```yaml
season: "2026/27"
league: { de: Bezirksliga Schwaben, en: Bezirksliga Schwaben (Bavaria) }
summary: { de: …, en: … }                # optional
bvv:
  url: https://volleyball.bayern/ergebnisse/erwachsene/schwaben/wettbewerb-44600
  team: TSV Pfuhl                        # genau wie auf der BVV-Seite geschrieben
stats:                                   # optional, eigene Zahlen als zusätzliche Kacheln
  - label: { de: Asse, en: Aces }
    value: 11
```

- **Woher kommt die URL?** Auf [volleyball.bayern](https://volleyball.bayern/ergebnisse) unter
  Ergebnisse → Erwachsene → Bezirk → Liga. Die Adresse endet auf `/wettbewerb-<Nummer>` und ändert
  sich mit jeder Saison, also für `2027-28.yaml` die neue Ligaseite eintragen.
- Die Website liest dort alle Spiele, Ergebnisse, Sätze und die Tabelle. Daraus entstehen auf der
  Saisonseite Bilanz, Spielplan (mit Ausrichter des Spieltags) und Tabelle, auf der Startseite
  letztes Spiel, nächster Spieltag und Tabellenplatz.
- **Aktualisierung:** Startseite und Saisonseite werden höchstens einmal pro Stunde im Hintergrund
  neu erzeugt (`export const revalidate = 3600`). Neue Ergebnisse erscheinen also spätestens nach
  etwa einer Stunde, **ohne neues Deployment**. Der BVV wird dabei höchstens einmal pro Stunde
  abgefragt, egal wie viele Besucher kommen.
- **Wenn der BVV nicht erreichbar ist:** Im laufenden Betrieb bleibt einfach der letzte Stand
  stehen. Beim Build läuft das Deployment trotzdem durch, die Seite zeigt dann einen Hinweis mit
  Link zur Ligaseite und lädt die Daten eine Stunde später nach.
- **Wenn der BVV seine Seite umbaut,** findet der Parser (`src/lib/bvv.ts`) keine Spiele mehr. Im
  Build-Log steht dann „⚠ Spielplan vom BVV nicht geladen …“.
- Der BVV bietet Vereinen auch eine offizielle Schnittstelle mit API-Key an
  ([Tools für die Vereinshomepage](https://volleyball.bayern/service/vereinshilfen/tools-fuer-deine-vereinshomepage)).
  Den Key kann nur die Abteilungsleitung im BVV-Portal anlegen. Gibt es ihn, kann `src/lib/bvv.ts`
  darauf umgestellt werden.

#### Spiele von Hand eintragen (ohne BVV, z. B. für ein Archiv)

```yaml
season: "2025/26"
league: { de: …, en: … }
standing: { position: 3, teams: 16, points: 17 }   # optional
fixtures:
  - date: "2026-11-15 14:30"             # deutsche Ortszeit, Uhrzeit optional
    opponent: SG Wiesental
    home: true                           # Heimspiel?
    venue: Sporthalle am Rosenweg        # optional
    competition: { de: Liga, en: League }  # optional
    result: "3:1"                        # Sätze, IMMER Heim:Gast – leer = noch nicht gespielt
    sets: "25:21 22:25 25:19 25:17"      # optional, Sätze ebenfalls aus Sicht der Heimmannschaft
    note: { de: Meisterschaft perfekt, en: Title secured }  # optional
```

- **„Nächstes Spiel“** auf der Startseite ist das erste Spiel ohne `result` (bei mehreren Spielen
  am selben Tag der ganze Spieltag). Nach dem Spiel also einfach das Ergebnis eintragen.
- Sieg und Niederlage werden aus `result` und `home` berechnet. Ein Unentschieden lehnt die
  Prüfung ab, das gibt es im Volleyball nicht.
- Passen die einzelnen Sätze in `sets` nicht zum Endstand in `result`, bricht der Build mit einer
  Meldung ab, die Datum und Gegner nennt.
- Datum, Ergebnis und Sätze in Anführungszeichen setzen (`"3:1"`), wie im Beispiel.

### Einzelseiten: `content/seiten/`

`ueber-mich`, `impressum` und `datenschutz` jeweils als `<name>.de.mdx` und `<name>.en.mdx`, mit
`title` und `description` im Kopf und Markdown-Text darunter.

### Oberflächentexte: `messages/de.json`, `messages/en.json`

Navigation, Buttons, Überschriften und Hinweise. Beide Dateien müssen dieselben Schlüssel haben,
sonst schlägt der Typecheck fehl.

### Bilder

Alle Bilder liegen unter `public/images/` und werden in den Inhalten mit `/images/…` angegeben.
Erlaubt sind `.jpg`, `.png`, `.webp`, `.avif` und `.svg`. Jedes Bild braucht einen
Alternativtext (`alt`, `coverAlt`, `portraitAlt`), der beschreibt, was zu sehen ist.

---

## Seiten und URLs

| Seite       | Deutsch                | Englisch                   |
| ----------- | ---------------------- | -------------------------- |
| Home        | `/`                    | `/en`                      |
| Über mich   | `/ueber-mich`          | `/en/about`                |
| Projekte    | `/projekte`            | `/en/projects`             |
| Projekt     | `/projekte/<slug>`     | `/en/projects/<slug>`      |
| Saison      | `/saison`              | `/en/season`               |
| Kontakt     | `/kontakt`             | `/en/contact`              |
| Impressum   | `/impressum`           | `/en/legal-notice`         |
| Datenschutz | `/datenschutz`         | `/en/privacy`              |

Außerdem: `/sitemap.xml`, `/robots.txt`, `/api/health` (Healthcheck), `/og/<sprache>/<seite>`
(Open-Graph-Bilder). Die Sprache wird nie automatisch umgestellt, `/` ist immer Deutsch. Der
Umschalter im Kopf führt jeweils zur selben Seite in der anderen Sprache. Die Seite setzt keine
Cookies.

---

## Deployment

```
Pull Request ──► Checks (Install, Lint, Typecheck, Build) ──► Merge nur wenn grün
                                                                     │
Push auf main ──► Checks ──► Docker-Image bauen ──► ghcr.io (:latest + :<commit-sha>)
                                                                     │
                     SSH auf den Server: docker-compose.yml + start.sh kopieren,
                     ./start.sh <sha>  →  docker compose pull && docker compose up -d
                                                                     │
                     Healthcheck: <SITE_URL>/api/health muss <sha> melden ──► ✓ / ✗
```

| Workflow | Datei | Auslöser |
| --- | --- | --- |
| **Checks** | `.github/workflows/ci.yml` | jeder Pull Request, jeder Push auf andere Branches als `main` |
| **Deploy** | `.github/workflows/deploy.yml` | Push auf `main`, manuell („Run workflow“, auch für Rollbacks) |

Pushes auf `main` prüft der Deploy-Workflow selbst: Er ruft als ersten Schritt genau den
Checks-Workflow auf. So wird nichts doppelt geprüft, und ohne grüne Checks wird nichts gebaut oder
ausgerollt.

**Der Live-Healthcheck vergleicht die Version.** `/api/health` liefert den Commit-SHA des
laufenden Images. Der Workflow ist erst grün, wenn die Live-URL genau den gerade ausgerollten
Commit meldet. Ein alter Container, der noch antwortet, zählt also nicht als Erfolg. Der SHA steht
auch klein in der Fußzeile.

**Ohne SSH-Zugang bleibt der Lauf grün.** Fehlen die Secrets `SSH_HOST`, `SSH_USER` oder
`SSH_PRIVATE_KEY`, baut der Workflow das Image wie gewohnt, überspringt aber das Ausrollen und
meldet in der Zusammenfassung den Befehl für den Server (`./start.sh <sha>`). Das ist der
Normalfall, solange der Server nur im internen Netz erreichbar ist: GitHub kann ihn dann nicht per
SSH erreichen. Sobald die Secrets gesetzt sind, rollt der Workflow selbst aus und wird bei jedem
Fehler rot. Ein manueller Rollback über „Run workflow“ schlägt ohne SSH-Zugang absichtlich fehl.

**Automatischer Rollback auf dem Server.** Wird die neue Fassung im Container nicht „healthy“,
startet `start.sh` sofort wieder die vorherige und beendet sich mit Fehler. Damit schlägt auch der
Workflow fehl.

### Einmalige Einrichtung

**1. Server vorbereiten** (Linux mit Docker und Docker Compose v2):

```bash
# Eigener Deploy-Benutzer mit Docker-Rechten (empfohlen)
sudo adduser --disabled-password deploy
sudo usermod -aG docker deploy

# SSH-Schlüssel nur für GitHub Actions erzeugen (lokal, ohne Passphrase)
ssh-keygen -t ed25519 -C "github-actions-marcel-richter" -f ./deploy_key -N ""
# Öffentlichen Teil auf den Server:
ssh-copy-id -i ./deploy_key.pub deploy@<server>
```

Den Ordner auf dem Server legt der Workflow selbst an (Standard: `~/marcel-richter` des
Deploy-Benutzers). `docker-compose.yml` und `start.sh` werden bei jedem Deployment dorthin kopiert.

**2. Secrets und Variablen anlegen**, siehe nächster Abschnitt.

**3. Reverse Proxy einrichten**, siehe [Reverse Proxy](#reverse-proxy).

**4. Merge nur bei grünen Checks erzwingen.** Unter *Settings → Rules → Rulesets → New branch
ruleset*:
- Target: Default branch (`main`)
- ☑ *Require a pull request before merging*
- ☑ *Require status checks to pass* → Check **`Lint, Typecheck & Build`** hinzufügen. Er taucht
  in der Auswahl auf, sobald er einmal in einem Pull Request gelaufen ist.
- ☑ *Block force pushes*

> Rulesets bzw. Branch-Schutz gibt es bei **privaten** Repositories erst ab GitHub Pro/Team. Bei
> öffentlichen Repositories sind sie kostenlos.

**5. Ersten Deploy auslösen:** auf `main` pushen oder *Actions → Deploy → Run workflow*.

**6. GHCR-Paket prüfen:** Nach dem ersten Lauf erscheint das Paket unter *Profil → Packages →
marcel-richter*. Ist es privat, braucht der Server `GHCR_TOKEN` (siehe unten). Ist es
öffentlich, geht es ohne.

---

## GitHub Secrets & Variablen

Anlegen unter *Settings → Secrets and variables → Actions*. Zugangsdaten stehen **nur** in
Secrets, nie im Code. Nicht geheime Einstellungen sind Variablen.

### Secrets (Tab „Secrets“)

| Name | Pflicht | Inhalt |
| --- | --- | --- |
| `SSH_HOST` | ✅ | Hostname oder IP des Servers |
| `SSH_USER` | ✅ | SSH-Benutzer auf dem Server, z. B. `deploy` (muss Docker nutzen dürfen) |
| `SSH_PRIVATE_KEY` | ✅ | Inhalt von `deploy_key` (privater Schlüssel, inkl. `-----BEGIN …-----`-Zeilen) |
| `SSH_KNOWN_HOSTS` | empfohlen | Ausgabe von `ssh-keyscan -p <port> <server>`. Pinnt den Host-Key gegen Man-in-the-Middle. Fehlt er, übernimmt der Workflow den Key ungeprüft und warnt. |
| `SSH_PORT` | – | SSH-Port, Standard `22` |
| `GHCR_TOKEN` | bei privatem Paket | Personal Access Token (classic) mit nur **`read:packages`**. Damit meldet sich der Server bei ghcr.io an. |
| `GHCR_USER` | – | GitHub-Benutzer zum Token, Standard ist der Repo-Besitzer |

Zum **Pushen** des Images braucht es kein eigenes Token. Der Workflow nutzt dafür das automatische
`GITHUB_TOKEN`.

### Variablen (Tab „Variables“)

| Name | Pflicht | Inhalt |
| --- | --- | --- |
| `SITE_URL` | ✅ | Öffentliche Adresse ohne Schrägstrich am Ende, z. B. `https://www.marcel-richter.de`. Wird ins Image gebaut (Canonical, hreflang, Sitemap, OG-Bilder) und für den Healthcheck genutzt. |
| `DEPLOY_PATH` | – | Ordner auf dem Server, absolut oder relativ zum Home-Verzeichnis. Standard `marcel-richter` |

Fehlt ein Pflichtwert, bricht der Deploy-Job mit einer Meldung ab, die genau den fehlenden Wert
nennt.

---

## Rollback

Jedes Image ist mit seinem Commit-SHA getaggt. Ein Rollback startet einfach das Image eines
früheren Commits. Gebaut wird dabei nichts.

**Variante 1 – über GitHub (empfohlen):**
*Actions → Deploy → Run workflow* → im Feld **„Rollback: Commit-SHA …“** den Commit eintragen
(kurz `a1b2c3d` oder lang) → *Run workflow*. Checks und Build werden übersprungen. Der Workflow
prüft, ob es das Image gibt, rollt es aus und macht den Live-Healthcheck.

Den passenden Commit findest du unter *Actions → Deploy* (frühere erfolgreiche Läufe) oder mit
`git log --oneline`.

**Variante 2 – direkt auf dem Server:**

```bash
cd ~/marcel-richter
./start.sh --list                 # aktive und lokal vorhandene Fassungen
./start.sh <voller-commit-sha>    # diese Fassung starten
```

`start.sh` schreibt den Tag nach `.env` (`IMAGE_TAG=…`). Die Fassung bleibt also auch nach einem
Server-Neustart aktiv. Die letzten fünf Fassungen bleiben lokal liegen und starten deshalb auch
ohne Registry sofort.

**Danach:** Der nächste Push auf `main` rollt wieder den neuesten Stand aus. Soll der fehlerhafte
Stand nicht zurückkommen, den Commit per `git revert` rückgängig machen und pushen.

---

## Reverse Proxy

Der Container lauscht auf Port `3100` aller Schnittstellen des Servers, z. B. `http://10.250.1.30:3100`.
Beides lässt sich in der `.env` neben der `docker-compose.yml` auf dem Server ändern:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `HOST_PORT` | `3100` | Port auf dem Server |
| `BIND_IP` | `0.0.0.0` | `127.0.0.1` = nur vom Server selbst erreichbar (wenn der Proxy direkt auf dem Host läuft) |

Docker umgeht mit `0.0.0.0` die Firewall (ufw): Der Port ist überall offen, wo der Server
erreichbar ist. Nach einer Änderung `./start.sh` ausführen.

- **Nginx Proxy Manager:** Proxy Host anlegen, Forward auf `http://<Server-IP>:3100`.
- **Nginx/Caddy auf dem Host:** Beispiel in `deploy/nginx.conf.example` (HTTPS, Weiterleitung auf
  `www`, HSTS, Proxy-Header).
- **Traefik als Container:** In `docker-compose.yml` den `ports:`-Block durch die
  auskommentierten `labels`/`networks` ersetzen und Domain sowie Netzwerknamen anpassen.

Der Proxy sollte `X-Forwarded-Proto` und `X-Forwarded-Host` setzen (im Beispiel enthalten).

---

## Technische Hinweise

- **Statisch:** Alle Seiten, OG-Bilder, Sitemap und robots.txt entstehen beim Build. Zur Laufzeit
  rendert der Server nur Startseite und Saisonseite neu, und zwar höchstens stündlich im
  Hintergrund (ISR, wegen der BVV-Daten). `src/proxy.ts` ordnet jede Anfrage einer Sprache zu und
  übersetzt die Pfade. Der Container braucht dafür ausgehend Zugriff auf `volleyball.bayern`
  (HTTPS).
- **`skipProxyUrlNormalize: true` in `next.config.ts` nicht entfernen.** Ohne diese Option
  erzeugt Next.js 16 im Standalone-Server (also im Container) für jede deutsche Seite eine
  307-Endlosschleife und hinter dem Reverse Proxy einen 500er. `next dev` ist davon nicht
  betroffen, der Fehler zeigt sich nur im Container. Details im Kommentar dort.
- **404-Seiten:** Unbekannte Pfade bekommen eine statische, zweisprachige 404-Seite
  (`src/app/not-found.tsx`). Diese Lösung ist bewusst so gewählt: Ein `notFound()` innerhalb
  einer Seite liefert in Next.js 16.4 zwar Status 404, die Seite wird aber erst im Browser
  gerendert.
- **Design:** angelehnt an [metisone.de](https://metisone.de) (Farben, Inter + JetBrains Mono,
  16 px Rundungen, Mono-Beschriftungen, Karten mit feinen Rahmen). Farben als CSS-Variablen in
  `src/app/globals.css`, alle Text-Kombinationen erfüllen WCAG AA in beiden Designs. Für Text und
  Buttons immer `accent` (#3a63d9) verwenden. Das hellere metis-Blau `accent-bright` (#4f7dff)
  erreicht auf Weiß nur 3,7:1 und ist deshalb nur für Flächen, Icons und große Überschriften gedacht.
- **Schrift:** Inter und JetBrains Mono über `next/font` (`src/lib/fonts.ts`), beim Build
  heruntergeladen und vom eigenen Server ausgeliefert. Für die Open-Graph-Bilder liegen statische
  TTF-Schnitte in `src/app/og/fonts/`.
- **Sicherheit:** Container ohne Root, ohne Linux-Capabilities, `no-new-privileges`. Dazu
  Sicherheits-Header (`X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Content-Type-Options`), keine Cookies, keine externen Ressourcen im Browser (die BVV-Daten
  holt der Server).
- **Node.js-Version** an drei Stellen: `.nvmrc` (lokal und CI), `Dockerfile` (`NODE_VERSION`) und
  `engines` in `package.json`.

### Projektstruktur

```
content/                 Inhalte (YAML + MDX)
messages/                Oberflächentexte de/en
public/images/           Bilder
src/app/[locale]/        Seiten (Ordnernamen = interne deutsche Routen)
src/app/og/              Open-Graph-Bilder
src/app/api/health/      Healthcheck
src/components/          UI-Komponenten
src/i18n/                Sprachen, übersetzte Pfade, Navigation
src/lib/content.ts       Lädt und prüft alle Inhalte
src/lib/bvv.ts           Liest Spielplan und Tabelle von der BVV-Ligaseite
src/lib/season.ts        Führt Saisondatei und BVV-Daten zusammen (stündlich)
src/lib/structured-data.ts  schema.org / JSON-LD
src/proxy.ts             Sprach-Routing
Dockerfile               Multi-Stage-Build (Node LTS Alpine)
docker-compose.yml       Betrieb auf dem Server
start.sh                 Ausrollen/Rollback auf dem Server
.github/workflows/       Checks + Deploy
deploy/                  Beispielkonfiguration Nginx
```

---

## Vor dem Livegang

- [ ] `content/site.yaml`: echte Daten (Texte, E-Mail, Social-Links, Position, Rückennummer);
      Vereinslogo nur mit Erlaubnis des TSV Pfuhl einbinden
- [ ] `public/images/portrait.jpg` und alle Beispielbilder ersetzen
- [ ] Projekte und „Über mich“ in `content/` mit echten Inhalten füllen
- [ ] **Impressum und Datenschutz** (Betreiber: metisOne UG, Geschäftsführer Marcel Richter,
      Auslieferung über Cloudflare) rechtlich prüfen lassen
- [ ] GitHub Secrets und die Variable `SITE_URL` anlegen
- [ ] Reverse Proxy mit HTTPS einrichten, DNS auf den Server zeigen lassen
- [ ] Ruleset für `main` anlegen (Merge nur bei grünen Checks)
- [ ] Nach dem ersten Deploy: Lighthouse auf der Live-URL prüfen,
      [Rich Results Test](https://search.google.com/test/rich-results) für die strukturierten Daten
