
const LESSON_DATA = window.LESSON_DATA;

// ---------- teacher dashboard (Google Form) ----------
const FORM_ACTION_URL = "https://docs.google.com/forms/u/0/d/e/1FAIpQLSfhUo_f1p32w39mZb9L51twf0ihz1dy-zEtX8DYfZyspxaXjQ/formResponse";
const FORM_FIELDS = {
  name: "entry.929598147",
  lesson: "entry.300887767",
  problem: "entry.770786380",
  result: "entry.1922763093"
};

// ---------- calendar tie-in (from the "AP Stat 26-27" Google Calendar) ----------
// Refreshed periodically by a scheduled rebuild — see CALENDAR_UPDATED for when this list was last pulled.
const CALENDAR_UPDATED = "2026-08-31";
const CALENDAR_EVENTS = window.CALENDAR_EVENTS || [];

const SYNONYMS = {
  "z score":"z-score", "zscore":"z-score", "standardize":"z-score",
  "std dev":"standard deviation", "stdev":"standard deviation", "sd":"standard deviation",
  "ci":"confidence interval", "conf interval":"confidence interval", "confidence intervals":"confidence interval",
  "hyp test":"hypothesis test", "sig test":"hypothesis test", "significance test":"hypothesis test", "hypothesis tests":"hypothesis test",
  "chi squared":"chi-square", "chi square":"chi-square", "chisquare":"chi-square",
  "corr":"correlation", "r-squared":"coefficient of determination", "r2":"coefficient of determination", "r^2":"coefficient of determination",
  "lsrl":"least squares regression", "regression line":"linear regression",
  "iqr":"interquartile range", "5 number summary":"five-number summary",
  "clt":"central limit theorem",
  "t test":"hypothesis test", "t-test":"hypothesis test", "z test":"hypothesis test", "z-test":"hypothesis test",
  "margin of error":"margin of error confidence interval",
  "srs":"simple random sample",
  "type 1 error":"type i error", "type 2 error":"type ii error",
  "p value":"p-value", "pvalue":"p-value",
  "binomial dist":"binomial distribution",
  "normalcdf":"normal distribution calculations", "invnorm":"normal distribution calculations",
  "two way table":"two-way table",
};

const STOPWORDS = new Set(["a","an","the","how","do","does","did","doesn't","i","you","your","we","if","is","are","was","were","be","been","being",
  "of","to","in","on","for","and","or","but","that","this","these","those","what","when","which","who","whom","why","where",
  "with","from","by","as","it","its","it's","can","could","should","would","will","shall","may","might","must",
  "know","understand","find","get","tell","help","need","want","me","my","so","also","about","two","one","there","their",
  "explain","describe","calculate","determine","identify"]);

function norm(s){
  return (s||"").toLowerCase().replace(/[^\w\s.\-]/g," ").replace(/\s+/g," ").trim();
}
function expandQuery(q){
  let n = norm(q);
  for (const k in SYNONYMS){ if (n.includes(k)) n += " " + SYNONYMS[k]; }
  return n;
}

// Precompute search text per lesson (guarded: pages like links.html include app.js
// for the nav-highlighter + Ask Mr. Ian widget only, without loading data.js's ~800KB dataset)
if (LESSON_DATA && LESSON_DATA.lessons) LESSON_DATA.lessons.forEach(l=>{
  const cedText = l.ced.map(c=>c.num+" "+c.title).join(" ");
  l._titleText = norm(l.title);
  l._searchText = norm([l.title, l.unitTitle, cedText, l.targets.join(" ")].join(" "));
  l._numVariants = [l.lesson, "lesson "+l.lesson, "l"+l.lesson, l.lesson.replace(".","-")];
});

function scoreLesson(l, rawQuery, qTokens){
  const q = norm(rawQuery);
  let score = 0;
  // direct lesson-number style match
  if (l._numVariants.some(v => q === v || q === "unit "+l.unit+" lesson "+l.lesson.split(".")[1])) score += 100;
  else if (q.length<=6 && l.lesson === q) score += 100;
  // CED topic explicit search
  if (/(ced|topic)\s*\d/.test(q)){
    l.ced.forEach(c=>{ if (q.includes(c.num)) score += 40; });
  }
  // phrase match in title
  if (q.length>2 && l._titleText.includes(q)) score += 30;
  // token overlap
  qTokens.forEach(t=>{
    if (t.length<2) return;
    if (l._titleText.includes(t)) score += 6;
    else if (l._searchText.includes(t)) score += 2;
  });
  return score;
}

function search(rawQuery){
  const expanded = expandQuery(rawQuery);
  const qTokens = expanded.split(" ").filter(t=>t.length>1 && !STOPWORDS.has(t));
  const scored = LESSON_DATA.lessons.map(l=>({l, s: scoreLesson(l, rawQuery, qTokens)}));
  scored.sort((a,b)=>b.s-a.s);
  return scored.filter(x=>x.s>0).slice(0,8);
}

// ---------- rendering ----------
const resultsEl = document.getElementById("results");
const browseEl = document.getElementById("browse");
const qInput = document.getElementById("q");
const toastEl = document.getElementById("toast");

function toast(msg){
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  setTimeout(()=>toastEl.classList.remove("show"), 1800);
}

function getLog(){
  try{ return JSON.parse(localStorage.getItem("statIndexLog")||"{}"); }catch(e){ return {}; }
}
function setLogEntry(lesson, probIdx, val){
  try{
    const log = getLog();
    log[lesson] = log[lesson]||{};
    log[lesson][probIdx] = val;
    localStorage.setItem("statIndexLog", JSON.stringify(log));
  }catch(e){}
}

// ---------- name capture + teacher dashboard submission ----------
const nameModal = document.getElementById("nameModal");
const nameInput = document.getElementById("nameInput");
let _pendingNameCb = null;

function ensureStudentName(cb){
  if (!nameModal || !nameInput){ cb(""); return; } // page has no name-modal markup (e.g. self-check UI used somewhere unexpected)
  let existing = null;
  try{ existing = localStorage.getItem("statIndexStudentName"); }catch(e){}
  if (existing !== null){ cb(existing); return; }
  _pendingNameCb = cb;
  nameModal.hidden = false;
  nameInput.value = "";
  setTimeout(()=>nameInput.focus(), 30);
}
const nameSaveBtn = document.getElementById("nameSave");
const nameSkipBtn = document.getElementById("nameSkip");
if (nameSaveBtn) nameSaveBtn.addEventListener("click", ()=>{
  const val = nameInput.value.trim().slice(0,60);
  try{ localStorage.setItem("statIndexStudentName", val); }catch(e){}
  nameModal.hidden = true;
  if (_pendingNameCb){ const cb=_pendingNameCb; _pendingNameCb=null; cb(val); }
});
if (nameSkipBtn) nameSkipBtn.addEventListener("click", ()=>{
  try{ localStorage.setItem("statIndexStudentName", ""); }catch(e){}
  nameModal.hidden = true;
  if (_pendingNameCb){ const cb=_pendingNameCb; _pendingNameCb=null; cb(""); }
});
if (nameInput) nameInput.addEventListener("keydown", (e)=>{
  if (e.key === "Enter" && nameSaveBtn) nameSaveBtn.click();
});

function submitCheckIn(lesson, probIdx, val){
  ensureStudentName(function(name){
    if (!name) return; // student skipped — local log above still saved
    try{
      const body = new URLSearchParams();
      body.append(FORM_FIELDS.name, name);
      body.append(FORM_FIELDS.lesson, lesson);
      body.append(FORM_FIELDS.problem, "Practice " + (Number(probIdx)+1));
      body.append(FORM_FIELDS.result, val === "got" ? "✅" : "🤔");
      fetch(FORM_ACTION_URL, {method:"POST", mode:"no-cors", body}).catch(()=>{ /* offline or blocked — local log already has it */ });
    }catch(e){ /* offline or blocked — local log already has it */ }
  });
}

function readingBoxHTML(l){
  if (!l.pages){
    return `<div class="reading-box missing">
      <div class="pages">Not mapped yet</div>
      <div class="note">${l.note ? l.note.replace(/</g,"&lt;") : "No dedicated textbook pages for this lesson."}</div>
    </div>`;
  }
  return `<div class="reading-box">
    <div class="pages">TPS8e p. ${l.pages} — read it on BFW Achieve</div>
    <div class="section-name">Section ${l.section}${l.book ? " · "+l.book : ""}</div>
    ${l.note ? `<div class="note">${l.note.replace(/</g,"&lt;")}</div>` : ""}
  </div>`;
}

