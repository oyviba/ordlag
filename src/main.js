import "@fontsource/andika/400.css";
import "@fontsource/andika/700.css";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "./style.css";
import { LISTS, STICKERS, PER_STICKER, sp, sentence } from "./data.js";
import { load, save } from "./storage.js";
import { chime, confetti, requestWake } from "./effects.js";

let S = Object.assign({mode:"ord",count:1,list:"n1",flash:0,size:3,build:false,len:"kort",goal:30,dur:60,sound:true}, load("ob-settings",{}));
let marked = new Set(load("ob-marked",[]));
LISTS.egen.words = load("ob-custom","");
const freshStats = () => ({total:0, stickers:{}, today:{date:"",n:0}, streak:{last:"",n:0}, best:{}});
let stats = Object.assign(freshStats(), load("ob-stats",{}));
let current=[], revealIdx=0, lastShown=new Set(), flashTimer=null;
let rewards=[];
let lyn = {state:"idle", score:0, combo:0, missed:[], end:0, tick:null, word:""};

const $ = id => document.getElementById(id);
const clean = w => w.toLowerCase().replace(/[.,!?]/g,"");
const day = (off=0) => new Date(Date.now()-off*864e5).toLocaleDateString("sv");

/* ---------- Words ---------- */
function pool(){
  const arr = [...new Set(LISTS[S.list].words.split(/[\s,;]+/).map(w=>w.trim().toLowerCase()).filter(Boolean))];
  return arr.length ? arr : sp(LISTS.n1.words);
}
function pickWords(n){
  let p = pool();
  const fresh = p.filter(w=>!lastShown.has(w));
  if (fresh.length >= n) p = fresh;
  n = Math.min(n, p.length);
  const out=[];
  while(out.length<n){
    const items = p.filter(w=>!out.includes(w));
    const weights = items.map(w=>marked.has(w)?4:1);
    let t=Math.random()*weights.reduce((a,b)=>a+b,0), i=0;
    while((t-=weights[i])>0) i++;
    out.push(items[i]);
  }
  lastShown = new Set(out);
  return out;
}

