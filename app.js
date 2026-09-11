
const LESSON_DATA = window.LESSON_DATA;
const MM_PORTAL = "https://portal.mathmedic.com/lesson-plans/course/AP-Statistics";

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
// for the nav-highlighter + Ask Mr. Fox widget only, without loading data.js's ~800KB dataset)
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
      <div class="mm-link">Read the Math Medic lesson notes instead: <a href="${MM_PORTAL}" target="_blank" rel="noopener">Lesson ${l.lesson} on the Math Medic portal ↗</a></div>
    </div>`;
  }
  return `<div class="reading-box">
    <div class="pages">TPS8e p. ${l.pages}</div>
    <div class="section-name">Section ${l.section}${l.book ? " · "+l.book : ""}</div>
    ${l.note ? `<div class="note">${l.note.replace(/</g,"&lt;")}</div>` : ""}
    <div class="mm-link">Or review the activity itself: <a href="${MM_PORTAL}" target="_blank" rel="noopener">Lesson ${l.lesson} on the Math Medic portal ↗</a></div>
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
  el.innerHTML = items.map(interpCardHTML).join("");
  attachCardHandlers(el);
}
buildInterpBrowse();

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
    ? `Pulled from the AP Stat 26-27 calendar on ${CALENDAR_UPDATED} — ask Mr. Fox to refresh if dates look off.`
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
  const finish = ()=> toast("Copied! Paste it into a message to Mr. Fox.");
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

// ---------- "Ask Mr. Fox" chat launcher (every page) ----------
// Reuses the existing Stat Index Practice Check-ins Google Form/Sheet — no new backend needed.
// A question is submitted with Lesson="💬 Question" (a marker that can't collide with a real
// lesson number, so it's easy to spot/filter in the raw "Form Responses 1" tab) and Result set
// to the page it was asked from. It doesn't touch the Summary tab's per-lesson COUNTIFS math.
(function(){
  const fab = document.createElement("button");
  fab.className = "ask-fab";
  fab.type = "button";
  fab.setAttribute("aria-label", "Ask Mr. Fox a question");
  fab.textContent = "💬";

  const panel = document.createElement("div");
  panel.className = "ask-panel";
  panel.hidden = true;
  let savedName = "";
  try { savedName = localStorage.getItem("statIndexStudentName") || ""; } catch(e){}
  panel.innerHTML = `
    <div class="ask-panel-head">
      <div>
        <div class="aph-title">Ask Mr. Fox a question</div>
        <div class="aph-sub">Goes straight to him — he'll follow up in class or by email.</div>
      </div>
      <button type="button" class="ask-panel-close" aria-label="Close">✕</button>
    </div>
    <div class="ask-panel-body">
      <label for="askName">Your name (optional)</label>
      <input type="text" id="askName" maxlength="60" placeholder="First and last name" value="${escAttr(savedName)}">
      <label for="askText">Your question</label>
      <textarea id="askText" maxlength="800" placeholder="e.g. “Can you go over conditions for a chi-square test again?”"></textarea>
      <button type="button" class="ask-send">Send question</button>
      <div class="ask-status" id="askStatus">Sent! Thanks — Mr. Fox will follow up.</div>
      <div class="ask-panel-note">Not for anything urgent — for anything time-sensitive, talk to Mr. Fox in class.</div>
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
    const sendBtn = panel.querySelector(".ask-send");
    const question = textEl.value.trim();
    if (!question){ textEl.focus(); return; }
    const name = nameEl.value.trim().slice(0,60) || "Anonymous";
    try { localStorage.setItem("statIndexStudentName", nameEl.value.trim().slice(0,60)); } catch(e){}
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    try{
      const body = new URLSearchParams();
      body.append(FORM_FIELDS.name, name);
      body.append(FORM_FIELDS.lesson, "💬 Question");
      body.append(FORM_FIELDS.problem, question.slice(0,800));
      body.append(FORM_FIELDS.result, "Asked from: " + (window.location.pathname.split("/").pop() || "index.html"));
      fetch(FORM_ACTION_URL, {method:"POST", mode:"no-cors", body}).catch(()=>{});
    }catch(e){}
    statusEl.classList.add("show");
    sendBtn.textContent = "Send question";
    sendBtn.disabled = false;
    textEl.value = "";
    setTimeout(()=>{ statusEl.classList.remove("show"); closePanel(); }, 2200);
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

  // ---- Calculator Help: floating stats symbols ----
  function initSymbols(layer){
    const SYMS = ["Σ","μ","σ","x̄","p̂","z","χ²","r²","π","∞"];
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