function problemHTML(l, idx, p, opts){
  opts = opts || {};
  const log = getLog();
  const saved = (log[l.lesson]||{})[idx];
  const badge = opts.showLessonBadge ? `<span class="mr-lesson-badge">${l.lesson}</span>` : "";
  return `<div class="problem" data-lesson="${l.lesson}" data-idx="${idx}">
    <div class="p-label">${badge}Practice ${idx+1}</div>
    <div class="p-prompt">${p.prompt.replace(/</g,"&lt;")}</div>
    <button class="reveal-btn" type="button">Show answer &amp; solution</button>
    <div class="answer-box" hidden>
      <div class="ans">Answer: ${p.answer.replace(/</g,"&lt;")}</div>
      <div class="sol">${p.solution.replace(/</g,"&lt;")}</div>
      <div class="self-check">
        <button class="got ${saved==='got'?'active':''}" type="button" data-val="got">✅ Got it</button>
        <button class="shaky ${saved==='shaky'?'active':''}" type="button" data-val="shaky">🤔 Still shaky</button>
      </div>
    </div>
  </div>`;
}

function cardHTML(l, score){
  const cedRow = l.ced.length
    ? `<div class="ced-row">${l.ced.map(c=>`<span class="ced-chip">CED ${c.num} · ${c.title}</span>`).join("")}</div>`
    : `<div class="ced-row"><span class="ced-chip">Spiraled skills lesson — no single new CED topic</span></div>`;
  const targets = `<ul class="targets">${l.targets.map(t=>`<li>${t.replace(/</g,"&lt;")}</li>`).join("")}</ul>`;
  const problems = l.problems.map((p,i)=>problemHTML(l,i,p)).join("");
  return `
  <div class="card" data-lesson="${l.lesson}">
    <button class="card-head" type="button">
      <span class="lesson-num">${l.lesson}</span>
      <span class="titles">
        <span class="unit-line">Unit ${l.unit} · ${l.unitTitle}</span>
        <span class="lesson-title">${l.title}</span>
      </span>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
    </button>
    <div class="card-body" hidden>
      <section>
        <h3>CED topic${l.ced.length>1?"s":""}</h3>
        ${cedRow}
      </section>
      <section>
        <h3>What this lesson covers</h3>
        ${targets}
      </section>
      <section>
        <h3>Where to read it</h3>
        ${readingBoxHTML(l)}
      </section>
      <section>
        <h3>Practice</h3>
        ${problems}
      </section>
    </div>
  </div>`;
}

function attachCardHandlers(root){
  root.querySelectorAll(".card").forEach(card=>{
    const head = card.querySelector(".card-head");
    const body = card.querySelector(".card-body");
    head.addEventListener("click", ()=>{
      const isOpen = card.classList.toggle("open");
      body.hidden = !isOpen;
    });
  });
  root.querySelectorAll(".reveal-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const box = btn.nextElementSibling;
      box.hidden = !box.hidden;
      btn.textContent = box.hidden ? "Show answer & solution" : "Hide answer & solution";
    });
  });
  root.querySelectorAll(".self-check button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const problem = btn.closest(".problem");
      const lesson = problem.dataset.lesson, idx = problem.dataset.idx;
      const val = btn.dataset.val;
      const already = btn.classList.contains("active");
      problem.querySelectorAll(".self-check button").forEach(b=>b.classList.remove("active"));
      if (!already){
        btn.classList.add("active");
        setLogEntry(lesson, idx, val);
        submitCheckIn(lesson, idx, val);
      } else {
        setLogEntry(lesson, idx, null);
      }
    });
  });
}

// ---------- calculator help (TI-84 Plus CE / CE Evo) ----------
function videoCardHTML(v){
  if (!v) return "";
  return `<div class="video-card">
    <a class="video-thumb" href="${v.url}" target="_blank" rel="noopener" aria-label="Watch ${escAttr(v.title)} on YouTube">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M9 7l8 5-8 5V7z"/></svg>
    </a>
    <div class="video-meta">
      <div class="video-title">${v.title.replace(/</g,"&lt;")}</div>
      <div class="video-channel">${v.channel.replace(/</g,"&lt;")}${v.durationLabel ? " · "+v.durationLabel : ""}</div>
      <a class="video-link" href="${v.url}" target="_blank" rel="noopener">▶ Watch on YouTube ↗</a>
    </div>
  </div>`;
}

function calcTopicHTML(topic){
  const relRow = (topic.relatedLessons||[]).length
    ? `<div class="ced-row">${topic.relatedLessons.map(n=>`<span class="ced-chip calc-lesson-chip" data-lesson="${n}">Lesson ${n}</span>`).join("")}</div>`
    : "";
  const problems = topic.problems.map((p,i)=>problemHTML({lesson:`calc:${topic.id}`}, i, p)).join("");
  return `
  <div class="card calc-card" data-calc="${topic.id}">
    <button class="card-head" type="button">
      <span class="lesson-num calc-num">🧮</span>
      <span class="titles">
        <span class="unit-line">Calculator Help</span>
        <span class="lesson-title">${topic.title}</span>
      </span>
      <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><polyline points="9 6 15 12 9 18"/></svg>
    </button>
    <div class="card-body" hidden>
      ${relRow ? `<section><h3>Related lessons</h3>${relRow}</section>` : ""}
      <section><h3>What this covers</h3><p style="margin:0;font-size:.95rem;">${topic.description.replace(/</g,"&lt;")}</p></section>
      <section><h3>Video walkthrough</h3>${videoCardHTML(topic.video)}</section>
      <section><h3>Practice</h3>${problems}</section>
    </div>
  </div>`;
}

function buildCalcBrowse(){
  const calcBrowseEl = document.getElementById("calcBrowse");
  if (!calcBrowseEl) return; // this page has no Calculator Help section
  const topics = LESSON_DATA.calcTopics || [];
  if (!topics.length){ calcBrowseEl.innerHTML = ""; return; }
  calcBrowseEl.innerHTML = topics.map(calcTopicHTML).join("");
  attachCardHandlers(calcBrowseEl);
  calcBrowseEl.querySelectorAll(".calc-lesson-chip").forEach(chip=>{
    chip.addEventListener("click", (e)=>{
      e.stopPropagation();
      jumpToLesson(chip.dataset.lesson);
    });
  });
}
buildCalcBrowse();

// ---------- interpretation practice ----------
// Reuses the same .problem shell, reveal-btn, and self-check markup/behavior as regular
// practice problems (see problemHTML + attachCardHandlers) so it plugs into the existing
// getLog/setLogEntry/submitCheckIn pipeline unchanged — self-checks here are keyed "interp:<id>",
// the same convention Calculator Help uses ("calc:<topic-id>").
function interpCardHTML(item){
  const log = getLog();
  const key = `interp:${item.id}`;
  const saved = (log[key]||{})[0];
  return `<div class="problem interp-card" data-lesson="${key}" data-idx="0">
    <div class="ic-cat">${item.category}${item.unit ? ` · Unit ${item.unit}` : ""}</div>
    <div class="ic-title">${item.title.replace(/</g,"&lt;")}</div>
    <div class="p-prompt">${item.setup.replace(/</g,"&lt;")}</div>
    <div class="p-prompt" style="font-weight:600;margin-top:8px;">${item.prompt.replace(/</g,"&lt;")}</div>
    <textarea placeholder="Type your interpretation sentence here… (this isn't saved or checked automatically — it's just to make you commit to an answer before revealing the model one)" rows="3"></textarea>
    <button class="reveal-btn" type="button">Reveal model answer</button>
    <div class="answer-box" hidden>
      <div class="ans">${item.model.replace(/</g,"&lt;")}</div>
      <div class="sol">${item.note ? item.note.replace(/</g,"&lt;") : ""}</div>
      <div class="self-check">
        <button class="got ${saved==='got'?'active':''}" type="button" data-val="got">✅ Got it</button>
        <button class="shaky ${saved==='shaky'?'active':''}" type="button" data-val="shaky">🤔 Still shaky</button>
      </div>
    </div>
  </div>`;
}
function buildInterpBrowse(){
  const el = document.getElementById("interpBrowse");
  if (!el) return; // this page has no Interpretation Practice section
  const items = window.INTERP_DATA || [];
  if (!items.length) return;
  // Grouped into a click-to-expand accordion by category (Standard Deviation, z-score, etc.) —
  // same <details class="unit-group"> pattern as Practice Problems' "Browse every unit" —
  // instead of dumping all 60 cards in one long flat list.
  const cats = {};
  const order = [];
  items.forEach(it=>{
    if (!cats[it.category]){ cats[it.category] = []; order.push(it.category); }
    cats[it.category].push(it);
  });
  el.innerHTML = order.map(cat=>{
    const group = cats[cat];
    const cards = group.map(interpCardHTML).join("");
    return `<details class="unit-group">
      <summary><span class="u-chev">▸</span> ${cat.replace(/</g,"&lt;")} <span class="vocab-count">${group.length} problems</span></summary>
      <div class="unit-list">${cards}</div>
    </details>`;
  }).join("");
  attachCardHandlers(el);
}
buildInterpBrowse();

const interpExpandAllBtn = document.getElementById("interpExpandAll");
if (interpExpandAllBtn) interpExpandAllBtn.addEventListener("click", (e)=>{
  const details = document.getElementById("interpBrowse").querySelectorAll("details");
  const anyClosed = Array.from(details).some(d=>!d.open);
  details.forEach(d=> d.open = anyClosed);
  e.target.textContent = anyClosed ? "Collapse all" : "Expand all";
});