/* ---------- Progress & rewards ---------- */
function addWords(n){
  const d = day();
  if (stats.today.date !== d) stats.today = {date:d, n:0};
  if (stats.today.n === 0 && stats.streak.last !== d){
    stats.streak.n = stats.streak.last === day(1) ? stats.streak.n + 1 : 1;
    stats.streak.last = d;
  }
  const goalBefore = stats.today.n >= S.goal;
  const before = stats.total;
  stats.today.n += n; stats.total += n;
  const earned = Math.floor(stats.total/PER_STICKER) - Math.floor(before/PER_STICKER);
  for (let i=0;i<earned;i++) rewards.push({type:"sticker", idx:awardSticker()});
  if (!goalBefore && stats.today.n >= S.goal) rewards.push({type:"goal"});
  save("ob-stats", stats);
  renderProgress();
  if (lyn.state !== "running") flushRewards();
}
function awardSticker(){
  const missing = STICKERS.map((_,i)=>i).filter(i=>!stats.stickers[i]);
  const idx = missing.length ? missing[0] : Math.floor(Math.random()*STICKERS.length);
  stats.stickers[idx] = (stats.stickers[idx]||0) + 1;
  return idx;
}
function renderProgress(){
  const n = stats.today.date===day() ? stats.today.n : 0;
  const frac = Math.min(1, n/S.goal);
  $("ring").style.strokeDashoffset = 119.4*(1-frac);
  $("ring").style.stroke = frac>=1 ? "var(--accent)" : "";
  $("ring-n").textContent = n;
  $("goal-txt").textContent = n + " / " + S.goal;
  const live = stats.streak.last===day() || stats.streak.last===day(1);
  const sn = live ? stats.streak.n : 0;
  $("streak-n").textContent = sn;
  $("streak").classList.toggle("off", stats.streak.last!==day());
  $("streak").setAttribute("aria-label", sn+" dager på rad");
  const into = stats.total % PER_STICKER;
  $("sp-bar").style.width = (into/PER_STICKER*100)+"%";
  const left = PER_STICKER - into;
  $("sp-txt").textContent = left===1 ? "1 ord til neste klistremerke!" : left+" ord til neste klistremerke";
}
function flushRewards(){
  if (!$("reward").hidden || !rewards.length) return;
  const rw = rewards.shift();
  if (rw.type==="sticker"){
    const [e,name] = STICKERS[rw.idx];
    $("rw-eyebrow").textContent = "Nytt klistremerke";
    $("rw-e").textContent = e; $("rw-n").textContent = name;
    $("rw-p").textContent = stats.stickers[rw.idx]>1 ? "Du har "+stats.stickers[rw.idx]+" av denne nå." : "Nå har du "+Object.keys(stats.stickers).length+" av "+STICKERS.length+" dyr.";
    $("rw-ok").textContent = "Så fint!";
    chime([660,880,1320], S.sound);
  } else if (rw.type==="goal"){
    $("rw-eyebrow").textContent = "Dagens mål";
    $("rw-e").textContent = "⭐"; $("rw-n").textContent = "Du klarte det!";
    $("rw-p").textContent = S.goal+" ord i dag. " + (stats.streak.n>1 ? stats.streak.n+" dager på rad!" : "Kom tilbake i morgen for å starte en rekke.");
    $("rw-ok").textContent = "Hurra!";
    chime([523,659,784,1047], S.sound);
  } else if (rw.type==="record"){
    $("rw-eyebrow").textContent = "Lynrunde";
    $("rw-e").textContent = "🏆"; $("rw-n").textContent = "Ny rekord!";
    $("rw-p").textContent = rw.score+" ord på "+S.dur+" sekunder.";
    $("rw-ok").textContent = "Jippi!";
    chime([784,988,1175,1568], S.sound);
  }
  $("reward").hidden=false; $("scrim").hidden=false;
  confetti();
  setTimeout(()=>$("rw-ok").focus(),50);
}
$("rw-ok").onclick=()=>{ $("reward").hidden=true; $("scrim").hidden=true; flushRewards(); };

/* ---------- Normal modes ---------- */
function newSet(){
  clearTimeout(flashTimer);
  if (S.mode==="ord"){ current = pickWords(S.count); revealIdx = current.length; }
  else { current = sentence(S.len); revealIdx = S.build ? 1 : current.length; }
  renderWords(true);
}
function renderWords(animate){
  const box=$("words");
  box.hidden=false; $("panel").hidden=true;
  box.classList.remove("hidden","pop");
  box.innerHTML="";
  current.forEach((w,i)=>{
    const b=document.createElement("button");
    b.className="word"+(marked.has(clean(w))?" marked":"")+(i>=revealIdx?" ghost":"");
    b.style.setProperty("--i", animate ? i : 0);
    b.textContent=w; b.type="button";
    b.setAttribute("aria-label", w + (marked.has(clean(w))?", merket":""));
    b.addEventListener("click",()=>toggleMark(clean(w)));
    box.appendChild(b);
  });
  if (animate){ void box.offsetWidth; box.classList.add("pop"); }
  $("reveal").hidden=true;
  const complete = revealIdx>=current.length;
  $("hint").textContent = S.mode==="ord" ? "Trykk på et ord som var vanskelig" : (S.build && !complete ? "Les ordet, så trykk «Neste ord»" : "");
  renderBottom();
  if (complete && S.flash>0 && S.mode!=="lyn"){
    flashTimer=setTimeout(()=>{box.classList.add("hidden");$("reveal").hidden=false;}, S.flash*1000);
  }
}
function next(){
  requestWake();
  if (revealIdx < current.length){
    revealIdx++;
    const w = $("words").children[revealIdx-1];
    if (w){ w.classList.remove("ghost"); w.style.setProperty("--i",0); }
    renderBottom();
    if (revealIdx>=current.length) $("hint").textContent="";
    return;
  }
  addWords(current.length);
  newSet();
}
function toggleMark(w){
  if (lyn.state==="running") return;
  marked.has(w)?marked.delete(w):marked.add(w);
  save("ob-marked",[...marked]);
  [...$("words").children].forEach(b=>{ if(clean(b.textContent)===w) b.classList.toggle("marked", marked.has(w)); });
  renderMarked();
}

