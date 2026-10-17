import { r } from "./data.js";

/* ---------- Effects ---------- */
let actx = null,
  wake = null;
export function chime(freqs, enabled = true) {
  if (!enabled) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(),
        g = actx.createGain(),
        t = actx.currentTime + i * 0.09;
      o.type = "triangle";
      o.frequency.value = f;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.connect(g).connect(actx.destination);
      o.start(t);
      o.stop(t + 0.4);
    });
  } catch (e) {}
}
export function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const cv = document.getElementById("confetti"),
    ctx = cv.getContext("2d"),
    dpr = devicePixelRatio || 1;
  cv.width = innerWidth * dpr;
  cv.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const cs = getComputedStyle(document.documentElement);
  const cols = ["--accent", "--good", "--mark", "--flame"]
    .map(v => cs.getPropertyValue(v).trim())
    .concat(["#5aa9e6", "#b17be0"]);
  const parts = Array.from({ length: 120 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 12,
    vy: -Math.random() * 13 - 4,
    s: Math.random() * 7 + 5,
    r: Math.random() * 6,
    vr: (Math.random() - 0.5) * 0.3,
    c: r(cols),
  }));
  let f = 0;
  (function step() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    parts.forEach(p => {
      p.vy += 0.35;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    if (++f < 150) requestAnimationFrame(step);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })();
}
export async function requestWake() {
  if (wake || !("wakeLock" in navigator)) return;
  try {
    wake = await navigator.wakeLock.request("screen");
    wake.addEventListener("release", () => (wake = null));
  } catch (e) {}
}