// ---------- vocabulary flashcards ----------
// Same shell/self-check/logging pipeline as everything else (see problemHTML + attachCardHandlers),
// keyed "vocab:<term-id>" (same convention as "calc:<topic-id>" and "interp:<id>").
function vocabCardHTML(item){
  const log = getLog();
  const key = `vocab:${item.id}`;
  const saved = (log[key]||{})[0];
  return `<div class="problem vocab-card" data-lesson="${key}" data-idx="0">
    <div class="vc-meta">Lesson ${item.lesson} · Unit ${item.unit} · ${item.unitTitle}</div>
    <div class="vc-term">${item.term.replace(/</g,"&lt;")}</div>
    <button class="reveal-btn" type="button">Reveal definition</button>
    <div class="answer-box" hidden>
      <div class="ans">${item.definition.replace(/</g,"&lt;")}</div>
      <div class="self-check">
        <button class="got ${saved==='got'?'active':''}" type="button" data-val="got">✅ Got it</button>
        <button class="shaky ${saved==='shaky'?'active':''}" type="button" data-val="shaky">🤔 Still shaky</button>
      </div>
    </div>
  </div>`;
}

function searchVocabTerms(rawQuery){
  const q = norm(rawQuery);
  if (!q) return [];
  const items = window.VOCAB_DATA || [];
  const scored = items.map(item=>{
    const t = norm(item.term);
    let score = 0;
    if (t === q) score = 100;
    else if (t.startsWith(q)) score = 60;
    else if (t.includes(q)) score = 40;
    else if (norm(item.definition).includes(q)) score = 10;
    return {item, score};
  });
  return scored.filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,20);
}

function renderVocabResults(matches, rawQuery){
  const el = document.getElementById("vresults");
  if (!el) return; // this page has no Vocabulary search box
  if (!rawQuery.trim()){ el.innerHTML = ""; return; }
  if (!matches.length){
    el.innerHTML = `<div class="empty-state">No vocab term matches “${rawQuery.replace(/</g,"&lt;")}.” Try browsing by unit below.</div>`;
    return;
  }
  el.innerHTML = matches.map(m=>vocabCardHTML(m.item)).join("");
  attachCardHandlers(el);
}

const vqInput = document.getElementById("vq");
let vocabDebounce;
if (vqInput) vqInput.addEventListener("input", ()=>{
  clearTimeout(vocabDebounce);
  vocabDebounce = setTimeout(()=>{
    const val = vqInput.value;
    renderVocabResults(searchVocabTerms(val), val);
  }, 150);
});

function buildVocabBrowse(){
  const el = document.getElementById("vocabBrowse");
  if (!el) return; // this page has no Vocabulary browse section
  const items = window.VOCAB_DATA || [];
  if (!items.length) return;
  const units = {};
  items.forEach(v=>{
    units[v.unit] = units[v.unit] || {title: v.unitTitle, lessons: {}, order: [], count: 0};
    if (!units[v.unit].lessons[v.lesson]){ units[v.unit].lessons[v.lesson] = []; units[v.unit].order.push(v.lesson); }
    units[v.unit].lessons[v.lesson].push(v);
    units[v.unit].count++;
  });
  const unitNums = Object.keys(units).map(Number).sort((a,b)=>a-b);
  el.innerHTML = unitNums.map(u=>{
    const grp = units[u];
    const body = grp.order.map(lesson=>{
      const cards = grp.lessons[lesson].map(vocabCardHTML).join("");
      return `<div class="vocab-lesson-heading">Lesson ${lesson}</div>${cards}`;
    }).join("");
    return `<details class="unit-group">
      <summary><span class="u-chev">▸</span> Unit ${u}: ${grp.title} <span class="vocab-count">${grp.count} terms</span></summary>
      <div class="unit-list vocab-list">${body}</div>
    </details>`;
  }).join("");
  attachCardHandlers(el);
}
buildVocabBrowse();

const vocabExpandAllBtn = document.getElementById("vocabExpandAll");
if (vocabExpandAllBtn) vocabExpandAllBtn.addEventListener("click", (e)=>{
  const details = document.getElementById("vocabBrowse").querySelectorAll("details");
  const anyClosed = Array.from(details).some(d=>!d.open);
  details.forEach(d=> d.open = anyClosed);
  e.target.textContent = anyClosed ? "Collapse all" : "Expand all";
});

