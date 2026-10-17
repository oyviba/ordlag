# Ordblikk

Leseøving for barn: ordbilder, korte setninger og lynrunde, med klistremerker som belønning.
Installerbar web-app (PWA) som fungerer uten nett etter første besøk. All fremgang lagres lokalt på enheten.

## Kom i gang

```bash
npm install
npm run dev       # utviklingsserver
npm run build     # produksjonsbygg i dist/
npm run preview   # test bygget lokalt (inkl. service worker)
```

`dist/` er en ren statisk side og kan legges på hvilken som helst statisk host (Netlify, Vercel, GitHub Pages, Cloudflare Pages).
På iPad/iPhone: åpne siden i Safari → Del → «Legg til på Hjem-skjerm».

## Struktur

- `index.html` – markup
- `src/main.js` – app-logikk (moduser, fremgang, innstillinger)
- `src/data.js` – ordlister, klistremerker og setningsgenerator
- `src/effects.js` – lyd, konfetti, skjermlås
- `src/storage.js` – localStorage-hjelpere
- `src/style.css` – stiler
- `public/icon.svg` – app-ikon; kjør `npm run icons` for å lage PNG-ikonene på nytt etter endring
