import "@fontsource/andika/400.css";
import "@fontsource/andika/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./style.css";
import { LISTS, STICKERS, PER_STICKER, sp, sentence, OPS, mathTask } from "./data.js";
import { load, save } from "./storage.js";
import { chime, confetti, requestWake } from "./effects.js";

let S = Object.assign(
  {
    mode: "ord",
    count: 1,
    list: "n1",
    flash: 0,
    size: 3,
    build: false,
    len: "kort",
    goal: 30,
    dur: 60,
    lynKind: "ord",
    sound: true,
    ops: ["+", "-"],
    max: 10,
  },
  load("ob-settings", {})
);
let marked = new Set(load("ob-marked", []));
LISTS.egen.words = load("ob-custom", "");
const freshStats = () => ({
  total: 0,
  stickers: {},
  today: { date: "", n: 0 },
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
let lyn = { state: "idle", score: 0, combo: 0, missed: [], end: 0, tick: null, word: "" };

/** @type {(id: string) => any} */
const $ = id => document.getElementById(id);
/** @type {(sel: string) => NodeListOf<HTMLElement>} */
const $$ = sel => document.querySelectorAll(sel);
const clean = w => w.toLowerCase().replace(/[.,!?]/g, "");
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
function addWords(n) {
  const d = day();
  if (stats.today.date !== d) stats.today = { date: d, n: 0 };
  if (stats.today.n === 0 && stats.streak.last !== d) {
    stats.streak.n = stats.streak.last === day(1) ? stats.streak.n + 1 : 1;
    stats.streak.last = d;
  }
  const goalBefore = stats.today.n >= S.goal;
  const before = stats.total;
  stats.today.n += n;
  stats.total += n;
  const earned = Math.floor(stats.total / PER_STICKER) - Math.floor(before / PER_STICKER);
  for (let i = 0; i < earned; i++) rewards.push({ type: "sticker", idx: awardSticker() });
  if (!goalBefore && stats.today.n >= S.goal) rewards.push({ type: "goal" });
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
  const n = stats.today.date === day() ? stats.today.n : 0;
  const frac = Math.min(1, n / S.goal);
  $("ring").style.strokeDashoffset = 119.4 * (1 - frac);
  $("ring").style.stroke = frac >= 1 ? "var(--accent)" : "";
  $("ring-n").textContent = n;
  $("goal-txt").textContent = n + " / " + S.goal;
  const live = stats.streak.last === day() || stats.streak.last === day(1);
  const sn = live ? stats.streak.n : 0;
  $("streak-n").textContent = sn;
  $("streak").classList.toggle("off", stats.streak.last !== day());
  $("streak").setAttribute("aria-label", sn + " dager på rad");
  const into = stats.total % PER_STICKER;
  $("sp-bar").style.width = (into / PER_STICKER) * 100 + "%";
  const left = PER_STICKER - into;
  $("sp-txt").textContent =
    left === 1 ? "1 ord til neste klistremerke!" : left + " ord til neste klistremerke";
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
      S.goal +
      " ord i dag. " +
      (stats.streak.n > 1
        ? stats.streak.n + " dager på rad!"
        : "Kom tilbake i morgen for å starte en rekke.");
    $("rw-ok").textContent = "Hurra!";
    chime([523, 659, 784, 1047], S.sound);
  } else if (rw.type === "record") {
    $("rw-eyebrow").textContent = "Lynrunde";
    $("rw-e").textContent = "🏆";
    $("rw-n").textContent = "Ny rekord!";
    $("rw-p").textContent = rw.score + " " + rw.unit + " på " + S.dur + " sekunder.";
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
};

/* ---------- Normal modes ---------- */
function newSet() {
  clearTimeout(flashTimer);
  if (S.mode === "regn") return newTask();
  if (S.mode === "ord") {
    current = pickWords(S.count);
    revealIdx = current.length;
  } else {
    current = sentence(S.len);
    revealIdx = S.build ? 1 : current.length;
  }
  renderWords(true);
}
function renderWords(animate) {
  const box = $("words");
  box.hidden = false;
  $("panel").hidden = true;
  $("answers").hidden = true;
  box.classList.remove("hidden", "pop");
  box.removeAttribute("aria-label");
  box.innerHTML = "";
  current.forEach((w, i) => {
    const b = document.createElement("button");
    b.className =
      "word" + (marked.has(clean(w)) ? " marked" : "") + (i >= revealIdx ? " ghost" : "");
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
  $("hint").textContent =
    S.mode === "ord"
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
  addWords(current.length);
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
  task = t;
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
  $("hint").textContent = S.mode === "lyn" ? "" : "Trykk på riktig svar";
  renderBottom();
}
const taskLabel = () => `${task.a} ${OPS[task.op]} ${task.b} = ${task.ans}`;
function solveSlot() {
  const slot = $("words").querySelector(".slot");
  slot.textContent = task.ans;
  slot.classList.add("solved");
}
function answerTask(v, btn) {
  if (taskDone) return;
  requestWake();
  if (S.mode === "lyn") return lynMathAnswer(v, btn);
  if (v !== task.ans) {
    btn.classList.remove("wrong");
    void btn.offsetWidth;
    btn.classList.add("wrong");
    btn.disabled = true;
    return;
  }
  taskDone = true;
  btn.classList.add("right");
  solveSlot();
  [...$("answers").children].forEach(b => (b.disabled = true));
  $("hint").textContent = "Riktig!";
  chime([660, 990], S.sound);
  addWords(1);
  renderBottom();
  taskTimer = setTimeout(() => {
    if (S.mode === "regn" && $("reward").hidden) newTask();
  }, 1100);
}

/* ---------- Lynrunde ---------- */
function lynIntro() {
  clearInterval(lyn.tick);
  lyn.state = "idle";
  $("words").hidden = true;
  $("answers").hidden = true;
  $("timer").hidden = true;
  $("score").hidden = true;
  $("reveal").hidden = true;
  $("hint").textContent = "";
  const best = stats.best[lynKey()] || 0;
  const regn = S.lynKind === "regn";
  $("panel").hidden = false;
  $("panel").innerHTML = `<div class="intro"><h2>Lynrunde</h2>
    <div class="row kinds" role="group" aria-label="Hva skal vi øve på?">
      <button class="opt" data-kind="ord" aria-pressed="${!regn}">Ord</button>
      <button class="opt" data-kind="regn" aria-pressed="${regn}">Regning</button>
    </div>
    <p>${
      regn
        ? `Løs så mange regnestykker du klarer på ${S.dur} sekunder. Trykk på riktig svar.`
        : `Les så mange ord du klarer på ${S.dur} sekunder. Den voksne trykker «Kunne» når ordet sitter.`
    }</p>
    ${best ? `<p>Rekorden din: <b>${best} ${lynUnit()}</b></p>` : `<p>Sett din første rekord!</p>`}</div>`;
  $$("[data-kind]").forEach(
    b =>
      (b.onclick = () => {
        S.lynKind = b.dataset.kind;
        syncUI();
        lynIntro();
      })
  );
  renderBottom();
}
/* Words and math keep separate records; word records keep their old keys. */
const lynKey = () => (S.lynKind === "regn" ? "regn" + S.dur : String(S.dur));
const lynUnit = () => (S.lynKind === "regn" ? "regnestykker" : "ord");
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
  if (S.lynKind === "regn") newTask();
  else lynWord();
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
function lynAnswer(ok, item = lyn.word) {
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
    if (!lyn.missed.includes(item)) lyn.missed.push(item);
    if (S.lynKind === "ord") {
      marked.add(item);
      save("ob-marked", [...marked]);
    }
  }
  if (S.lynKind === "regn") {
    if (ok) addWords(1);
    updateScore();
    return;
  }
  addWords(1);
  updateScore();
  lynWord();
}
function lynMathAnswer(v, btn) {
  if (lyn.state !== "running") return;
  const ok = v === task.ans;
  taskDone = true;
  [...$("answers").children].forEach(b => {
    b.disabled = true;
    if (+b.textContent === task.ans) b.classList.add("right");
  });
  if (!ok) btn.classList.add("wrong");
  solveSlot();
  if (ok) chime([660, 990], S.sound);
  lynAnswer(ok, taskLabel());
  // A wrong answer stays up a little longer so the right one can be seen.
  taskTimer = setTimeout(() => lyn.state === "running" && newTask(), ok ? 300 : 1000);
}
function lynSkip() {
  if (lyn.state !== "running" || taskDone) return;
  lynAnswer(false, taskLabel());
  newTask();
}
function updateScore() {
  $("score").innerHTML = `${lyn.score}<small>${S.lynKind === "regn" ? "riktige" : "kunne"}</small>`;
}
function lynFinish() {
  clearInterval(lyn.tick);
  clearTimeout(taskTimer);
  lyn.state = "done";
  $("timer").hidden = true;
  $("score").hidden = true;
  $("words").hidden = true;
  $("answers").hidden = true;
  $("hint").textContent = "";
  const best = stats.best[lynKey()] || 0;
  const isRecord = lyn.score > 0 && lyn.score > best;
  if (isRecord) {
    stats.best[lynKey()] = lyn.score;
    save("ob-stats", stats);
    rewards.unshift({ type: "record", score: lyn.score, unit: lynUnit() });
  }
  $("panel").hidden = false;
  $("panel").innerHTML = `<div class="intro">
    <span class="label">Du klarte</span>
    <div class="big">${lyn.score}</div>
    <p>${S.lynKind === "regn" ? "riktige regnestykker" : "ord"} på ${S.dur} sekunder</p>
    ${isRecord ? '<span class="record">Ny rekord!</span>' : best ? `<p>Rekord: ${best}</p>` : ""}
    ${lyn.missed.length ? `<p>Øv mer på:</p><div class="missed">${lyn.missed.map(w => `<span>${w}</span>`).join("")}</div>` : ""}
  </div>`;
  renderBottom();
  flushRewards();
}

/* ---------- Bottom bar ---------- */
function renderBottom() {
  const b = $("bottom");
  if (S.mode === "regn") {
    b.innerHTML = `<button class="${taskDone ? "next" : "btn2"}" id="next">${taskDone ? "Neste" : "Hopp over"}</button>`;
    $("next").onclick = newTask;
  } else if (S.mode !== "lyn") {
    const complete = revealIdx >= current.length;
    b.innerHTML = `<button class="next" id="next">${complete ? "Neste" : "Neste ord"}</button>`;
    $("next").onclick = next;
  } else if (lyn.state === "running" && S.lynKind === "regn") {
    b.innerHTML = `<button class="btn2" id="skip">Hopp over</button>`;
    $("skip").onclick = lynSkip;
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
        ? S.lynKind === "regn"
          ? 1
          : 1.15
        : S.mode === "regn"
          ? 1
          : S.count >= 5
            ? 0.72
            : S.count >= 3
              ? 0.85
              : 1;
  document.documentElement.style.setProperty("--word-scale", String(scale * crowd));
}
function syncUI() {
  ["ord", "setning", "lyn", "regn"].forEach(m =>
    document.querySelector(`[data-mode="${m}"]`).setAttribute("aria-pressed", String(S.mode === m))
  );
  $("f-count").hidden = S.mode !== "ord";
  $("f-length").hidden = S.mode !== "setning";
  $("f-math").hidden = !(S.mode === "regn" || (S.mode === "lyn" && S.lynKind === "regn"));
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
  press("dur", S.dur);
  press("max", S.max);
  $("custom-wrap").hidden = S.list !== "egen";
  $("build").checked = S.build;
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
  lyn.state = "idle";
  S.mode = m;
  syncUI();
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
    if (S.mode === "ord") newSet();
  };
  $("list-opts").appendChild(b);
});
$$("[data-mode]").forEach(b => (b.onclick = () => setMode(b.dataset.mode)));
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
  if (S.mode === "ord") newSet();
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
    `${stats.total} ord lest totalt · ${Object.keys(stats.stickers).length} av ${STICKERS.length} klistremerker`;
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
    if (lyn.state === "running" && S.lynKind === "regn") {
      const opt = $("answers").children[+e.key - 1];
      if (+e.key >= 1 && opt && !opt.disabled) {
        e.preventDefault();
        opt.click();
      }
    } else if (lyn.state === "running") {
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
  if (go && (t.tagName !== "BUTTON" || t.id === "next")) {
    e.preventDefault();
    next();
  }
});

syncUI();
renderProgress();
if (S.mode === "lyn") lynIntro();
else newSet();