// ---------- describing distributions (SOCV + context) ----------
// Stats helpers mirror the textbook's quartile method exactly (median-of-halves, excluding
// the overall median from both halves when n is odd) — same method verified against Ian's
// own Math Medic HW answer keys before any of this data was written.
function distMedian(vals){
  const a = vals.slice().sort((x,y)=>x-y);
  const n = a.length, mid = Math.floor(n/2);
  return n%2===0 ? (a[mid-1]+a[mid])/2 : a[mid];
}
function distQuartiles(vals){
  const a = vals.slice().sort((x,y)=>x-y);
  const n = a.length, mid = Math.floor(n/2);
  const lower = a.slice(0,mid);
  const upper = n%2===0 ? a.slice(mid) : a.slice(mid+1);
  return [distMedian(lower), distMedian(upper)];
}
function distSummary(vals){
  const a = vals.slice().sort((x,y)=>x-y);
  const n = a.length;
  const min = a[0], max = a[n-1];
  const median = distMedian(a);
  const [q1,q3] = distQuartiles(a);
  const iqr = q3-q1;
  const loCut = q1-1.5*iqr, hiCut = q3+1.5*iqr;
  const outliers = a.filter(v=>v<loCut||v>hiCut);
  const nonOutliers = a.filter(v=>v>=loCut&&v<=hiCut);
  return {
    min, max, median, q1, q3, iqr, outliers,
    whiskerLo: nonOutliers.length ? Math.min(...nonOutliers) : min,
    whiskerHi: nonOutliers.length ? Math.max(...nonOutliers) : max,
  };
}
function fmtNum(v){
  const r = Math.round(v*100)/100;
  return String(r);
}
function niceTicks(min, max, count){
  const range = (max-min) || 1;
  const rawStep = range/count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep/mag;
  let step;
  if (norm<1.5) step = 1*mag; else if (norm<3) step = 2*mag; else if (norm<7) step = 5*mag; else step = 10*mag;
  const niceMin = Math.floor(min/step)*step;
  const niceMax = Math.ceil(max/step)*step;
  const ticks = [];
  for (let v=niceMin; v<=niceMax+1e-9; v+=step) ticks.push(Math.round(v*1000)/1000);
  return {min: niceMin, max: niceMax, step, ticks};
}
function distColors(){
  const cs = getComputedStyle(document.documentElement);
  const g = (name, fallback) => (cs.getPropertyValue(name)||"").trim() || fallback;
  return {
    ink: g("--ink","#0f172a"), inkSoft: g("--ink-soft","#64748b"), line: g("--line","#e5e7eb"),
    accent: g("--accent","#002664"), accent2: g("--accent2","#41b6e6"), accentTint: g("--accent-tint","#e7ebf2"),
  };
}
function setupDistCanvas(canvas){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth, cssH = canvas.clientHeight;
  if (!cssW || !cssH) return null;
  canvas.width = Math.round(cssW*dpr);
  canvas.height = Math.round(cssH*dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr,0,0,dpr,0,0);
  return {ctx, W: cssW, H: cssH};
}
function drawDistAxis(ctx, x, axisY, nice, unit, W, marginL, marginR){
  const col = distColors();
  ctx.strokeStyle = col.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(marginL, axisY); ctx.lineTo(W-marginR, axisY); ctx.stroke();
  ctx.font = "10.5px 'IBM Plex Mono', monospace"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  nice.ticks.forEach(t=>{
    if (t < nice.min-1e-9 || t > nice.max+1e-9) return;
    const tx = x(t);
    ctx.strokeStyle = col.line;
    ctx.beginPath(); ctx.moveTo(tx,axisY); ctx.lineTo(tx,axisY+5); ctx.stroke();
    ctx.fillStyle = col.inkSoft;
    ctx.fillText(fmtNum(t), tx, axisY+8);
  });
  ctx.font = "11px 'Source Sans 3', sans-serif"; ctx.textAlign = "center";
  ctx.fillStyle = col.inkSoft;
  ctx.fillText(unit, (marginL+W-marginR)/2, axisY+22);
}
function drawOneBoxplotRow(ctx, x, midY, halfH, s, col){
  ctx.strokeStyle = col.accent; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(x(s.whiskerLo), midY); ctx.lineTo(x(s.q1), midY); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x(s.q3), midY); ctx.lineTo(x(s.whiskerHi), midY); ctx.stroke();
  [s.whiskerLo, s.whiskerHi].forEach(v=>{
    ctx.beginPath(); ctx.moveTo(x(v), midY-halfH*0.4); ctx.lineTo(x(v), midY+halfH*0.4); ctx.stroke();
  });
  const bx0 = x(s.q1), bx1 = x(s.q3);
  ctx.fillStyle = col.accentTint;
  ctx.fillRect(bx0, midY-halfH, bx1-bx0, halfH*2);
  ctx.strokeRect(bx0, midY-halfH, bx1-bx0, halfH*2);
  ctx.beginPath(); ctx.moveTo(x(s.median), midY-halfH); ctx.lineTo(x(s.median), midY+halfH); ctx.stroke();
  ctx.fillStyle = col.accent2;
  s.outliers.forEach(v=>{
    ctx.beginPath(); ctx.arc(x(v), midY, 4, 0, Math.PI*2); ctx.fill();
  });
}
function stackDots(ctx, x, data, baselineY, nice, color){
  const tol = Math.max((nice.max-nice.min)/300, 1e-9);
  const sorted = data.slice().sort((a,b)=>a-b);
  const groups = [];
  sorted.forEach(v=>{
    let g = groups.find(g=>Math.abs(g.v-v)<=tol);
    if (!g){ g = {v, count:0}; groups.push(g); }
    g.count++;
  });
  ctx.fillStyle = color;
  const r = 4.5, gap = 1.5;
  groups.forEach(g=>{
    const cx = x(g.v);
    for (let i=0;i<g.count;i++){
      const cy = baselineY - 6 - i*(2*r+gap) - r;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    }
  });
}
function drawDotplot(canvas, data, unit){
  const setup = setupDistCanvas(canvas); if (!setup) return;
  const {ctx,W,H} = setup; const col = distColors();
  ctx.clearRect(0,0,W,H);
  const marginL=34, marginR=18, axisY=H-34;
  const nice = niceTicks(Math.min(...data), Math.max(...data), 5);
  const x = v => marginL + (v-nice.min)/(nice.max-nice.min) * (W-marginL-marginR);
  drawDistAxis(ctx, x, axisY, nice, unit, W, marginL, marginR);
  stackDots(ctx, x, data, axisY, nice, col.accent);
}
function drawHistogram(canvas, data, unit, binWidth){
  const setup = setupDistCanvas(canvas); if (!setup) return;
  const {ctx,W,H} = setup; const col = distColors();
  ctx.clearRect(0,0,W,H);
  const marginL=34, marginR=18, marginT=14, axisY=H-34;
  const min=Math.min(...data), max=Math.max(...data);
  const bw = binWidth || Math.max(1, Math.ceil((max-min)/8));
  const startBin = Math.floor(min/bw)*bw, endBin = Math.ceil(max/bw)*bw;
  const bins = [];
  for (let b=startBin; b<endBin; b+=bw) bins.push({lo:b, hi:b+bw, count:0});
  data.forEach(v=>{
    let idx = Math.floor((v-startBin)/bw);
    if (idx>=bins.length) idx = bins.length-1;
    if (idx<0) idx = 0;
    bins[idx].count++;
  });
  const maxCount = Math.max(...bins.map(b=>b.count), 1);
  const plotH = axisY-marginT;
  const nice = niceTicks(startBin, endBin, 6);
  const x = v => marginL + (v-startBin)/(endBin-startBin) * (W-marginL-marginR);
  drawDistAxis(ctx, x, axisY, {min:startBin, max:endBin, ticks:nice.ticks}, unit, W, marginL, marginR);
  ctx.fillStyle = col.accent;
  bins.forEach(b=>{
    if (!b.count) return;
    const bx0=x(b.lo), bx1=x(b.hi);
    const bh = (b.count/maxCount) * (plotH-8);
    ctx.fillRect(bx0+1, axisY-bh, Math.max(bx1-bx0-2,1), bh);
  });
}
function drawBoxplot(canvas, data, unit){
  const setup = setupDistCanvas(canvas); if (!setup) return;
  const {ctx,W,H} = setup; const col = distColors();
  ctx.clearRect(0,0,W,H);
  const s = distSummary(data);
  const marginL=34, marginR=18, axisY=H-34, midY=(H-34)/2+2;
  const nice = niceTicks(s.min, s.max, 5);
  const x = v => marginL + (v-nice.min)/(nice.max-nice.min) * (W-marginL-marginR);
  drawDistAxis(ctx, x, axisY, nice, unit, W, marginL, marginR);
  drawOneBoxplotRow(ctx, x, midY, 24, s, col);
}
function drawParallelBoxplot(canvas, dataA, dataB, labelA, labelB, unit){
  const setup = setupDistCanvas(canvas); if (!setup) return;
  const {ctx,W,H} = setup; const col = distColors();
  ctx.clearRect(0,0,W,H);
  const sA = distSummary(dataA), sB = distSummary(dataB);
  const marginL=34, marginR=18, axisY=H-34;
  const rowAY = 58, rowBY = axisY-52;
  const nice = niceTicks(Math.min(sA.min,sB.min), Math.max(sA.max,sB.max), 5);
  const x = v => marginL + (v-nice.min)/(nice.max-nice.min) * (W-marginL-marginR);
  drawDistAxis(ctx, x, axisY, nice, unit, W, marginL, marginR);
  ctx.textAlign="left"; ctx.font="11px 'Source Sans 3', sans-serif"; ctx.fillStyle=col.ink; ctx.textBaseline="alphabetic";
  ctx.fillText(labelA, marginL, rowAY-26);
  ctx.fillText(labelB, marginL, rowBY-26);
  drawOneBoxplotRow(ctx, x, rowAY, 16, sA, col);
  drawOneBoxplotRow(ctx, x, rowBY, 16, sB, col);
}
function drawParallelDotplot(canvas, dataA, dataB, labelA, labelB, unit){
  const setup = setupDistCanvas(canvas); if (!setup) return;
  const {ctx,W,H} = setup; const col = distColors();
  ctx.clearRect(0,0,W,H);
  const marginL=34, marginR=18, axisY=H-34;
  const nice = niceTicks(Math.min(...dataA,...dataB), Math.max(...dataA,...dataB), 5);
  const x = v => marginL + (v-nice.min)/(nice.max-nice.min) * (W-marginL-marginR);
  drawDistAxis(ctx, x, axisY, nice, unit, W, marginL, marginR);
  const rowAY = 78, rowBY = axisY;
  ctx.textAlign="left"; ctx.font="11px 'Source Sans 3', sans-serif"; ctx.textBaseline="alphabetic";
  ctx.fillStyle = col.accent; ctx.fillText(labelA, marginL, 12);
  ctx.fillStyle = col.accent2; ctx.fillText(labelB, marginL, rowAY+14);
  ctx.strokeStyle = col.line; ctx.setLineDash([3,3]);
  ctx.beginPath(); ctx.moveTo(marginL, rowAY+8); ctx.lineTo(W-marginR, rowAY+8); ctx.stroke();
  ctx.setLineDash([]);
  stackDots(ctx, x, dataA, rowAY, nice, col.accent);
  stackDots(ctx, x, dataB, rowBY, nice, col.accent2);
}
function drawOneDistCanvas(canvas){
  const id = canvas.dataset.distId, kind = canvas.dataset.distKind;
  if (!window.DIST_DATA) return;
  const list = kind==="single" ? (window.DIST_DATA.single||[]) : (window.DIST_DATA.comparison||[]);
  const item = list.find(x=>x.id===id);
  if (!item) return;
  if (item.graphType==="dotplot") drawDotplot(canvas, item.data, item.unit);
  else if (item.graphType==="histogram") drawHistogram(canvas, item.data, item.unit, item.binWidth);
  else if (item.graphType==="boxplot") drawBoxplot(canvas, item.data, item.unit);
  else if (item.graphType==="parallel-boxplot") drawParallelBoxplot(canvas, item.dataA, item.dataB, item.contextA, item.contextB, item.unit);
  else if (item.graphType==="parallel-dotplot") drawParallelDotplot(canvas, item.dataA, item.dataB, item.contextA, item.contextB, item.unit);
}
function renderDistGraphics(root){
  root.querySelectorAll("canvas.dist-canvas").forEach(drawOneDistCanvas);
}
let distResizeTimer;
window.addEventListener("resize", ()=>{
  clearTimeout(distResizeTimer);
  distResizeTimer = setTimeout(()=>{
    document.querySelectorAll("canvas.dist-canvas").forEach(drawOneDistCanvas);
  }, 120);
});

