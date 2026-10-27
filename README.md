# Ordblikk

Leseøving, regning og engelsk for barn, i tre deler med hvert sitt dagsmål:

- **Lesing:** ordbilder, korte setninger, lynrunde og lytt-og-velg, med valgfri talegjenkjenning som hører om ordene blir lest.
- **Regning:** regnestykker med + − · :.
- **Engelsk:** hør eller les et engelsk ord og trykk på riktig bilde, med temaer som dyr, farger, tall og mat.

Alle delene gir poeng til de samme klistremerkene og den samme dagsrekka.
Installerbar web-app (PWA) som fungerer uten nett etter første besøk. All fremgang lagres lokalt på enheten.

## Kom i gang

```bash
npm install
npm run dev       # utviklingsserver
npm run build     # produksjonsbygg i dist/
npm run preview   # test bygget lokalt (inkl. service worker)
npm run lint      # oxlint
npm run format    # oxfmt (CI kjører format:check)
npm run typecheck # tsc på JS-filene
```

`dist/` er en ren statisk side og kan legges på hvilken som helst statisk host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
På iPad/iPhone: åpne siden i Safari → Del → «Legg til på Hjem-skjerm».

## Struktur

- `index.html` – markup
- `src/main.js` – app-logikk (moduser, fremgang, innstillinger)
- `src/data.js` – ordlister, klistremerker, setningsgenerator, regneoppgaver og engelske ord
- `src/effects.js` – lyd, konfetti, skjermlås
- `src/storage.js` – localStorage-hjelpere
- `src/style.css` – stiler
- `public/icon.svg` – app-ikon; kjør `npm run icons` for å lage PNG-ikonene på nytt etter endring
