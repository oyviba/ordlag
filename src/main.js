import "@fontsource/andika/400.css";
import "@fontsource/andika/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./style.css";
import { LISTS, STICKERS, PER_STICKER, sp, sentence, OPS, mathTask, lookalikes } from "./data.js";
import { load, save } from "./storage.js";
import { canHear, matches, startHearing, finishHearing, stopHearing } from "./hear.js";
import { chime, confetti, requestWake, canSpeak, missingVoice, speak } from "./effects.js";

let S = Object.assign(
  {
    mode: "ord",
    readMode: "ord",
    count: 1,
    list: "n1",
    flash: 0,
    size: 3,
    build: false,
    hear: false,
    len: "kort",
    goal: 30,
    mathGoal: 20,
    dur: 60,
    sound: true,
    ops: ["+", "-"],
    max: 10,
  },
  load("ob-settings", {})
);
if (S.mode !== "regn") S.readMode = S.mode;
let marked = new Set(load("ob-marked", []));
LISTS.egen.words = load("ob-custom", "");
// The top-level total/today are reading; math keeps its own count. Both feed the shared stickers and streak.
const freshStats = () => ({
  total: 0,
  stickers: {},
  today: { date: "", n: 0 },
  math: { total: 0, today: { date: "", n: 0 } },
  streak: { last: "", n: 0 },
  best: {},
});
let stats = Object.assign(freshStats(), load("ob-stats", {}));
let current = [],
  revealIdx = 0,
  lastShown = new Set(),
  flashTimer = null;
let rewards = [];
let task = null,
  taskDone = false,
  taskTimer = null;
let listen = null;
let heard = new Set(),
  hearing = false,
  hearDone = false;
let lyn = { state: "idle", score: 0, combo: 0, missed: [], end: 0, tick: null, word: "" };

/** @type {(id: string) => any} */
const $ = id => document.getElementById(id);
/** @type {(sel: string) => NodeListOf<HTMLElement>} */
const $$ = sel => document.querySelectorAll(sel);
const clean = w => w.toLowerCase().replace(/[.,!?]/g, "");
const isMath = () => S.mode === "regn";
const side = () => (isMath() ? stats.math : stats);
const goal = () => (isMath() ? S.mathGoal : S.goal);
const stickerPoints = () => stats.total + stats.math.total;
const day = (off = 0) => new Date(Date.now() - off * 864e5).toLocaleDateString("sv");