function fiveNumHTML(fn, unit, label){
  return `<div class="dist-fivenum">
    ${label ? `<div class="dfn-label">${label.replace(/</g,"&lt;")}</div>` : ""}
    <div class="dfn-row"><span>Min</span><b>${fmtNum(fn.min)}</b></div>
    <div class="dfn-row"><span>Q1</span><b>${fmtNum(fn.q1)}</b></div>
    <div class="dfn-row"><span>Median</span><b>${fmtNum(fn.median)}</b></div>
    <div class="dfn-row"><span>Q3</span><b>${fmtNum(fn.q3)}</b></div>
    <div class="dfn-row"><span>Max</span><b>${fmtNum(fn.max)}</b></div>
    <div class="dfn-unit">(${unit.replace(/</g,"&lt;")})</div>
  </div>`;
}
function rawListHTML(data, unit){
  return `<div class="dist-list">${data.join(", ")} <span class="dist-list-unit">(${unit.replace(/</g,"&lt;")})</span></div>`;
}
function distGraphicHTML(item, kind){
  if (kind==="single"){
    if (item.graphType==="text") return fiveNumHTML(item.fiveNum, item.unit);
    if (item.graphType==="list") return rawListHTML(item.data, item.unit);
    return `<div class="dist-graphic"><canvas class="dist-canvas single" data-dist-id="${item.id}" data-dist-kind="single"></canvas></div>`;
  }
  if (item.graphType==="text"){
    return `<div class="dist-fivenum-pair">
      ${fiveNumHTML(item.fiveNumA, item.unit, item.contextA)}
      ${fiveNumHTML(item.fiveNumB, item.unit, item.contextB)}
    </div>`;
  }
  const heightClass = item.graphType==="parallel-dotplot" ? "parallel-dot" : "parallel-box";
  return `<div class="dist-graphic"><canvas class="dist-canvas ${heightClass}" data-dist-id="${item.id}" data-dist-kind="comparison"></canvas></div>`;
}
function distCardHTML(item, kind){
  const log = getLog();
  const key = `dist:${item.id}`;
  const saved = (log[key]||{})[0];
  const askLine = kind==="single"
    ? "Describe this distribution using shape, outliers, center, and variability (SOCV) — in context."
    : "Compare these distributions using shape, outliers, center, and variability (SOCV) — in context.";
  return `<div class="problem dist-card" data-lesson="${key}" data-idx="0">
    <div class="vc-meta">Lesson ${item.lesson}${kind==="comparison" ? " · Comparing distributions" : " · Describing a distribution"}</div>
    <div class="ic-title">${item.title.replace(/</g,"&lt;")}</div>
    <div class="p-prompt">${item.context.replace(/</g,"&lt;")}</div>
    ${distGraphicHTML(item, kind)}
    <div class="p-prompt" style="font-weight:600;margin-top:10px;">${askLine}</div>
    <textarea placeholder="Type your SOCV + context description here… (this isn't saved or checked automatically — it's just to make you commit to an answer before revealing the model one)" rows="4"></textarea>
    <button class="reveal-btn" type="button">Reveal model answer</button>
    <div class="answer-box" hidden>
      <div class="ans">${item.model.replace(/</g,"&lt;")}</div>
      ${item.note ? `<div class="sol">${item.note.replace(/</g,"&lt;")}</div>` : ""}
      <div class="self-check">
        <button class="got ${saved==='got'?'active':''}" type="button" data-val="got">✅ Got it</button>
        <button class="shaky ${saved==='shaky'?'active':''}" type="button" data-val="shaky">🤔 Still shaky</button>
      </div>
    </div>
  </div>`;
}
function buildDistSection(containerId, kind){
  const el = document.getElementById(containerId);
  if (!el) return; // this page has no Describing Distributions section
  const items = kind==="single" ? (window.DIST_DATA && window.DIST_DATA.single || []) : (window.DIST_DATA && window.DIST_DATA.comparison || []);
  if (!items.length) return;
  el.innerHTML = items.map(it=>distCardHTML(it, kind)).join("");
  attachCardHandlers(el);
  renderDistGraphics(el);
}
buildDistSection("distSingle", "single");
buildDistSection("distComparison", "comparison");

function jumpToLesson(lessonNum){
  if (!resultsEl || !qInput){
    // not on practice.html (e.g. clicked from Home's Coming Up panel, or a Calculator Help lesson chip) — hand off
    window.location.href = "practice.html?lesson=" + encodeURIComponent(lessonNum);
    return;
  }
  const lesson = LESSON_DATA.lessons.find(l=>l.lesson===lessonNum);
  if (!lesson) return;
  qInput.value = lesson.title;
  resultsEl.innerHTML = cardHTML(lesson, 999);
  attachCardHandlers(resultsEl);
  const card = resultsEl.querySelector(".card");
  card.classList.add("open");
  card.querySelector(".card-body").hidden = false;
  card.scrollIntoView({behavior:"smooth", block:"start"});
}

