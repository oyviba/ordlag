export const LISTS = {
  n1: {
    name: "Nivå 1",
    words:
      "i på og er en et ei jeg du han hun vi de det den se ser har var kan vil til av ut inn opp ned nå her der ja nei mor far sol is bil hus ku ball to tre fem seks ti bok sko lue mus sau gris hest fisk melk mat tak vei dør rød blå hvit gul god ny tog båt fly lek",
  },
  n2: {
    name: "Nivå 2",
    words:
      "ikke som men med for fra skal sa om når hva hvor hvem meg deg seg oss dem min din sin får tar går kom liten stor mamma pappa katt hund skole venn hjem hvis bra fin glad sint redd spise drikke leke løpe hoppe sove lese skrive tegne synge bord stol seng dyr fugl blomst skog vann snø regn morgen kveld bror søster bestemor bestefar",
  },
  n3: {
    name: "Nivå 3",
    words:
      "eller over under etter foran bak mellom gjennom alltid aldri kanskje fordi sammen hjemme borte gjerne også bare noen ingen mange alle hvordan hvorfor akkurat ganske derfor endelig plutselig egentlig sikkert nesten heller allerede fremdeles igjen tidlig sent vanskelig morsom kjedelig spennende begynne slutte forstå tenke huske prøve fortelle spørre svare vinter sommer høst bursdag",
  },
  egen: { name: "Egen liste", words: "" },
};
export const STICKERS = [
  ["🦊", "rev"],
  ["🐻", "bjørn"],
  ["🐸", "frosk"],
  ["🦉", "ugle"],
  ["🐢", "skilpadde"],
  ["🐧", "pingvin"],
  ["🦔", "pinnsvin"],
  ["🐿️", "ekorn"],
  ["🐞", "marihøne"],
  ["🐝", "bie"],
  ["🦋", "sommerfugl"],
  ["🐌", "snegle"],
  ["🐼", "panda"],
  ["🐯", "tiger"],
  ["🦁", "løve"],
  ["🐵", "ape"],
  ["🐨", "koala"],
  ["🦒", "sjiraff"],
  ["🐙", "blekksprut"],
  ["🐳", "hval"],
  ["🐬", "delfin"],
  ["🦩", "flamingo"],
  ["🦜", "papegøye"],
  ["🦄", "enhjørning"],
  ["🐱", "katt"],
  ["🐶", "hund"],
  ["🐰", "kanin"],
  ["🐭", "mus"],
  ["🐹", "hamster"],
  ["🐮", "ku"],
  ["🐷", "gris"],
  ["🐴", "hest"],
  ["🐑", "sau"],
  ["🐐", "geit"],
  ["🐔", "høne"],
  ["🐥", "kylling"],
  ["🦆", "and"],
  ["🦢", "svane"],
  ["🐺", "ulv"],
  ["🦌", "hjort"],
  ["🦦", "oter"],
  ["🦭", "sel"],
  ["🐘", "elefant"],
  ["🦛", "flodhest"],
  ["🦓", "sebra"],
  ["🐊", "krokodille"],
  ["🦈", "hai"],
  ["🐠", "fisk"],
  ["🦀", "krabbe"],
  ["🐪", "kamel"],
  ["🦘", "kenguru"],
  ["🦥", "dovendyr"],
  ["🦖", "dinosaur"],
  ["🐉", "drage"],
  ["🦍", "gorilla"],
  ["🦧", "orangutang"],
  ["🦝", "vaskebjørn"],
  ["🐻‍❄️", "isbjørn"],
  ["🐆", "leopard"],
  ["🦏", "neshorn"],
  ["🦬", "bison"],
  ["🐂", "okse"],
  ["🐗", "villsvin"],
  ["🐏", "vær"],
  ["🦙", "lama"],
  ["🐩", "puddel"],
  ["🐀", "rotte"],
  ["🦫", "bever"],
  ["🦇", "flaggermus"],
  ["🦨", "stinkdyr"],
  ["🦡", "grevling"],
  ["🦣", "mammut"],
  ["🦃", "kalkun"],
  ["🐓", "hane"],
  ["🕊️", "due"],
  ["🦅", "ørn"],
  ["🦚", "påfugl"],
  ["🦤", "dodo"],
  ["🦕", "langhals"],
  ["🐡", "kulefisk"],
  ["🦐", "reke"],
  ["🦞", "hummer"],
  ["🦑", "akkar"],
  ["🦪", "østers"],
  ["🐛", "larve"],
  ["🐜", "maur"],
  ["🦗", "gresshoppe"],
  ["🪲", "bille"],
  ["🕷️", "edderkopp"],
  ["🦂", "skorpion"],
  ["🪱", "meitemark"],
  ["🐍", "slange"],
  ["🦎", "øgle"],
];
export const PER_STICKER = 20;