/* ---------- Lynrunde ---------- */
function lynIntro(){
  clearInterval(lyn.tick);
  lyn.state="idle";
  $("words").hidden=true; $("timer").hidden=true; $("score").hidden=true; $("reveal").hidden=true; $("hint").textContent="";
  const best = stats.best[S.dur]||0;
  $("panel").hidden=false;
  $("panel").innerHTML = `<div class="intro"><h2>Lynrunde</h2>
    <p>Les så mange ord du klarer på ${S.dur} sekunder. Den voksne trykker «Kunne» når ordet sitter.</p>
    ${best?`<p>Rekorden din: <b>${best} ord</b></p>`:`<p>Sett din første rekord!</p>`}</div>`;
  renderBottom();
}
function lynStart(){
  requestWake();
  lyn = {state:"countdown", score:0, combo:0, missed:[], end:0, tick:null, word:""};
  $("panel").hidden=false; $("words").hidden=true; renderBottom();
  let c=3;
  const show=()=>{ $("panel").innerHTML=`<div class="big">${c}</div>`; chime([440+ (3-c)*60], S.sound); };
  show();
  const iv=setInterval(()=>{ c--; if(c>0){show();} else { clearInterval(iv); lynGo(); } }, 700);
}
function lynGo(){
  lyn.state="running"; lyn.end=Date.now()+S.dur*1000;
  $("panel").hidden=true; $("timer").hidden=false; $("score").hidden=false;
  lynWord(); renderBottom(); updateScore();
  lyn.tick=setInterval(()=>{
    const left=Math.max(0,lyn.end-Date.now());
    $("timer-bar").style.width=(left/(S.dur*1000)*100)+"%";
    $("timer").classList.toggle("low", left<10000);
    if(left<=0) lynFinish();
  },100);
}
function lynWord(){
  current = pickWords(1); revealIdx=1; lyn.word=current[0];
  renderWords(true);
  $("hint").textContent="";
}
function lynAnswer(ok){
  if (lyn.state!=="running") return;
  if (ok){
    lyn.score++; lyn.combo++;
    if (lyn.combo>0 && lyn.combo%5===0){
      const c=$("combo"); c.textContent=lyn.combo+" på rad!"; c.classList.remove("show"); void c.offsetWidth; c.classList.add("show");
      chime([880,1175], S.sound);
    }
  } else {
    lyn.combo=0;
    if(!lyn.missed.includes(lyn.word)) lyn.missed.push(lyn.word);
    marked.add(lyn.word); save("ob-marked",[...marked]);
  }
  addWords(1);
  updateScore(); lynWord();
}
function updateScore(){ $("score").innerHTML = `${lyn.score}<small>kunne</small>`; }
function lynFinish(){
  clearInterval(lyn.tick);
  lyn.state="done";
  $("timer").hidden=true; $("score").hidden=true; $("words").hidden=true; $("hint").textContent="";
  const best = stats.best[S.dur]||0;
  const isRecord = lyn.score>0 && lyn.score>best;
  if (isRecord){ stats.best[S.dur]=lyn.score; save("ob-stats",stats); rewards.unshift({type:"record", score:lyn.score}); }
  $("panel").hidden=false;
  $("panel").innerHTML = `<div class="intro">
    <span class="label">Du klarte</span>
    <div class="big">${lyn.score}</div>
    <p>ord på ${S.dur} sekunder</p>
    ${isRecord?'<span class="record">Ny rekord!</span>':(best?`<p>Rekord: ${best}</p>`:"")}
    ${lyn.missed.length?`<p>Øv mer på:</p><div class="missed">${lyn.missed.map(w=>`<span>${w}</span>`).join("")}</div>`:""}
  </div>`;
  renderBottom();
  flushRewards();
}