function escAttr(s){
  return String(s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function shuffleArr(arr){
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

// ---------- mixed review (cumulative practice for an upcoming quiz/test) ----------
function goMixedReview(eventTitle, lessonNums){
  if (!resultsEl || !qInput){
    // not on practice.html (e.g. clicked from Home's Coming Up panel) — hand off via URL params
    const params = new URLSearchParams({mixedTitle: eventTitle, mixedLessons: lessonNums.join(",")});
    window.location.href = "practice.html?" + params.toString();
    return;
  }
  renderMixedReview(eventTitle, lessonNums);
}
function renderMixedReview(eventTitle, lessonNums){
  const pool = [];
  lessonNums.forEach(lessonNum=>{
    const l = LESSON_DATA.lessons.find(x=>x.lesson===lessonNum);
    if (!l) return;
    l.problems.forEach((p,idx)=> pool.push({l, idx, p}));
  });
  const shuffled = shuffleArr(pool);
  qInput.value = "";
  resultsEl.innerHTML = `
    <div class="mixed-review">
      <div class="mr-header">
        <div>
          <div class="mr-title">Mixed review — ${escAttr(eventTitle)}</div>
          <div class="mr-sub">${lessonNums.length} lesson${lessonNums.length===1?"":"s"} · ${shuffled.length} problem${shuffled.length===1?"":"s"}, shuffled together</div>
        </div>
        <button class="mr-shuffle" type="button">🔀 Shuffle again</button>
      </div>
      <div class="mr-list">
        ${shuffled.map(entry=>problemHTML(entry.l, entry.idx, entry.p, {showLessonBadge:true})).join("")}
      </div>
    </div>`;
  attachCardHandlers(resultsEl);
  resultsEl.querySelector(".mr-shuffle").addEventListener("click", ()=> renderMixedReview(eventTitle, lessonNums));
  resultsEl.scrollIntoView({behavior:"smooth", block:"start"});
}

// ---------- FRQ practice (per-unit, cumulative, real 10-point rubric format) ----------
function renderFRQ(unitNum){
  const frq = (LESSON_DATA.frqs||[]).find(f=>f.unit===unitNum);
  if (!frq) return;
  qInput.value = "";
  resultsEl.innerHTML = `
    <div class="frq-card">
      <div class="frq-header">
        <div class="frq-title">🎯 ${frq.title}</div>
        <div class="frq-sub">Unit ${frq.unit} · ${frq.unitTitle} — practice free response, real AP scoring format</div>
        <div class="frq-points">${frq.points} points</div>
      </div>
      <div class="problem" data-lesson="${frq.unit}-FRQ" data-idx="0">
        <div class="p-prompt">${frq.prompt.replace(/</g,"&lt;")}</div>
        <button class="reveal-btn" type="button">Show scoring guidelines &amp; sample response</button>
        <div class="answer-box" hidden>
          <div class="ans">${frq.answerSummary.replace(/</g,"&lt;")}</div>
          <div class="frq-rubric">${frq.rubric.replace(/</g,"&lt;")}</div>
          <div class="frq-sample-label">Sample response earning full credit:</div>
          <div class="sol">${frq.sampleResponse.replace(/</g,"&lt;")}</div>
          <div class="self-check">
            <button class="got" type="button" data-val="got">✅ Got it</button>
            <button class="shaky" type="button" data-val="shaky">🤔 Still shaky</button>
          </div>
        </div>
      </div>
    </div>`;
  attachCardHandlers(resultsEl);
  resultsEl.scrollIntoView({behavior:"smooth", block:"start"});
}

function renderResults(matches, rawQuery){
  if (!resultsEl) return;
  if (!rawQuery.trim()){
    resultsEl.innerHTML = "";
    return;
  }
  if (!matches.length){
    resultsEl.innerHTML = `<div class="empty-state">No close match for “${rawQuery.replace(/</g,"&lt;")}.” Try a lesson number (like 6.3), or browse a unit below.</div>`;
    return;
  }
  resultsEl.innerHTML = matches.map(m=>cardHTML(m.l, m.s)).join("");
  attachCardHandlers(resultsEl);
  // auto-open the single best match if it's a clear winner
  if (matches.length===1 || matches[0].s - (matches[1]?.s||0) >= 60){
    const first = resultsEl.querySelector(".card");
    first.classList.add("open");
    first.querySelector(".card-body").hidden = false;
  }
}

let debounceTimer;
if (qInput) qInput.addEventListener("input", ()=>{
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(()=>{
    const val = qInput.value;
    renderResults(search(val), val);
  }, 150);
});
const hintRowEl = document.getElementById("hintRow");
if (hintRowEl) hintRowEl.addEventListener("click", (e)=>{
  const btn = e.target.closest("button[data-ex]");
  if (!btn) return;
  qInput.value = btn.dataset.ex;
  qInput.dispatchEvent(new Event("input"));
  qInput.focus();
});

// ---------- browse-by-unit ----------
function buildBrowse(){
  if (!browseEl) return; // this page has no Browse-every-unit section
  const units = {};
  LESSON_DATA.lessons.forEach(l=>{
    units[l.unit] = units[l.unit] || {title: l.unitTitle, lessons: []};
    units[l.unit].lessons.push(l);
  });
  const unitNums = Object.keys(units).map(Number).sort((a,b)=>a-b);
  browseEl.innerHTML = unitNums.map(u=>{
    const grp = units[u];
    const items = grp.lessons.map(l=>`
      <button class="mini" type="button" data-lesson="${l.lesson}">
        <span class="lesson-num">${l.lesson}</span>
        <span>${l.title}</span>
      </button>`).join("");
    const hasFRQ = (LESSON_DATA.frqs||[]).some(f=>f.unit===u);
    const frqBtn = hasFRQ
      ? `<button class="unit-frq-btn" type="button" data-frq-unit="${u}">🎯 Unit ${u} FRQ practice (10 pts, real AP rubric)</button>`
      : "";
    return `<details class="unit-group">
      <summary><span class="u-chev">▸</span> Unit ${u}: ${grp.title}</summary>
      <div class="unit-list">${items}${frqBtn}</div>
    </details>`;
  }).join("");

  browseEl.querySelectorAll("button.mini").forEach(btn=>{
    btn.addEventListener("click", ()=> jumpToLesson(btn.dataset.lesson));
  });
  browseEl.querySelectorAll(".unit-frq-btn").forEach(btn=>{
    btn.addEventListener("click", ()=> renderFRQ(Number(btn.dataset.frqUnit)));
  });
}
buildBrowse();

// ---------- coming up (calendar tie-in) ----------
function parseAssessmentLessons(title){
  const rangeMatch = title.match(/(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)/);
  if (rangeMatch){
    const lo = parseFloat(rangeMatch[1]), hi = parseFloat(rangeMatch[2]);
    return LESSON_DATA.lessons.filter(l=>{ const v=parseFloat(l.lesson); return v>=lo && v<=hi; }).map(l=>l.lesson);
  }
  const unitMatch = title.match(/unit\s+(\d+)/i);
  if (unitMatch){
    const u = unitMatch[1];
    return LESSON_DATA.lessons.filter(l=>String(l.unit)===u).map(l=>l.lesson);
  }
  const singleMatch = title.match(/(\d+\.\d+)/);
  if (singleMatch && LESSON_DATA.lessons.some(l=>l.lesson===singleMatch[1])) return [singleMatch[1]];
  return [];
}
function fmtEventDate(iso){
  const d = new Date(iso+"T00:00:00");
  return d.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"});
}
function daysUntilLabel(iso){
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(iso+"T00:00:00");
  const days = Math.round((d-today)/86400000);
  if (days===0) return "Today";
  if (days===1) return "Tomorrow";
  return `in ${days} days`;
}
function renderComingUp(){
  const cuEl = document.getElementById("comingUp");
  const listEl = document.getElementById("cuList");
  const staleEl = document.getElementById("cuStale");
  if (!cuEl || !listEl || !staleEl) return; // this page has no Coming Up panel (only Home does)
  const today = new Date(); today.setHours(0,0,0,0);
  const upcoming = (CALENDAR_EVENTS||[])
    .filter(e=> new Date(e.date+"T00:00:00") >= today)
    .sort((a,b)=> a.date.localeCompare(b.date))
    .slice(0,5);
  if (!upcoming.length){ cuEl.hidden = true; return; }
  cuEl.hidden = false;
  const updatedDate = new Date(CALENDAR_UPDATED+"T00:00:00");
  const staleDays = Math.round((today-updatedDate)/86400000);
  staleEl.textContent = staleDays>13
    ? `Pulled from the AP Stat 26-27 calendar on ${CALENDAR_UPDATED} — ask Mr. Ian to refresh if dates look off.`
    : `From the AP Stat 26-27 calendar, updated ${CALENDAR_UPDATED}.`;
  listEl.innerHTML = upcoming.map(e=>{
    const lessons = parseAssessmentLessons(e.title);
    const btns = lessons.length
      ? lessons.map(n=>`<button type="button" class="cu-jump" data-lesson="${n}">${n}</button>`).join("")
      : `<em>(couldn't match lesson numbers in this title — add them like "1.4-1.8" so this links up)</em>`;
    const mixedBtn = lessons.length
      ? `<button type="button" class="cu-mixed" data-lessons="${lessons.join(",")}" data-title="${escAttr(e.title)}">🔀 Mixed review — ${lessons.length} lesson${lessons.length===1?"":"s"}</button>`
      : "";
    return `<div class="cu-item">
      <div class="cu-row">
        <span class="cu-date">${fmtEventDate(e.date)}</span>
        <span class="cu-name">${e.title.replace(/</g,"&lt;")}</span>
        <span class="cu-days">${daysUntilLabel(e.date)}</span>
      </div>
      <div class="cu-review">Review: ${btns}</div>
      ${mixedBtn}
    </div>`;
  }).join("");
  listEl.querySelectorAll(".cu-jump").forEach(btn=>{
    btn.addEventListener("click", ()=> jumpToLesson(btn.dataset.lesson));
  });
  listEl.querySelectorAll(".cu-mixed").forEach(btn=>{
    btn.addEventListener("click", ()=> goMixedReview(btn.dataset.title, btn.dataset.lessons.split(",").filter(Boolean)));
  });
}
renderComingUp();

const expandAllBtn = document.getElementById("expandAll");
if (expandAllBtn) expandAllBtn.addEventListener("click", (e)=>{
  const details = browseEl.querySelectorAll("details");
  const anyClosed = Array.from(details).some(d=>!d.open);
  details.forEach(d=> d.open = anyClosed);
  e.target.textContent = anyClosed ? "Collapse all" : "Expand all";
});

const calcJumpBtn = document.getElementById("calcJumpBtn");
if (calcJumpBtn) calcJumpBtn.addEventListener("click", ()=>{
  const calcSectionEl = document.getElementById("calcSection");
  if (calcSectionEl) calcSectionEl.scrollIntoView({behavior:"smooth", block:"start"});
  else window.location.href = "calculator.html";
});

const calcExpandAllBtn = document.getElementById("calcExpandAll");
if (calcExpandAllBtn) calcExpandAllBtn.addEventListener("click", (e)=>{
  const cards = document.getElementById("calcBrowse").querySelectorAll(".card");
  const anyClosed = Array.from(cards).some(c=>!c.classList.contains("open"));
  cards.forEach(c=>{
    c.classList.toggle("open", anyClosed);
    c.querySelector(".card-body").hidden = !anyClosed;
  });
  e.target.textContent = anyClosed ? "Collapse all" : "Expand all";
});

// ---------- copy practice log ----------
const copyLogBtn = document.getElementById("copyLog");
if (copyLogBtn) copyLogBtn.addEventListener("click", ()=>{
  const log = getLog();
  const lessonKeys = Object.keys(log).filter(k=>Object.values(log[k]).some(v=>v));
  if (!lessonKeys.length){
    toast("No practice logged yet — mark ✅ or 🤔 on a problem first.");
    return;
  }
  lessonKeys.sort((a,b)=>parseFloat(a)-parseFloat(b));
  const lines = ["Stat Index practice log — " + new Date().toLocaleDateString(), ""];
  lessonKeys.forEach(k=>{
    const l = LESSON_DATA.lessons.find(x=>x.lesson===k);
    const entries = log[k];
    const marks = Object.keys(entries).filter(i=>entries[i]).map(i=>entries[i]==='got' ? '✅' : '🤔').join(" ");
    lines.push(`Lesson ${k} (${l ? l.title : ''}): ${marks}`);
  });
  const text = lines.join("\n");
  const finish = ()=> toast("Copied! Paste it into a message to Mr. Ian.");
  if (navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(finish).catch(()=>{
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); finish();
    });
  } else {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove(); finish();
  }
});

// ---------- cross-page entry points (Home's Coming Up panel / Calculator Help lesson chips hand off here) ----------
// Runs only on practice.html (the only page with #results) — reads ?lesson= or ?mixedLessons=&mixedTitle=
// so a click on Home or Calculator Help lands directly on the right lesson/mixed-review instead of a blank search page.
(function(){
  if (!resultsEl || !qInput) return;
  const params = new URLSearchParams(window.location.search);
  const mixedLessons = params.get("mixedLessons");
  const lessonParam = params.get("lesson");
  if (mixedLessons){
    const nums = mixedLessons.split(",").filter(Boolean);
    if (nums.length) renderMixedReview(params.get("mixedTitle") || "Mixed review", nums);
  } else if (lessonParam){
    jumpToLesson(lessonParam);
  }
})();

// ---------- "Ask Mr. Ian" chat launcher (every page) ----------
// Reuses the existing Stat Index Practice Check-ins Google Form/Sheet — no new backend needed.
// A question is submitted with Lesson="💬 Question" (a marker that can't collide with a real
// lesson number, so it's easy to spot/filter in the raw "Form Responses 1" tab). The Result field
// carries "Asked from: <page> | Suggested: <lesson(s)>" so a Google Apps Script trigger on that
// Sheet (onFormSubmit) can email Mr. Ian the question + the same lesson suggestion — see the
// separate Apps Script setup, not part of this file. Doesn't touch the Summary tab's COUNTIFS math.
//
// IMPORTANT (by design): this widget never answers the question itself. It only analyzes the
// text against LESSON_DATA (the same matching engine as the Practice Problems search box) and
// points the student to a lesson number + textbook pages to check — the email to Mr. Ian carries
// the same pointer so he can see at a glance what was suggested.
(function(){
  const SUGGEST_THRESHOLD = 10; // minimum search() score to surface a lesson suggestion (calibrated
  // against real question phrasing — a single solid keyword-in-title hit scores ~6-14; below 10
  // tends to be noise or a wrong guess, so silence (no suggestion) is safer than a bad pointer)

  function suggestLessons(question){
    if (!(LESSON_DATA && LESSON_DATA.lessons)) return []; // e.g. links.html doesn't load data.js
    try{
      return search(question).filter(m=>m.s >= SUGGEST_THRESHOLD).slice(0,2).map(m=>m.l);
    }catch(e){ return []; }
  }

  function suggestionRowHTML(l){
    const pageLine = l.pages
      ? `Textbook: TPS8e p. ${l.pages}${l.section ? " (Section " + l.section + ")" : ""} — read it on BFW Achieve`
      : "Textbook: not mapped for this lesson yet";
    return `<div class="ask-suggest-item">
      <div class="asi-lesson">Lesson ${l.lesson} — ${l.title.replace(/</g,"&lt;")}</div>
      <div class="asi-pages">${pageLine}</div>
      <div class="asi-actions">
        <button type="button" class="asi-go" data-lesson="${l.lesson}">Open Lesson ${l.lesson} on this site →</button>
      </div>
    </div>`;
  }

  const fab = document.createElement("button");
  fab.className = "ask-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Ask Mr. Ian a question");
  fab.textContent = "💬";

  const panel = document.createElement("div");
  panel.className = "ask-panel";
  panel.hidden = true;
  let savedName = "";
  try { savedName = localStorage.getItem("statIndexStudentName") || ""; } catch(e){}
  panel.innerHTML = `
    <div class="ask-panel-head">
      <div>
        <div class="aph-title">Ask Mr. Ian a question</div>
        <div class="aph-sub">Emails Mr. Ian directly. He'll follow up — and right away you'll get pointed to a lesson and textbook pages to check first (not the answer itself).</div>
      </div>
      <button type="button" class="ask-panel-close" aria-label="Close">✕</button>
    </div>
    <div class="ask-panel-body">
      <label for="askName">Your name (optional)</label>
      <input type="text" id="askName" maxlength="60" placeholder="First and last name" value="${escAttr(savedName)}">
      <label for="askText">Your question</label>
      <textarea id="askText" maxlength="800" placeholder="e.g. “Can you go over conditions for a chi-square test again?”"></textarea>
      <button type="button" class="ask-send">Send question</button>
      <div class="ask-status" id="askStatus">Sent to Mr. Ian — he'll follow up.</div>
      <div class="ask-suggest" id="askSuggest" hidden></div>
      <div class="ask-panel-note">Not for anything urgent — for anything time-sensitive, talk to Mr. Ian in class.</div>
    </div>`;

  function mount(){
    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount(); // script tag is at end of body, so this is the common case
  }

  function resetResponse(){
    const statusEl = panel.querySelector("#askStatus");
    const suggestEl = panel.querySelector("#askSuggest");
    statusEl.classList.remove("show");
    suggestEl.hidden = true;
    suggestEl.innerHTML = "";
  }
  function openPanel(){
    panel.hidden = false;
    fab.classList.add("is-open");
    fab.textContent = "✕";
    setTimeout(()=> panel.querySelector("#askText").focus(), 30);
  }
  function closePanel(){
    panel.hidden = true;
    fab.classList.remove("is-open");
    fab.textContent = "💬";
  }
  fab.addEventListener("click", ()=> panel.hidden ? openPanel() : closePanel());
  panel.querySelector(".ask-panel-close").addEventListener("click", closePanel);

  panel.querySelector(".ask-send").addEventListener("click", ()=>{
    const nameEl = panel.querySelector("#askName");
    const textEl = panel.querySelector("#askText");
    const statusEl = panel.querySelector("#askStatus");
    const suggestEl = panel.querySelector("#askSuggest");
    const sendBtn = panel.querySelector(".ask-send");
    const question = textEl.value.trim();
    if (!question){ textEl.focus(); return; }
    const name = nameEl.value.trim().slice(0,60) || "Anonymous";
    try { localStorage.setItem("statIndexStudentName", nameEl.value.trim().slice(0,60)); } catch(e){}
    resetResponse();
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";

    const matches = suggestLessons(question);
    const page = window.location.pathname.split("/").pop() || "index.html";
    const suggestionSummary = matches.length
      ? matches.map(l=>`Lesson ${l.lesson} (${l.title})`).join("; ")
      : "No confident lesson match — needs your review";

    try{
      const body = new URLSearchParams();
      body.append(FORM_FIELDS.name, name);
      body.append(FORM_FIELDS.lesson, "💬 Question");
      body.append(FORM_FIELDS.problem, question.slice(0,800));
      body.append(FORM_FIELDS.result, "Asked from: " + page + " | Suggested: " + suggestionSummary);
      fetch(FORM_ACTION_URL, {method:"POST", mode:"no-cors", body}).catch(()=>{});
    }catch(e){}

    sendBtn.textContent = "Send question";
    sendBtn.disabled = false;
    textEl.value = "";
    statusEl.classList.add("show");

    if (matches.length){
      suggestEl.innerHTML = `<div class="as-lead">While you wait, this looks related to:</div>`
        + matches.map(suggestionRowHTML).join("");
    } else {
      suggestEl.innerHTML = `<div class="as-lead">While you wait, try browsing by unit or searching a keyword on Practice Problems.</div>
        <button type="button" class="asi-go" data-goto-practice="1">Go to Practice Problems →</button>`;
    }
    suggestEl.hidden = false;
    suggestEl.querySelectorAll(".asi-go").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        if (btn.dataset.gotoPractice){ window.location.href = "practice.html"; return; }
        jumpToLesson(btn.dataset.lesson);
      });
    });
    // No auto-close: the suggestion has something to read/click, so let the student close it themselves.
  });
})();