/* Sentence parts (bokmål). Kept simple so every combination is grammatical. */
export const P = {
  subj: [
    "jeg",
    "du",
    "han",
    "hun",
    "vi",
    "de",
    "mamma",
    "pappa",
    "katten",
    "hunden",
    "gutten",
    "jenta",
    "bestemor",
    "bestefar",
  ],
  subjSing: [
    "jeg",
    "du",
    "han",
    "hun",
    "mamma",
    "pappa",
    "katten",
    "hunden",
    "gutten",
    "jenta",
    "bestemor",
    "bestefar",
  ],
  subjQ: ["du", "han", "hun", "mamma", "pappa", "bestemor", "bestefar"],
  vt: ["ser", "har", "liker", "tar", "finner", "får", "maler", "tegner"],
  obj: [
    "en ball",
    "en bok",
    "en katt",
    "en hund",
    "et hus",
    "en bil",
    "en sko",
    "en lue",
    "en blomst",
    "et brev",
    "en båt",
    "et tog",
    "en stein",
    "en kopp",
    "en drage",
  ],
  food: ["et eple", "en is", "en bolle", "brød", "fisk", "en banan", "en pære", "ost", "en kake"],
  vi: ["sitter", "leker", "løper", "sover", "står", "er", "hopper", "venter", "synger"],
  place1: ["hjemme", "ute", "inne", "der", "her", "borte"],
  place2: [
    "i huset",
    "på skolen",
    "i bilen",
    "i senga",
    "i parken",
    "i skogen",
    "på stranda",
    "på taket",
    "i hagen",
    "på badet",
    "på bussen",
    "i barnehagen",
  ],
  adj: [
    "glad",
    "trøtt",
    "sulten",
    "sint",
    "sterk",
    "stille",
    "rask",
    "redd",
    "blid",
    "kald",
    "varm",
  ],
  conj: ["og", "men"],
};
export const r = a => a[Math.floor(Math.random() * a.length)];
export const sp = s => s.split(" ");
export function sentence(len) {
  const short = [
    () => [r(P.subj), r(P.vt), ...sp(r(P.obj))],
    () => [r(P.subj), "spiser", ...sp(r(P.food))],
    () => [r(P.subj), r(P.vi), r(P.place1)],
    () => [r(P.subjSing), "er", r(P.adj)],
    () => ({ q: true, w: [r(P.vt), r(P.subjQ), ...sp(r(P.obj))] }),
  ];
  const long = [
    () => [r(P.subj), r(P.vi), ...sp(r(P.place2))],
    () => [r(P.subj), r(P.vt), ...sp(r(P.obj)), ...sp(r(P.place2))],
    () => [r(P.subj), "spiser", ...sp(r(P.food)), ...sp(r(P.place2))],
    () => {
      const a = r(P.obj);
      let b = r(P.obj);
      while (b === a) b = r(P.obj);
      return [r(P.subj), r(P.vt), ...sp(a), "og", ...sp(b)];
    },
    () => [r(P.subjSing), "er", r(P.adj), r(P.conj), r(P.subjSing), "er", r(P.adj)],
    () => ({ q: true, w: [r(P.vt), r(P.subjQ), ...sp(r(P.obj)), ...sp(r(P.place2))] }),
  ];
  let res = r(len === "lang" ? long : short)();
  const q = !Array.isArray(res);
  const w = q ? res.w : res;
  w[0] = w[0][0].toUpperCase() + w[0].slice(1);
  w[w.length - 1] += q ? "?" : ".";
  return w;
}

/* Arithmetic tasks. Answers are always whole numbers from 0 and up; × and : use the 1–10 tables, capped by max. */
export const OPS = { "+": "+", "-": "−", "*": "·", "/": ":" };
const ri = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
export function mathTask(ops, max) {
  const op = r(ops.length ? ops : ["+"]);
  let a, b, ans;
  if (op === "+") {
    ans = ri(0, max);
    a = ri(0, ans);
    b = ans - a;
  } else if (op === "-") {
    a = ri(0, max);
    b = ri(0, a);
    ans = a - b;
  } else if (op === "*") {
    do {
      a = ri(1, 10);
      b = ri(1, 10);
    } while (a * b > max);
    ans = a * b;
  } else {
    do {
      b = ri(1, 10);
      ans = ri(0, 10);
    } while (b * ans > max);
    a = b * ans;
  }
  const opts = new Set([ans]);
  const spread = max > 20 ? [1, 2, 10, -1, -2, -10, 3, -3] : [1, 2, -1, -2, 3, -3, 4];
  while (opts.size < 4) {
    const v = ans + r(spread);
    if (v >= 0) opts.add(v);
  }
  return { a, b, op, ans, opts: [...opts].sort(() => Math.random() - 0.5) };
}

/* Look-alike distractors for Lytt: closest words by edit distance, nudged towards same first letter and length. */
export function lev(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
export function lookalikes(word, pool, n) {
  const score = w =>
    lev(word, w) +
    (w[0] === word[0] ? 0 : 0.5) +
    Math.abs(w.length - word.length) * 0.3 +
    Math.random() * 0.8;
  return pool
    .filter(w => w !== word)
    .map(w => /** @type {[number, string]} */ ([score(w), w]))
    .sort((a, b) => a[0] - b[0])
    .slice(0, n)
    .map(x => x[1]);
}