/* ---------- Bottom bar ---------- */
function renderBottom(){
  const b=$("bottom");
  if (S.mode!=="lyn"){
    const complete = revealIdx>=current.length;
    b.innerHTML=`<button class="next" id="next">${complete?"Neste":"Neste ord"}</button>`;
    $("next").onclick=next;
  } else if (lyn.state==="running"){
    b.innerHTML=`<button class="btn2" id="miss">Øv mer</button><button class="next btn-good" id="hit">Kunne!</button>`;
    $("miss").onclick=()=>lynAnswer(false); $("hit").onclick=()=>lynAnswer(true);
  } else if (lyn.state==="countdown"){
    b.innerHTML=`<button class="next" disabled>Gjør deg klar…</button>`;
  } else {
    b.innerHTML=`<button class="next" id="start">${lyn.state==="done"?"Spill igjen":"Start lynrunde"}</button>`;
    $("start").onclick=lynStart;
  }
}

/* ---------- Settings ---------- */
function applySize(){
  const scale=[.7,.85,1,1.2,1.45][S.size-1];
  const crowd = S.mode==="setning" ? .78 : S.mode==="lyn" ? 1.15 : (S.count>=5?.72:S.count>=3?.85:1);
  document.documentElement.style.setProperty("--word-scale", scale*crowd);
}
function syncUI(){
  ["ord","setning","lyn"].forEach(m=>document.querySelector(`[data-mode="${m}"]`).setAttribute("aria-pressed", S.mode===m));
  $("f-count").hidden = S.mode!=="ord";
  $("f-length").hidden = S.mode!=="setning";
  $("c-val").textContent=S.count;
  const press=(attr,val)=>document.querySelectorAll(`[data-${attr}]`).forEach(b=>b.setAttribute("aria-pressed",b.dataset[attr]==String(val)));
  press("len",S.len); press("flash",S.flash); press("list",S.list); press("goal",S.goal); press("dur",S.dur);
  $("custom-wrap").hidden = S.list!=="egen";
  $("build").checked=S.build; $("sound").checked=S.sound;
  $("size").value=S.size;
  applySize();
  save("ob-settings",S);
}
function renderMarked(){
  const c=$("marked"); c.innerHTML="";
  if(!marked.size){ c.innerHTML='<p class="small">Ingen merkede ord ennå.</p>'; return; }
  [...marked].sort().forEach(w=>{
    const b=document.createElement("button"); b.textContent=w; b.setAttribute("aria-label","Fjern "+w);
    b.onclick=()=>toggleMark(w); c.appendChild(b);
  });
}
function renderBook(){
  const have = Object.keys(stats.stickers).length;
  $("book-title").textContent = `Klistremerkebok · ${have}/${STICKERS.length}`;
  $("book").innerHTML = STICKERS.map(([e,n],i)=>{
    const c=stats.stickers[i]||0;
    return `<div class="st${c?"":" locked"}"><span class="e" aria-hidden="true">${e}</span><span class="n">${c?n:"?"}</span>${c>1?`<span class="x">×${c}</span>`:""}</div>`;
  }).join("");
}
function setMode(m){
  if (lyn.tick) clearInterval(lyn.tick);
  lyn.state="idle";
  S.mode=m; syncUI();
  $("timer").hidden=true; $("score").hidden=true;
  if (m==="lyn") lynIntro(); else newSet();
}