// ---------- hero background animations (Villanova navy / light-blue, per page) ----------
// Every page's header.top carries data-anim="julia|bells|symbols|band|histogram" plus either
// a <canvas class="bg-anim"> or a <div class="symbol-layer">. This one guarded block reads
// that attribute and mounts the matching renderer — nothing runs on a page without the markup,
// and prefers-reduced-motion always gets a single static frame instead of a loop.
(function(){
  const header = document.querySelector("header.top");
  if (!header) return;
  const kind = header.dataset.anim;
  if (!kind) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const NAVY = [0,38,100], LBLUE = [65,182,230];

  function setupCanvas(canvas){
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let W = 0, H = 0;
    function sizeToDisplay(){
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (w === W && h === H) return true;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    return { ctx, sizeToDisplay, get W(){return W/dpr;}, get H(){return H/dpr;}, dpr };
  }

  // ---- Home: Julia set fractal (toned down for legibility; scrim handles the rest) ----
  function initJulia(canvas){
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const ctx = canvas.getContext("2d");
    let W = 0, H = 0;
    function sizeRaw(){
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return false;
      const w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (w === W && h === H) return true;
      W = w; H = h;
      canvas.width = W; canvas.height = H;
      return true;
    }
    const RADIUS = 0.7885, ANCHOR = 2.36, DRIFT = 0.10, MAX_ITER = 90;
    function draw(t){
      if (!sizeRaw()) return;
      const img = ctx.createImageData(W, H);
      const angle = ANCHOR + DRIFT * Math.sin(t);
      const cRe = RADIUS * Math.cos(angle);
      const cIm = RADIUS * Math.sin(angle);
      const zoom = W * 0.34;
      for (let y=0;y<H;y++){
        for (let x=0;x<W;x++){
          let zx = (x - W/2) / zoom;
          let zy = (y - H/2) / zoom;
          let iter = 0, mag2 = 0;
          while ((mag2 = zx*zx + zy*zy) < 4 && iter < MAX_ITER){
            const xt = zx*zx - zy*zy + cRe;
            zy = 2*zx*zy + cIm;
            zx = xt;
            iter++;
          }
          const idx = (y*W+x)*4;
          if (iter === MAX_ITER){
            img.data[idx]=NAVY[0]; img.data[idx+1]=NAVY[1]; img.data[idx+2]=NAVY[2]; img.data[idx+3]=55;
          } else {
            const smooth = iter + 1 - Math.log(Math.log(Math.sqrt(mag2))) / Math.log(2);
            const f = Math.max(0, Math.min(1, smooth / MAX_ITER));
            const shaped = Math.pow(f, 1.5);
            img.data[idx]   = NAVY[0] + shaped*(LBLUE[0]-NAVY[0]);
            img.data[idx+1] = NAVY[1] + shaped*(LBLUE[1]-NAVY[1]);
            img.data[idx+2] = NAVY[2] + shaped*(LBLUE[2]-NAVY[2]);
            img.data[idx+3] = Math.round(shaped*175);
          }
        }
      }
      ctx.putImageData(img, 0, 0);
    }
    let t = 0.9;
    draw(t);
    if (!reduceMotion) setInterval(()=>{ t += 0.006; draw(t); }, 90);
    window.addEventListener("resize", ()=> draw(t));
  }

  // ---- Practice Problems: two breathing bell curves ----
  function initBells(canvas){
    const c = setupCanvas(canvas);
    function bellY(x, mu, sigma, W, H, baseline, amp){
      const z = (x/W - mu) / sigma;
      return baseline - amp * Math.exp(-0.5*z*z);
    }
    function draw(t){
      if (!c.sizeToDisplay()) return;
      const W = c.W, H = c.H;
      c.ctx.clearRect(0,0,W,H);
      const baseline = H*0.82, amp = H*0.55;
      const mu1 = 0.42 + 0.05*Math.sin(t*0.5), sigma1 = 0.13 + 0.02*Math.sin(t*0.7+1);
      const mu2 = 0.68 + 0.04*Math.sin(t*0.4+2), sigma2 = 0.16 + 0.02*Math.sin(t*0.6+0.5);
      [[mu1,sigma1,NAVY],[mu2,sigma2,LBLUE]].forEach(([mu,sigma,col])=>{
        c.ctx.beginPath();
        for (let px=0; px<=W; px+=2){
          const y = bellY(px, mu, sigma, W, H, baseline, amp);
          if (px===0) c.ctx.moveTo(px,y); else c.ctx.lineTo(px,y);
        }
        c.ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},0.32)`;
        c.ctx.lineWidth = 2;
        c.ctx.stroke();
      });
    }
    let t = 0;
    draw(t);
    if (!reduceMotion){
      function loop(){ t += 0.015; draw(t); requestAnimationFrame(loop); }
      requestAnimationFrame(loop);
    }
    window.addEventListener("resize", ()=> draw(t));
  }

  // ---- Calculator Help: floating stats symbols (also reused, with a different glyph set, for Vocabulary) ----
  function initSymbols(layer, symbolSet){
    const SYMS = symbolSet || ["Σ","μ","σ","x̄","p̂","z","χ²","r²","π","∞"];
    const n = 10;
    const items = [];
    for (let i=0;i<n;i++){
      const el = document.createElement("span");
      el.className = "float-sym";
      el.textContent = SYMS[i % SYMS.length];
      const col = i%2===0 ? NAVY : LBLUE;
      const alpha = 0.35 + (i%4)*0.06;
      el.style.color = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
      el.style.fontSize = (1.1 + (i%3)*0.6) + "rem";
      layer.appendChild(el);
      items.push({
        el,
        x: Math.random(), y: Math.random(),
        vx: (Math.random()-0.5)*0.01, vy: (Math.random()-0.5)*0.01,
        phase: Math.random()*Math.PI*2,
      });
    }
    function draw(t){
      const W = layer.clientWidth, H = layer.clientHeight;
      if (!W || !H) return;
      items.forEach(it=>{
        it.x += it.vx * 0.02; it.y += it.vy * 0.02;
        if (it.x < -0.05) it.x = 1.05; if (it.x > 1.05) it.x = -0.05;
        if (it.y < -0.05) it.y = 1.05; if (it.y > 1.05) it.y = -0.05;
        const bob = Math.sin(t*0.6 + it.phase) * 6;
        it.el.style.transform = `translate(${it.x*W}px, ${it.y*H + bob}px)`;
      });
    }
    let t = 0;
    draw(t);
    if (!reduceMotion){
      function loop(){ t += 0.02; draw(t); requestAnimationFrame(loop); }
      requestAnimationFrame(loop);
    }
    window.addEventListener("resize", ()=> draw(t));
  }

  // ---- Interpretation Practice: breathing confidence-interval band ----
  function initBand(canvas){
    const c = setupCanvas(canvas);
    function draw(t){
      if (!c.sizeToDisplay()) return;
      const W = c.W, H = c.H;
      c.ctx.clearRect(0,0,W,H);
      const baseline = H*0.82, amp = H*0.55;
      const mu = 0.5 + 0.04*Math.sin(t*0.35);
      const sigma = 0.16;
      const halfWidth = 0.14 + 0.05*Math.sin(t*0.5);
      function yAt(x){ const z = (x/W - mu)/sigma; return baseline - amp*Math.exp(-0.5*z*z); }
      // shaded CI band under the curve
      c.ctx.beginPath();
      const loX = (mu-halfWidth)*W, hiX = (mu+halfWidth)*W;
      c.ctx.moveTo(loX, baseline);
      for (let px=loX; px<=hiX; px+=2) c.ctx.lineTo(px, yAt(px));
      c.ctx.lineTo(hiX, baseline);
      c.ctx.closePath();
      c.ctx.fillStyle = `rgba(${LBLUE[0]},${LBLUE[1]},${LBLUE[2]},0.28)`;
      c.ctx.fill();
      // dashed navy boundary lines
      c.ctx.setLineDash([5,4]);
      c.ctx.strokeStyle = `rgba(${NAVY[0]},${NAVY[1]},${NAVY[2]},0.4)`;
      c.ctx.lineWidth = 1.5;
      [loX, hiX].forEach(x=>{
        c.ctx.beginPath(); c.ctx.moveTo(x, baseline); c.ctx.lineTo(x, yAt(x)); c.ctx.stroke();
      });
      c.ctx.setLineDash([]);
      // solid navy curve
      c.ctx.beginPath();
      for (let px=0; px<=W; px+=2){ const y = yAt(px); if (px===0) c.ctx.moveTo(px,y); else c.ctx.lineTo(px,y); }
      c.ctx.strokeStyle = `rgba(${NAVY[0]},${NAVY[1]},${NAVY[2]},0.34)`;
      c.ctx.lineWidth = 2;
      c.ctx.stroke();
      // light-blue center dot
      c.ctx.beginPath();
      c.ctx.arc(mu*W, baseline, 3.5, 0, Math.PI*2);
      c.ctx.fillStyle = `rgba(${LBLUE[0]},${LBLUE[1]},${LBLUE[2]},0.55)`;
      c.ctx.fill();
    }
    let t = 0;
    draw(t);
    if (!reduceMotion){
      function loop(){ t += 0.015; draw(t); requestAnimationFrame(loop); }
      requestAnimationFrame(loop);
    }
    window.addEventListener("resize", ()=> draw(t));
  }

  // ---- Helpful Links: live histogram ----
  function initHistogram(canvas){
    const c = setupCanvas(canvas);
    const N = 16;
    const bars = [];
    for (let i=0;i<N;i++) bars.push({ h: 0.2 + Math.random()*0.3, target: 0.2 + Math.random()*0.3 });
    let lastPick = 0;
    function draw(now){
      if (!c.sizeToDisplay()) return;
      const W = c.W, H = c.H;
      c.ctx.clearRect(0,0,W,H);
      if (!reduceMotion && now - lastPick > 500){
        lastPick = now;
        const i = Math.floor(Math.random()*N);
        bars[i].target = 0.15 + Math.random()*0.65;
      }
      const gap = W*0.012;
      const bw = (W - gap*(N-1)) / N;
      bars.forEach((b,i)=>{
        b.h += (b.target - b.h) * 0.06;
        const bh = b.h * H * 0.72;
        const x = i*(bw+gap);
        const col = i%2===0 ? NAVY : LBLUE;
        c.ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},0.30)`;
        c.ctx.fillRect(x, H*0.82 - bh, bw, bh);
      });
    }
    draw(0);
    if (!reduceMotion){
      function loop(now){ draw(now); requestAnimationFrame(loop); }
      requestAnimationFrame(loop);
    }
    window.addEventListener("resize", ()=> draw(performance.now()));
  }

  if (kind === "julia"){
    const canvas = header.querySelector("canvas.bg-anim");
    if (canvas) initJulia(canvas);
  } else if (kind === "bells"){
    const canvas = header.querySelector("canvas.bg-anim");
    if (canvas) initBells(canvas);
  } else if (kind === "symbols"){
    const layer = header.querySelector(".symbol-layer");
    if (layer) initSymbols(layer);
  } else if (kind === "glossary"){
    const layer = header.querySelector(".symbol-layer");
    if (layer) initSymbols(layer, ["“ ”","A→Z","def.","✓","?","¶","≈","…","§","✎"]);
  } else if (kind === "band"){
    const canvas = header.querySelector("canvas.bg-anim");
    if (canvas) initBand(canvas);
  } else if (kind === "histogram"){
    const canvas = header.querySelector("canvas.bg-anim");
    if (canvas) initHistogram(canvas);
  }
})();

// ---------- nav bar: mark the current page ----------
(function(){
  const here = (window.location.pathname.split("/").pop() || "index.html");
  document.querySelectorAll(".sitenav a[data-nav]").forEach(a=>{
    if (a.getAttribute("href") === here) a.classList.add("active");
  });
})();