/* ---------- Words ---------- */
function pool() {
  const arr = [
    ...new Set(
      LISTS[S.list].words
        .split(/[\s,;]+/)
        .map(w => w.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  return arr.length ? arr : sp(LISTS.n1.words);
}
function pickWords(n) {
  let p = pool();
  const fresh = p.filter(w => !lastShown.has(w));
  if (fresh.length >= n) p = fresh;
  n = Math.min(n, p.length);
  const out = [];
  while (out.length < n) {
    const items = p.filter(w => !out.includes(w));
    const weights = items.map(w => (marked.has(w) ? 4 : 1));
    let t = Math.random() * weights.reduce((a, b) => a + b, 0),
      i = 0;
    while ((t -= weights[i]) > 0) i++;
    out.push(items[i]);
  }
  lastShown = new Set(out);
  return out;
}

/* ---------- Progress & rewards ---------- */
/** Count n words read (or math tasks solved, in Regning). */
function addProgress(n) {
  const d = day();
  const sd = side();
  if (sd.today.date !== d) sd.today = { date: d, n: 0 };
  if (stats.streak.last !== d) {
    stats.streak.n = stats.streak.last === day(1) ? stats.streak.n + 1 : 1;
    stats.streak.last = d;
  }
  const goalBefore = sd.today.n >= goal();
  const before = stickerPoints();
  sd.today.n += n;
  sd.total += n;
  const earned = Math.floor(stickerPoints() / PER_STICKER) - Math.floor(before / PER_STICKER);
  for (let i = 0; i < earned; i++) rewards.push({ type: "sticker", idx: awardSticker() });
  if (!goalBefore && sd.today.n >= goal())
    rewards.push({ type: "goal", text: goal() + (isMath() ? " oppgaver" : " ord") + " i dag. " });
  save("ob-stats", stats);
  renderProgress();
  if (lyn.state !== "running") flushRewards();
}
function awardSticker() {
  const missing = STICKERS.map((_, i) => i).filter(i => !stats.stickers[i]);
  const idx = missing.length ? missing[0] : Math.floor(Math.random() * STICKERS.length);
  stats.stickers[idx] = (stats.stickers[idx] || 0) + 1;
  return idx;
}
function renderProgress() {
  const sd = side();
  const n = sd.today.date === day() ? sd.today.n : 0;
  const frac = Math.min(1, n / goal());
  $("ring").style.strokeDashoffset = 119.4 * (1 - frac);
  $("ring").style.stroke = frac >= 1 ? "var(--accent)" : "";
  $("ring-n").textContent = n;
  $("goal-txt").textContent = n + " / " + goal();
  $("goal-unit").textContent = isMath() ? "oppgaver i dag" : "ord i dag";
  const live = stats.streak.last === day() || stats.streak.last === day(1);
  const sn = live ? stats.streak.n : 0;
  $("streak-n").textContent = sn;
  $("streak").classList.toggle("off", stats.streak.last !== day());
  $("streak").setAttribute("aria-label", sn + " dager på rad");
  const into = stickerPoints() % PER_STICKER;
  $("sp-bar").style.width = (into / PER_STICKER) * 100 + "%";
  const left = PER_STICKER - into;
  $("sp-txt").textContent =
    left === 1 ? "1 igjen til neste klistremerke!" : left + " igjen til neste klistremerke";
}
function flushRewards() {
  if (!$("reward").hidden || !rewards.length) return;
  const rw = rewards.shift();
  if (rw.type === "sticker") {
    const [e, name] = STICKERS[rw.idx];
    $("rw-eyebrow").textContent = "Nytt klistremerke";
    $("rw-e").textContent = e;
    $("rw-n").textContent = name;
    $("rw-p").textContent =
      stats.stickers[rw.idx] > 1
        ? "Du har " + stats.stickers[rw.idx] + " av denne nå."
        : "Nå har du " + Object.keys(stats.stickers).length + " av " + STICKERS.length + " dyr.";
    $("rw-ok").textContent = "Så fint!";
    chime([660, 880, 1320], S.sound);
  } else if (rw.type === "goal") {
    $("rw-eyebrow").textContent = "Dagens mål";
    $("rw-e").textContent = "⭐";
    $("rw-n").textContent = "Du klarte det!";
    $("rw-p").textContent =
      rw.text +
      (stats.streak.n > 1
        ? stats.streak.n + " dager på rad!"
        : "Kom tilbake i morgen for å starte en rekke.");
    $("rw-ok").textContent = "Hurra!";
    chime([523, 659, 784, 1047], S.sound);
  } else if (rw.type === "record") {
    $("rw-eyebrow").textContent = "Lynrunde";
    $("rw-e").textContent = "🏆";
    $("rw-n").textContent = "Ny rekord!";
    $("rw-p").textContent = rw.score + " ord på " + S.dur + " sekunder.";
    $("rw-ok").textContent = "Jippi!";
    chime([784, 988, 1175, 1568], S.sound);
  }
  $("reward").hidden = false;
  $("scrim").hidden = false;
  confetti();
  setTimeout(() => $("rw-ok").focus(), 50);
}
$("rw-ok").onclick = () => {
  $("reward").hidden = true;
  $("scrim").hidden = true;
  flushRewards();
  if (S.mode === "regn" && taskDone && $("reward").hidden) newTask();
  if (S.mode === "lytt" && listen?.done && $("reward").hidden) newListen();
  if (hearOn() && hearDone && $("reward").hidden) newSet();
};

/* ---------- Normal modes ---------- */
function newSet() {
  clearTimeout(flashTimer);
  stopHearing();
  hearing = false;
  hearDone = false;
  heard = new Set();
  if (S.mode === "regn") return newTask();
  if (S.mode === "lytt") return newListen();
  if (S.mode === "ord") {
    current = pickWords(S.count);
    revealIdx = current.length;
  } else {
    current = sentence(S.len);
    revealIdx = S.build && !hearOn() ? 1 : current.length;
  }
  renderWords(true);
}
function renderWords(animate) {
  const box = $("words");
  box.hidden = false;
  $("panel").hidden = true;
  $("answers").hidden = true;
  box.classList.remove("hidden", "pop");
  box.innerHTML = "";
  current.forEach((w, i) => {
    const b = document.createElement("button");
    b.className =
      "word" +
      (marked.has(clean(w)) ? " marked" : "") +
      (i >= revealIdx ? " ghost" : "") +
      (heard.has(i) ? " heard" : "");
    b.style.setProperty("--i", String(animate ? i : 0));
    b.textContent = w;
    b.type = "button";
    b.setAttribute("aria-label", w + (marked.has(clean(w)) ? ", merket" : ""));
    b.addEventListener("click", () => toggleMark(clean(w)));
    box.appendChild(b);
  });
  if (animate) {
    void box.offsetWidth;
    box.classList.add("pop");
  }
  $("reveal").hidden = true;
  const complete = revealIdx >= current.length;
  $("hint").textContent = hearOn()
    ? "Trykk på mikrofonen og les høyt"
    : S.mode === "ord"
      ? "Trykk på et ord som var vanskelig"
      : S.build && !complete
        ? "Les ordet, så trykk «Neste ord»"
        : "";
  renderBottom();
  if (complete && S.flash > 0 && S.mode !== "lyn") {
    flashTimer = setTimeout(() => {
      box.classList.add("hidden");
      $("reveal").hidden = false;
    }, S.flash * 1000);
  }
}
function next() {
  requestWake();
  if (revealIdx < current.length) {
    revealIdx++;
    const w = $("words").children[revealIdx - 1];
    if (w) {
      w.classList.remove("ghost");
      w.style.setProperty("--i", 0);
    }
    renderBottom();
    if (revealIdx >= current.length) $("hint").textContent = "";
    return;
  }
  addProgress(current.length);
  newSet();
}
/* ---------- Appen lytter ---------- */
const hearOn = () => S.hear && canHear && (S.mode === "ord" || S.mode === "setning");
function toggleHearing() {
  requestWake();
  if (hearDone) return;
  if (hearing) return finishHearing();
  hearing = true;
  $("hint").textContent = "Les høyt nå …";
  renderBottom();
  startHearing({
    onWords: tokens => {
      current.forEach((w, i) => {
        if (heard.has(i) || !tokens.some(t => matches(clean(w), t))) return;
        heard.add(i);
        $("words").children[i]?.classList.add("heard");
      });
      if (heard.size === current.length) heardAll();
    },
    onEnd: () => {
      hearing = false;
      if (!hearDone && $("hint").textContent === "Les høyt nå …")
        $("hint").textContent = heard.size
          ? "Nesten! Trykk og les resten en gang til"
          : "Hørte ikke ordet. Trykk og prøv igjen";
      renderBottom();
    },
    onError: err => {
      $("hint").textContent =
        err === "not-allowed" || err === "service-not-allowed"
          ? "Gi appen lov til å bruke mikrofonen"
          : err === "network"
            ? "Talegjenkjenning trenger nett"
            : err === "language-not-supported"
              ? "Nettleseren forstår ikke norsk tale"
              : "Hørte ikke ordet. Trykk og prøv igjen";
    },
  });
}
function heardAll() {
  hearDone = true;
  stopHearing();
  hearing = false;
  chime([660, 990], S.sound);
  $("hint").textContent = "Bra lest!";
  renderBottom();
  addProgress(current.length);
  const set = current;
  flashTimer = setTimeout(() => {
    if (current === set && $("reward").hidden) newSet();
  }, 1200);
}
/** Skipping in listening mode only counts the words that were actually heard. */
function skipHeard() {
  if (heard.size && !hearDone) addProgress(heard.size);
  newSet();
}

function toggleMark(w) {
  if (lyn.state === "running") return;
  if (marked.has(w)) marked.delete(w);
  else marked.add(w);
  save("ob-marked", [...marked]);
  [...$("words").children].forEach(b => {
    if (clean(b.textContent) === w) b.classList.toggle("marked", marked.has(w));
  });
  renderMarked();
}

/* ---------- Regning ---------- */
function newTask() {
  clearTimeout(taskTimer);
  let t,
    tries = 0;
  do {
    t = mathTask(S.ops, S.max);
  } while (task && t.a === task.a && t.b === task.b && t.op === task.op && ++tries < 10);
  task = { ...t, wrong: 0 };
  taskDone = false;
  const box = $("words");
  box.hidden = false;
  $("panel").hidden = true;
  $("reveal").hidden = true;
  box.classList.remove("hidden", "pop");
  box.innerHTML = [task.a, OPS[task.op], task.b, "=", "?"]
    .map((x, i) => `<span class="word${i === 4 ? " slot" : ""}" style="--i:${i}">${x}</span>`)
    .join("");
  box.setAttribute("aria-label", `${task.a} ${OPS[task.op]} ${task.b} er lik hva?`);
  void box.offsetWidth;
  box.classList.add("pop");
  const ans = $("answers");
  ans.className = "answers";
  ans.hidden = false;
  ans.innerHTML = "";
  task.opts.forEach(v => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ans";
    b.textContent = v;
    b.onclick = () => answerTask(v, b);
    ans.appendChild(b);
  });
  $("hint").textContent = "Trykk på riktig svar";
  renderBottom();
}
function answerTask(v, btn) {
  if (taskDone) return;
  requestWake();
  if (v !== task.ans) {
    btn.classList.remove("wrong");
    void btn.offsetWidth;
    btn.classList.add("wrong");
    btn.disabled = true;
    task.wrong++;
    return;
  }
  taskDone = true;
  btn.classList.add("right");
  const slot = $("words").querySelector(".slot");
  slot.textContent = task.ans;
  slot.classList.add("solved");
  [...$("answers").children].forEach(b => (b.disabled = true));
  $("hint").textContent = "Riktig!";
  chime([660, 990], S.sound);
  // Same rule as Lytt: only a first-try answer counts, so guessing through the options earns nothing.
  if (!task.wrong) addProgress(1);
  renderBottom();
  taskTimer = setTimeout(() => {
    if (S.mode === "regn" && $("reward").hidden) newTask();
  }, 1100);
}

/* ---------- Lytt ---------- */
function newListen() {
  clearTimeout(taskTimer);
  const p = pool();
  const [word] = pickWords(1);
  const opts = [word, ...lookalikes(word, p, 3)].sort(() => Math.random() - 0.5);
  listen = { word, wrong: 0, done: false };
  const box = $("words");
  box.hidden = false;
  $("panel").hidden = true;
  $("reveal").hidden = true;
  box.classList.remove("hidden", "pop");
  box.innerHTML = `<button type="button" class="say" id="say" aria-label="Hør ordet igjen">
    <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
    </svg></button>`;
  $("say").onclick = say;
  const ans = $("answers");
  ans.className = "answers wordy";
  ans.hidden = false;
  ans.innerHTML = "";
  opts.forEach(v => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ans";
    b.textContent = v;
    b.onclick = () => answerListen(v, b);
    ans.appendChild(b);
  });
  $("hint").textContent = canSpeak ? "Hva hører du? Trykk på riktig ord" : "";
  renderBottom();
  say();
}
function say() {
  if (!canSpeak) {
    $("hint").textContent = "Denne nettleseren kan ikke lese opp ord";
    return;
  }
  if (missingVoice()) $("hint").textContent = "Fant ingen norsk stemme på enheten";
  speak(listen.word);
}
function answerListen(v, btn) {
  if (listen.done) return;
  requestWake();
  if (v !== listen.word) {
    btn.classList.remove("wrong");
    void btn.offsetWidth;
    btn.classList.add("wrong");
    btn.disabled = true;
    listen.wrong++;
    marked.add(listen.word);
    save("ob-marked", [...marked]);
    say();
    return;
  }
  listen.done = true;
  btn.classList.add("right");
  [...$("answers").children].forEach(b => (b.disabled = true));
  chime([660, 990], S.sound);
  // Only a first-try hit counts as read, so guessing through the options earns nothing.
  if (listen.wrong) $("hint").textContent = "Riktig! Dette ordet øver vi mer på";
  else {
    $("hint").textContent = "Riktig!";
    addProgress(1);
  }
  renderBottom();
  taskTimer = setTimeout(() => {
    if (S.mode === "lytt" && $("reward").hidden) newListen();
  }, 1300);
}

/* ---------- Lynrunde ---------- */
function lynIntro() {
  clearInterval(lyn.tick);
  lyn.state = "idle";
  $("words").hidden = true;
  $("timer").hidden = true;
  $("score").hidden = true;
  $("reveal").hidden = true;
  $("hint").textContent = "";
  const best = stats.best[S.dur] || 0;
  $("panel").hidden = false;
  $("panel").innerHTML = `<div class="intro"><h2>Lynrunde</h2>
    <p>Les så mange ord du klarer på ${S.dur} sekunder. Den voksne trykker «Kunne» når ordet sitter.</p>
    ${best ? `<p>Rekorden din: <b>${best} ord</b></p>` : `<p>Sett din første rekord!</p>`}</div>`;
  renderBottom();
}
function lynStart() {
  requestWake();
  lyn = { state: "countdown", score: 0, combo: 0, missed: [], end: 0, tick: null, word: "" };
  $("panel").hidden = false;
  $("words").hidden = true;
  renderBottom();
  let c = 3;
  const show = () => {
    $("panel").innerHTML = `<div class="big">${c}</div>`;
    chime([440 + (3 - c) * 60], S.sound);
  };
  show();
  const iv = setInterval(() => {
    c--;
    if (c > 0) {
      show();
    } else {
      clearInterval(iv);
      lynGo();
    }
  }, 700);
}
function lynGo() {
  lyn.state = "running";
  lyn.end = Date.now() + S.dur * 1000;
  $("panel").hidden = true;
  $("timer").hidden = false;
  $("score").hidden = false;
  lynWord();
  renderBottom();
  updateScore();
  lyn.tick = setInterval(() => {
    const left = Math.max(0, lyn.end - Date.now());
    $("timer-bar").style.width = (left / (S.dur * 1000)) * 100 + "%";
    $("timer").classList.toggle("low", left < 10000);
    if (left <= 0) lynFinish();
  }, 100);
}
function lynWord() {
  current = pickWords(1);
  revealIdx = 1;
  lyn.word = current[0];
  renderWords(true);
  $("hint").textContent = "";
}
function lynAnswer(ok) {
  if (lyn.state !== "running") return;
  if (ok) {
    lyn.score++;
    lyn.combo++;
    if (lyn.combo > 0 && lyn.combo % 5 === 0) {
      const c = $("combo");
      c.textContent = lyn.combo + " på rad!";
      c.classList.remove("show");
      void c.offsetWidth;
      c.classList.add("show");
      chime([880, 1175], S.sound);
    }
  } else {
    lyn.combo = 0;
    if (!lyn.missed.includes(lyn.word)) lyn.missed.push(lyn.word);
    marked.add(lyn.word);
    save("ob-marked", [...marked]);
  }
  // A word the child couldn't read doesn't count towards stickers or the daily goal.
  if (ok) addProgress(1);
  updateScore();
  lynWord();
}
function updateScore() {
  $("score").innerHTML = `${lyn.score}<small>kunne</small>`;
}
function lynFinish() {
  clearInterval(lyn.tick);
  lyn.state = "done";
  $("timer").hidden = true;
  $("score").hidden = true;
  $("words").hidden = true;
  $("hint").textContent = "";
  const best = stats.best[S.dur] || 0;
  const isRecord = lyn.score > 0 && lyn.score > best;
  if (isRecord) {
    stats.best[S.dur] = lyn.score;
    save("ob-stats", stats);
    rewards.unshift({ type: "record", score: lyn.score });
  }
  $("panel").hidden = false;
  $("panel").innerHTML = `<div class="intro">
    <span class="label">Du klarte</span>
    <div class="big">${lyn.score}</div>
    <p>ord på ${S.dur} sekunder</p>
    ${isRecord ? '<span class="record">Ny rekord!</span>' : best ? `<p>Rekord: ${best}</p>` : ""}
    ${lyn.missed.length ? `<p>Øv mer på:</p><div class="missed">${lyn.missed.map(w => `<span>${w}</span>`).join("")}</div>` : ""}
  </div>`;
  renderBottom();
  flushRewards();
}

/* ---------- Bottom bar ---------- */
function renderBottom() {
  const b = $("bottom");
  if (S.mode === "regn" || S.mode === "lytt") {
    const done = S.mode === "regn" ? taskDone : !!listen?.done;
    b.innerHTML = `<button class="${done ? "next" : "btn2"}" id="next">${done ? "Neste" : "Hopp over"}</button>`;
    $("next").onclick = S.mode === "regn" ? newTask : newListen;
  } else if (hearOn()) {
    b.innerHTML = hearDone
      ? `<button class="next" id="next">Neste</button>`
      : `<button class="btn2" id="next">Hopp over</button><button class="next mic${hearing ? " on" : ""}" id="mic">${hearing ? "Ferdig" : "Les høyt"}</button>`;
    $("next").onclick = skipHeard;
    if ($("mic")) $("mic").onclick = toggleHearing;
  } else if (S.mode !== "lyn") {
    const complete = revealIdx >= current.length;
    b.innerHTML = `<button class="next" id="next">${complete ? "Neste" : "Neste ord"}</button>`;
    $("next").onclick = next;
  } else if (lyn.state === "running") {
    b.innerHTML = `<button class="btn2" id="miss">Øv mer</button><button class="next btn-good" id="hit">Kunne!</button>`;
    $("miss").onclick = () => lynAnswer(false);
    $("hit").onclick = () => lynAnswer(true);
  } else if (lyn.state === "countdown") {
    b.innerHTML = `<button class="next" disabled>Gjør deg klar…</button>`;
  } else {
    b.innerHTML = `<button class="next" id="start">${lyn.state === "done" ? "Spill igjen" : "Start lynrunde"}</button>`;
    $("start").onclick = lynStart;
  }
}

/* ---------- Settings ---------- */
function applySize() {
  const scale = [0.7, 0.85, 1, 1.2, 1.45][S.size - 1];
  const crowd =
    S.mode === "setning"
      ? 0.78
      : S.mode === "lyn"
        ? 1.15
        : S.mode === "regn" || S.mode === "lytt"
          ? 1
          : S.count >= 5
            ? 0.72
            : S.count >= 3
              ? 0.85
              : 1;
  document.documentElement.style.setProperty("--word-scale", String(scale * crowd));
}
function syncUI() {
  $$("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(S.mode === b.dataset.mode)));
  $$("[data-area]").forEach(b =>
    b.setAttribute("aria-pressed", String((b.dataset.area === "regn") === isMath()))
  );
  $("modes").hidden = isMath();
  $$(".f-read").forEach(f => (f.hidden = isMath()));
  $("f-count").hidden = S.mode !== "ord";
  $("f-length").hidden = S.mode !== "setning";
  $("f-hear").hidden = S.mode !== "ord" && S.mode !== "setning";
  $("f-math").hidden = S.mode !== "regn";
  $$("[data-op]").forEach(b =>
    b.setAttribute("aria-pressed", String(S.ops.includes(b.dataset.op)))
  );
  $("c-val").textContent = S.count;
  const press = (attr, val) =>
    $$(`[data-${attr}]`).forEach(b =>
      b.setAttribute("aria-pressed", String(b.dataset[attr] == String(val)))
    );
  press("len", S.len);
  press("flash", S.flash);
  press("list", S.list);
  press("goal", S.goal);
  press("mgoal", S.mathGoal);
  press("dur", S.dur);
  press("max", S.max);
  $("custom-wrap").hidden = S.list !== "egen";
  $("build").checked = S.build;
  $("hear").checked = S.hear;
  $("sound").checked = S.sound;
  $("size").value = S.size;
  applySize();
  save("ob-settings", S);
}
function renderMarked() {
  const c = $("marked");
  c.innerHTML = "";
  if (!marked.size) {
    c.innerHTML = '<p class="small">Ingen merkede ord ennå.</p>';
    return;
  }
  [...marked].sort().forEach(w => {
    const b = document.createElement("button");
    b.textContent = w;
    b.setAttribute("aria-label", "Fjern " + w);
    b.onclick = () => toggleMark(w);
    c.appendChild(b);
  });
}
function renderBook() {
  const have = Object.keys(stats.stickers).length;
  $("book-title").textContent = `Klistremerkebok · ${have}/${STICKERS.length}`;
  $("book").innerHTML = STICKERS.map(([e, n], i) => {
    const c = stats.stickers[i] || 0;
    return `<div class="st${c ? "" : " locked"}"><span class="e" aria-hidden="true">${e}</span><span class="n">${c ? n : "?"}</span>${c > 1 ? `<span class="x">×${c}</span>` : ""}</div>`;
  }).join("");
}
function setMode(m) {
  if (lyn.tick) clearInterval(lyn.tick);
  clearTimeout(taskTimer);
  stopHearing();
  hearing = false;
  lyn.state = "idle";
  S.mode = m;
  if (m !== "regn") S.readMode = m;
  syncUI();
  renderProgress();
  $("timer").hidden = true;
  $("score").hidden = true;
  $("answers").hidden = true;
  $("words").removeAttribute("aria-label");
  if (m === "lyn") lynIntro();
  else newSet();
}

Object.entries(LISTS).forEach(([k, v]) => {
  const b = document.createElement("button");
  b.className = "opt";
  b.dataset.list = k;
  b.textContent = v.name;
  b.onclick = () => {
    S.list = k;
    lastShown = new Set();
    syncUI();
    if (S.mode === "ord" || S.mode === "lytt") newSet();
  };
  $("list-opts").appendChild(b);
});
$$("[data-mode]").forEach(b => (b.onclick = () => setMode(b.dataset.mode)));
$$("[data-area]").forEach(
  b => (b.onclick = () => setMode(b.dataset.area === "regn" ? "regn" : S.readMode))
);
$$("[data-len]").forEach(
  b =>
    (b.onclick = () => {
      S.len = b.dataset.len;
      syncUI();
      newSet();
    })
);
$$("[data-flash]").forEach(
  b =>
    (b.onclick = () => {
      S.flash = +b.dataset.flash;
      syncUI();
    })
);
$$("[data-goal]").forEach(
  b =>
    (b.onclick = () => {
      S.goal = +b.dataset.goal;
      syncUI();
      renderProgress();
    })
);
$$("[data-mgoal]").forEach(
  b =>
    (b.onclick = () => {
      S.mathGoal = +b.dataset.mgoal;
      syncUI();
      renderProgress();
    })
);
$$("[data-dur]").forEach(
  b =>
    (b.onclick = () => {
      S.dur = +b.dataset.dur;
      syncUI();
      if (S.mode === "lyn") lynIntro();
    })
);
$$("[data-op]").forEach(
  b =>
    (b.onclick = () => {
      const op = b.dataset.op;
      if (S.ops.includes(op)) {
        if (S.ops.length > 1) S.ops = S.ops.filter(o => o !== op);
      } else S.ops = [...S.ops, op];
      syncUI();
      if (S.mode === "regn") newTask();
    })
);
$$("[data-max]").forEach(
  b =>
    (b.onclick = () => {
      S.max = +b.dataset.max;
      syncUI();
      if (S.mode === "regn") newTask();
    })
);
$("c-minus").onclick = () => {
  S.count = Math.max(1, S.count - 1);
  syncUI();
  newSet();
};
$("c-plus").onclick = () => {
  S.count = Math.min(6, S.count + 1);
  syncUI();
  newSet();
};
$("build").onchange = e => {
  S.build = e.target.checked;
  syncUI();
  newSet();
};
$("hear").disabled = !canHear;
if (!canHear)
  $("hear-note").textContent = "Denne nettleseren kan ikke lytte. Prøv Chrome eller Safari.";
$("hear").onchange = e => {
  S.hear = e.target.checked;
  syncUI();
  newSet();
};
$("sound").onchange = e => {
  S.sound = e.target.checked;
  syncUI();
  chime([660, 880], S.sound);
};
$("size").oninput = e => {
  S.size = +e.target.value;
  syncUI();
};
$("custom").value = LISTS.egen.words;
$("custom").oninput = e => {
  LISTS.egen.words = e.target.value;
  save("ob-custom", e.target.value);
};
$("custom").onchange = () => {
  if (S.mode === "ord" || S.mode === "lytt") newSet();
};
$("clear-marked").onclick = () => {
  marked.clear();
  save("ob-marked", []);
  renderMarked();
  [...$("words").children].forEach(b => b.classList.remove("marked"));
};
let resetArmed = false;
$("reset").onclick = () => {
  if (!resetArmed) {
    resetArmed = true;
    $("reset").textContent = "Trykk igjen for å nullstille alt";
    setTimeout(() => {
      resetArmed = false;
      $("reset").textContent = "Nullstill klistremerker og rekorder";
    }, 4000);
    return;
  }
  stats = freshStats();
  save("ob-stats", stats);
  resetArmed = false;
  $("reset").textContent = "Nullstilt";
  renderProgress();
  updateTotal();
};
function updateTotal() {
  $("total-txt").textContent =
    `${stats.total} ord lest · ${stats.math.total} ${stats.math.total === 1 ? "oppgave" : "oppgaver"} løst · ${Object.keys(stats.stickers).length} av ${STICKERS.length} klistremerker`;
}
$("reveal").onclick = () => {
  $("words").classList.remove("hidden");
  $("reveal").hidden = true;
};

const openSheet = id => {
  if (lyn.state === "running") return;
  if (id === "sheet") {
    renderMarked();
    updateTotal();
  } else renderBook();
  $(id).hidden = false;
  $("scrim").hidden = false;
};
const closeSheets = () => {
  if (!$("reward").hidden) return;
  $("sheet").hidden = true;
  $("booksheet").hidden = true;
  $("scrim").hidden = true;
};
$("open-settings").onclick = () => openSheet("sheet");
$("open-book").onclick = () => openSheet("booksheet");
$$("[data-close]").forEach(b => (b.onclick = closeSheets));
$("scrim").onclick = closeSheets;

document.addEventListener("keydown", e => {
  const t = /** @type {HTMLElement} */ (e.target);
  if (!$("reward").hidden) {
    if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
      e.preventDefault();
      $("rw-ok").click();
    }
    return;
  }
  if (!$("sheet").hidden || !$("booksheet").hidden) {
    if (e.key === "Escape") closeSheets();
    return;
  }
  if (t.tagName === "TEXTAREA") return;
  const go = e.key === " " || e.key === "Enter" || e.key === "ArrowRight";
  if (S.mode === "lyn") {
    if (lyn.state === "running") {
      if (go) {
        e.preventDefault();
        lynAnswer(true);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        lynAnswer(false);
      }
    } else if (go && lyn.state !== "countdown") {
      e.preventDefault();
      lynStart();
    }
    return;
  }
  if (S.mode === "regn") {
    const k = +e.key,
      opt = $("answers").children[k - 1];
    if (k >= 1 && k <= 4 && opt && !opt.disabled) {
      e.preventDefault();
      opt.click();
    } else if (go && taskDone && t.tagName !== "BUTTON") {
      e.preventDefault();
      newTask();
    }
    return;
  }
  if (S.mode === "lytt") {
    const k = +e.key,
      opt = $("answers").children[k - 1];
    if (k >= 1 && k <= 4 && opt && !opt.disabled) {
      e.preventDefault();
      opt.click();
    } else if (go && t.tagName !== "BUTTON") {
      e.preventDefault();
      if (listen.done) newListen();
      else say();
    }
    return;
  }
  if (hearOn() && go && t.tagName !== "BUTTON") {
    e.preventDefault();
    if (hearDone) newSet();
    else toggleHearing();
    return;
  }
  if (go && (t.tagName !== "BUTTON" || t.id === "next")) {
    e.preventDefault();
    next();
  }
});

syncUI();
renderProgress();
if (S.mode === "lyn") lynIntro();
else newSet();