Object.entries(LISTS).forEach(([k,v])=>{
  const b=document.createElement("button"); b.className="opt"; b.dataset.list=k; b.textContent=v.name;
  b.onclick=()=>{S.list=k; lastShown=new Set(); syncUI(); if(S.mode==="ord") newSet();};
  $("list-opts").appendChild(b);
});
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
document.querySelectorAll("[data-len]").forEach(b=>b.onclick=()=>{S.len=b.dataset.len; syncUI(); newSet();});
document.querySelectorAll("[data-flash]").forEach(b=>b.onclick=()=>{S.flash=+b.dataset.flash; syncUI();});
document.querySelectorAll("[data-goal]").forEach(b=>b.onclick=()=>{S.goal=+b.dataset.goal; syncUI(); renderProgress();});
document.querySelectorAll("[data-dur]").forEach(b=>b.onclick=()=>{S.dur=+b.dataset.dur; syncUI(); if(S.mode==="lyn") lynIntro();});
$("c-minus").onclick=()=>{S.count=Math.max(1,S.count-1); syncUI(); newSet();};
$("c-plus").onclick=()=>{S.count=Math.min(6,S.count+1); syncUI(); newSet();};
$("build").onchange=e=>{S.build=e.target.checked; syncUI(); newSet();};
$("sound").onchange=e=>{S.sound=e.target.checked; syncUI(); chime([660,880], S.sound);};
$("size").oninput=e=>{S.size=+e.target.value; syncUI();};
$("custom").value=LISTS.egen.words;
$("custom").oninput=e=>{LISTS.egen.words=e.target.value; save("ob-custom",e.target.value);};
$("custom").onchange=()=>{ if(S.mode==="ord") newSet(); };
$("clear-marked").onclick=()=>{marked.clear(); save("ob-marked",[]); renderMarked(); [...$("words").children].forEach(b=>b.classList.remove("marked"));};
let resetArmed=false;
$("reset").onclick=()=>{
  if(!resetArmed){ resetArmed=true; $("reset").textContent="Trykk igjen for å nullstille alt"; setTimeout(()=>{resetArmed=false;$("reset").textContent="Nullstill klistremerker og rekorder";},4000); return; }
  stats=freshStats(); save("ob-stats",stats); resetArmed=false;
  $("reset").textContent="Nullstilt"; renderProgress(); updateTotal();
};
function updateTotal(){ $("total-txt").textContent = `${stats.total} ord lest totalt · ${Object.keys(stats.stickers).length} av ${STICKERS.length} klistremerker`; }
$("reveal").onclick=()=>{$("words").classList.remove("hidden"); $("reveal").hidden=true;};

const openSheet=id=>{ if(lyn.state==="running") return; if(id==="sheet"){renderMarked();updateTotal();} else renderBook(); $(id).hidden=false; $("scrim").hidden=false; };
const closeSheets=()=>{ if(!$("reward").hidden) return; $("sheet").hidden=true; $("booksheet").hidden=true; $("scrim").hidden=true; };
$("open-settings").onclick=()=>openSheet("sheet");
$("open-book").onclick=()=>openSheet("booksheet");
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeSheets);
$("scrim").onclick=closeSheets;

document.addEventListener("keydown",e=>{
  if(!$("reward").hidden){ if(e.key==="Enter"||e.key===" "||e.key==="Escape"){e.preventDefault();$("rw-ok").click();} return; }
  if(!$("sheet").hidden||!$("booksheet").hidden){ if(e.key==="Escape") closeSheets(); return; }
  if(e.target.tagName==="TEXTAREA") return;
  const go = e.key===" "||e.key==="Enter"||e.key==="ArrowRight";
  if (S.mode==="lyn"){
    if (lyn.state==="running"){ if(go){e.preventDefault();lynAnswer(true);} if(e.key==="ArrowLeft"){e.preventDefault();lynAnswer(false);} }
    else if (go && lyn.state!=="countdown"){ e.preventDefault(); lynStart(); }
    return;
  }
  if(go && (e.target.tagName!=="BUTTON"||e.target.id==="next")){e.preventDefault(); next();}
});

syncUI(); renderProgress();
if (S.mode==="lyn") lynIntro(); else newSet();
