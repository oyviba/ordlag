import { lev } from "./data.js";

/* Speech recognition: the child reads aloud and we check which words were heard. */
const SR =
  /** @type {any} */ (window).SpeechRecognition ||
  /** @type {any} */ (window).webkitSpeechRecognition;
export const canHear = !!SR;

// Recognisers write numbers as digits and pick one spelling of words that sound alike.
const NUM = {
  0: "null",
  1: "en",
  2: "to",
  3: "tre",
  4: "fire",
  5: "fem",
  6: "seks",
  7: "sju",
  8: "åtte",
  9: "ni",
  10: "ti",
  11: "elleve",
  12: "tolv",
};
const SAME = {
  og: ["å"],
  å: ["og"],
  ett: ["en", "1"],
  en: ["ett", "én"],
  sju: ["syv"],
  syv: ["sju"],
  de: ["di"],
  hjem: ["jem"],
};

const tokenize = s =>
  s
    .toLowerCase()
    .replace(/[.,!?;:«»"]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(t => NUM[t] || t);

/** Short words must match exactly; longer ones may be one letter off, since recognisers misspell. */
export const matches = (word, tok) =>
  word === tok || (SAME[word] || []).includes(tok) || (word.length >= 4 && lev(word, tok) <= 1);

let rec = null,
  timer = null;
export function startHearing({ onWords, onEnd, onError }) {
  stopHearing();
  const r = new SR();
  r.lang = "nb-NO";
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 5;
  r.onresult = e => {
    const tokens = [];
    for (const res of e.results) for (const alt of res) tokens.push(...tokenize(alt.transcript));
    onWords(tokens);
  };
  r.onerror = e => onError(e.error);
  r.onend = () => {
    clearTimeout(timer);
    if (rec === r) rec = null;
    onEnd();
  };
  rec = r;
  r.start();
  timer = setTimeout(() => finishHearing(), 10000);
}
/** Stop listening but still deliver what was said so far. */
export function finishHearing() {
  if (rec) rec.stop();
}
/** Drop the session without any more callbacks (new word set, mode change). */
export function stopHearing() {
  clearTimeout(timer);
  if (!rec) return;
  const r = rec;
  rec = null;
  r.onresult = r.onerror = r.onend = null;
  r.abort();
}
