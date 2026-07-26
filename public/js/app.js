/* 天天學字 — 路由 + 畫面
   每個選單都是獨立網址:
   /            首頁(今日任務)
   /units       識字單元列表
   /unit/3      單元 3 的關卡列表
   /unit/3/listen  單元 3 的聽力關
   /bpmf        注音總表
   /bpmf/ㄅ     注音學習卡
   /games       注音闖關
   /games/2     注音第 2 關
   /write       手寫選字
   /write/媽    手寫「媽」
   /rewards     我的獎勵(月曆、徽章)
   /settings    學號與還原
*/
const app = document.getElementById("app");
const A = {}; // 全域事件處理器,給 inline onclick 用

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

function nav(path) {
  stopSpeak();
  history.pushState(null, "", path);
  render();
}
A.nav = nav;
window.addEventListener("popstate", () => { stopSpeak(); render(); });

function topbar(backPath, helpText) {
  return `<div class="topbar">
    ${backPath !== null ? `<button class="btn-back" onclick="A.nav('${backPath}')">⬅️</button>` : `<span style="min-width:80px"></span>`}
    <span class="star-count">⭐ ${store.data.stars}</span>
    <button class="btn-help" onclick="speak('${esc(helpText)}', 0.85)">🔊</button>
  </div>`;
}

/* ================= 首頁 ================= */
function nextTask() {
  for (const u of UNITS) {
    if (!store.unitUnlocked(u.id)) break;
    for (const l of LESSONS) {
      if ((store.unit(u.id)[l.key] || 0) < 1) return { unit: u, lesson: l };
    }
  }
  return null;
}

function viewHome() {
  const task = nextTask();
  const streak = store.streakNow();
  const known = store.knownChars();
  const stamped = store.data.days[todayStr()];
  app.innerHTML = `<div class="screen">
    ${topbar(null, "歡迎來到天天學字!點中間橘色的大卡片,開始今天的學習。下面還有識字單元、注音符號、寫字練習、和你的獎勵。")}
    <div class="home-title">天天學字</div>
    <div class="home-sub">每天學一點,越學越棒!</div>
    <div class="hero-card" onclick="${task ? `A.nav('/unit/${task.unit.id}/${task.lesson.key}')` : `A.nav('/rewards')`}">
      <div class="hero-line1">${stamped ? "✅ 今天已經學過了,再玩一次也可以!" : "☀️ 今天的任務"}</div>
      <div class="hero-line2">${task ? `${task.unit.emoji} ${task.unit.title}・${task.lesson.emoji} ${task.lesson.title}` : "🎉 全部完成了,你太厲害了!"}</div>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">🔥${streak}</div><div class="lbl">連續天數</div></div>
      <div class="stat-box"><div class="num">${known}</div><div class="lbl">認識的字</div></div>
      <div class="stat-box"><div class="num">⭐${store.data.stars}</div><div class="lbl">星星</div></div>
    </div>
    <div class="menu">
      <div class="menu-card c1" onclick="A.nav('/units')"><span class="emoji">📚</span><span class="label">識字單元</span><span class="hint">主課程</span></div>
      <div class="menu-card c2" onclick="A.nav('/bpmf')"><span class="emoji">🅱️</span><span class="label">注音符號</span><span class="hint">ㄅㄆㄇ</span></div>
      <div class="menu-card c3" onclick="A.nav('/games')"><span class="emoji">🎧</span><span class="label">注音闖關</span><span class="hint">聽聲音</span></div>
      <div class="menu-card c4" onclick="A.nav('/write')"><span class="emoji">✍️</span><span class="label">寫字練習</span><span class="hint">動動手</span></div>
      <div class="menu-card c5" onclick="A.nav('/rewards')"><span class="emoji">🏅</span><span class="label">我的獎勵</span><span class="hint">月曆徽章</span></div>
    </div>
    <div class="sync-note" style="margin-top:18px" onclick="A.nav('/settings')">🔑 我的學號:<b>${store.data.code}</b>(點我看說明)</div>
  </div>`;
}

/* ================= 識字單元列表 ================= */
function viewUnits() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是識字課程,從第一單元開始,一個一個過關。完成一個單元,才會打開下一個單元。")}
    <div class="section-title">📚 識字單元</div>
    <div class="unit-list">
      ${UNITS.map(u => {
        const unlocked = store.unitUnlocked(u.id);
        const done = store.unitDone(u.id);
        const doneCount = LESSONS.filter(l => (store.unit(u.id)[l.key] || 0) >= 1).length;
        return `<div class="unit-card ${unlocked ? "" : "locked"}" onclick="${unlocked ? `A.nav('/unit/${u.id}')` : `A.lockedMsg()`}">
          <span class="u-emoji">${unlocked ? u.emoji : "🔒"}</span>
          <span class="u-mid">
            <div class="u-title">第${u.id}單元 ${u.title}</div>
            <div class="u-progress">${unlocked ? `完成 ${doneCount}/5 關` : "先完成上一個單元"}</div>
          </span>
          <span class="unit-done-mark">${done ? "🏆" : ""}</span>
        </div>`;
      }).join("")}
    </div>
  </div>`;
}
A.lockedMsg = () => speak("這個單元還沒打開喔!先把上一個單元的五關都完成,就可以玩了。");

/* ================= 單元關卡列表 ================= */
function viewUnit(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return nav("/units");
  const p = store.unit(id);
  app.innerHTML = `<div class="screen">
    ${topbar("/units", "這個單元有五關:先學一學認識新字,再玩聽聲音、看圖選字、句子填空,最後寫一寫。每一關都可以拿星星!下面還有好用的生活句,點了就唸給你聽。")}
    <div class="section-title">${u.emoji} 第${u.id}單元 ${u.title}</div>
    <div class="lesson-list">
      ${LESSONS.map(l => {
        const s = p[l.key] || 0;
        return `<div class="lesson-card ${s >= 1 ? "done" : ""}" onclick="A.nav('/unit/${id}/${l.key}')">
          <span class="l-emoji">${l.emoji}</span>
          <span class="l-title">${l.title}<div style="font-size:20px;color:#7a6a58;font-weight:normal">${l.desc}</div></span>
          <span class="l-stars">${"⭐".repeat(s)}${"☆".repeat(3 - s)}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="section-title" style="margin-top:26px">💬 好用的一句話</div>
    ${u.phrases.map(ph => `<div class="phrase-card" onclick="speak('${esc(ph.t)}', 0.8)">
      <div class="p-emoji">${ph.e}</div><div class="p-text">${esc(ph.t)}</div>
    </div>`).join("")}
  </div>`;
}

/* ================= 學一學(單元字卡) ================= */
let learnIdx = 0;
function viewUnitLearn(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return nav("/units");
  if (learnIdx >= u.items.length) learnIdx = 0;
  renderLearnCard(u);
}
function renderLearnCard(u) {
  const it = u.items[learnIdx];
  const last = learnIdx === u.items.length - 1;
  app.innerHTML = `<div class="screen">
    ${topbar(`/unit/${u.id}`, "跟著唸一次!看這個字,聽它的聲音和句子。點下一個,學新的字。全部看完,就可以拿星星!")}
    <div class="learn-card">
      <div class="learn-symbol">${it.w}</div>
      <div class="learn-zy">${it.zy}</div>
      <div class="learn-emoji">${it.e}</div>
      <div class="learn-word">${esc(it.word)}</div>
      <div class="learn-sentence">${esc(it.s)}</div>
    </div>
    <div class="action-row">
      <button class="action-btn bg-blue" onclick="A.sayItem(${u.id},${learnIdx})">🔊 再聽一次</button>
      <button class="action-btn bg-purple" onclick="A.nav('/write/${it.w}')">✍️ 寫寫看</button>
    </div>
    <div class="nav-row">
      <button class="nav-btn" onclick="A.learnPrev(${u.id})">⏮️ 上一個</button>
      <button class="nav-btn" style="${last ? "border-color:var(--green);background:var(--green-light)" : ""}" onclick="A.learnNext(${u.id})">${last ? "🎉 完成!" : "下一個 ⏭️"}</button>
    </div>
    <div class="dots">${u.items.map((_, i) => i === learnIdx ? "<b>●</b>" : "○").join(" ")}</div>
  </div>`;
  A.sayItem(u.id, learnIdx);
}
A.sayItem = (uid, i) => {
  const it = UNIT_BY_ID[uid].items[i];
  speak(`${it.w}。${it.word}的${it.w}。${it.s}`);
};
A.learnPrev = uid => { const u = UNIT_BY_ID[uid]; learnIdx = (learnIdx - 1 + u.items.length) % u.items.length; renderLearnCard(u); };
A.learnNext = uid => {
  const u = UNIT_BY_ID[uid];
  if (learnIdx === u.items.length - 1) {
    const gained = store.setLesson(uid, "learn", 3);
    learnIdx = 0;
    finishScreen({
      stars: 3, title: "全部認識了,太棒了!",
      sub: `你學會了 ${u.items.length} 個新字!`,
      retry: `/unit/${uid}/learn`, next: `/unit/${uid}/listen`, nextLabel: "🎧 去玩聽聲音",
    });
  } else { learnIdx++; renderLearnCard(u); }
};

/* ================= 測驗共用 ================= */
let quiz = null; // { uid, kind, items, qIdx, correct, answer, choices, awaiting }
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function startQuiz(uid, kind) {
  const u = UNIT_BY_ID[uid];
  const items = shuffle(u.items.slice()).slice(0, 8);
  quiz = { uid, kind, items, qIdx: -1, correct: 0, awaiting: false };
  const intro = { listen: "仔細聽,點出你聽到的字!", look: "看圖案,點出對的字!", sentence: "聽句子,把對的字放進空格!" }[kind];
  speak(intro);
  setTimeout(nextQ, 2200);
}
function nextQ(rerender) {
  if (!rerender) {
    quiz.qIdx++;
    if (quiz.qIdx >= quiz.items.length) return finishQuiz();
    const it = quiz.items[quiz.qIdx];
    const wrongs = shuffle(UNIT_BY_ID[quiz.uid].items.filter(x => x.w !== it.w)).slice(0, 2);
    quiz.choices = shuffle([it, ...wrongs]);
    quiz.awaiting = true;
    quiz.firstTry = true;
  }
  const u = UNIT_BY_ID[quiz.uid];
  const it = quiz.items[quiz.qIdx];
  const progress = quiz.items.map((_, k) => k < quiz.qIdx ? "🟢" : (k === quiz.qIdx ? "🔵" : "⚪")).join(" ");
  let promptHtml = "";
  if (quiz.kind === "listen") {
    promptHtml = `<button class="big-sound-btn" onclick="A.playQ()">🔊</button>`;
  } else if (quiz.kind === "look") {
    promptHtml = `<div class="quiz-prompt" onclick="A.playQ()"><div class="qp-emoji">${it.e}</div><div class="qp-text">${esc(it.word)}</div></div>`;
  } else {
    const holed = it.s.replace(it.w, `<span class="blank">?</span>`);
    promptHtml = `<div class="quiz-prompt" onclick="A.playQ()"><div class="qp-text">${holed}</div><div style="font-size:22px;color:#7a6a58;margin-top:8px">🔊 點句子可以再聽一次</div></div>`;
  }
  app.innerHTML = `<div class="screen">
    ${topbar(`/unit/${quiz.uid}`, "先聽聲音或看題目,再從下面三個字裡,點出正確的那一個。答錯沒關係,可以再試!")}
    <div class="section-title">${u.emoji} ${ {listen:"🎧 聽聲音",look:"🖼️ 看圖選字",sentence:"✏️ 句子填空"}[quiz.kind] }</div>
    <div class="quiz-progress">${progress}</div>
    ${promptHtml}
    <div class="choice-row">
      ${quiz.choices.map((c, i) => `<button class="choice-btn" id="ch${i}" onclick="A.answer(${i})">${c.w}</button>`).join("")}
    </div>
  </div>`;
  setTimeout(() => A.playQ(), 350);
}
A.playQ = () => {
  const it = quiz.items[quiz.qIdx];
  if (quiz.kind === "listen") speak(`${it.w}。${it.word}的${it.w}`);
  else if (quiz.kind === "look") speak(it.word, 0.8);
  else speak(it.s, 0.8);
};
A.answer = i => {
  if (!quiz.awaiting) return;
  const it = quiz.items[quiz.qIdx];
  const btn = document.getElementById("ch" + i);
  if (quiz.choices[i].w === it.w) {
    quiz.awaiting = false;
    if (quiz.firstTry) quiz.correct++;
    btn.classList.add("correct");
    bigPop("⭕");
    praise();
    setTimeout(() => nextQ(), 1900);
  } else {
    quiz.firstTry = false;
    btn.classList.add("wrong");
    encourage();
    setTimeout(() => A.playQ(), 2600);
  }
};
function finishQuiz() {
  const n = quiz.items.length;
  const c = quiz.correct;
  const stars = c >= n ? 3 : c >= n * 0.7 ? 2 : c >= n * 0.5 ? 1 : 0;
  store.setLesson(quiz.uid, quiz.kind, stars);
  const order = ["learn", "listen", "look", "sentence", "write"];
  const nextKey = order[order.indexOf(quiz.kind) + 1];
  finishScreen({
    stars,
    title: stars === 3 ? "全部答對,太厲害了!" : stars >= 1 ? "過關了,好棒!" : "再練習一次,一定可以的!",
    sub: `答對 ${c} 題(共 ${n} 題)`,
    retry: `/unit/${quiz.uid}/${quiz.kind}`,
    next: stars >= 1 && nextKey ? `/unit/${quiz.uid}/${nextKey}` : `/unit/${quiz.uid}`,
    nextLabel: stars >= 1 && nextKey ? "➡️ 下一關" : "📋 回單元",
  });
}

/* ================= 過關畫面 ================= */
function finishScreen(opt) {
  const unitId = (location.pathname.match(/\/unit\/(\d+)/) || [])[1];
  app.innerHTML = `<div class="screen">
    <div class="topbar"><span></span><span class="star-count">⭐ ${store.data.stars}</span><span></span></div>
    <div class="result-box">
      <div class="result-stars">${opt.stars > 0 ? "⭐".repeat(opt.stars) : "💪"}</div>
      <div class="result-text">${opt.title}</div>
      <div class="result-sub">${opt.sub || ""}</div>
      <div class="action-row" style="max-width:480px;margin:0 auto;">
        <button class="action-btn bg-blue" onclick="A.nav('${opt.retry}')">🔁 再玩一次</button>
        <button class="action-btn bg-green" onclick="A.nav('${opt.next}')">${opt.nextLabel}</button>
      </div>
    </div>
  </div>`;
  if (opt.stars > 0) { celebrate(); }
  speak(opt.title + (opt.stars > 0 ? `你得到${opt.stars}顆星星!` : ""), 0.95);
  // 單元全通 & 新徽章慶祝
  const newly = store.checkBadges(); store.save();
  if (unitId && store.unitDone(+unitId) && opt.stars > 0) {
    setTimeout(() => { confetti(24); speak(`哇!第${unitId}單元全部完成!你真的很棒!`); }, 2600);
  }
  if (newly.length) {
    setTimeout(() => { bigPop("🏅"); speak(`恭喜你得到新徽章:${newly.map(b => b.name).join("、")}!`); }, 4200);
  }
}

/* ================= 寫一寫(單元) ================= */
let writeQueue = [], writeUid = null;
function viewUnitWrite(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return nav("/units");
  writeUid = id;
  writeQueue = u.items.map(it => it.w);
  const step = () => {
    writeQueue.shift();
    if (writeQueue.length === 0) {
      store.setLesson(id, "write", 3);
      finishScreen({
        stars: 3, title: "全部寫完了,好厲害!", sub: `寫了 ${u.items.length} 個字!`,
        retry: `/unit/${id}/write`, next: `/unit/${id}`, nextLabel: "📋 回單元",
      });
    } else openTrace(writeQueue[0], `/unit/${id}`, step);
  };
  openTrace(writeQueue[0], `/unit/${id}`, step);
}

/* ================= 手寫板(共用) ================= */
let traceDone = null, traceChar = "", traceBack = "/", hasInk = false, drawing = false, lastX = 0, lastY = 0;
function charInfo(ch) {
  for (const u of UNITS) for (const it of u.items) if (it.w === ch) return { word: it.word, e: it.e, say: `${ch}。${it.word}的${ch}` };
  if (SYM[ch]) return { word: SYM[ch].word, e: SYM[ch].emoji, say: `${SYM[ch].sound}。${SYM[ch].word}的${SYM[ch].sound}` };
  return { word: ch, e: "✏️", say: ch };
}
function openTrace(ch, backPath, onDone) {
  traceChar = ch; traceBack = backPath; traceDone = onDone || null; hasInk = false;
  const info = charInfo(ch);
  const queueNote = writeQueue.length > 1 ? `<div class="sub-note">還有 ${writeQueue.length} 個字要寫</div>` : "";
  app.innerHTML = `<div class="screen">
    ${topbar(backPath, "用手指照著淡淡的灰色的字,慢慢描寫。寫錯了沒關係,點擦掉重寫。寫好了就點綠色按鈕。")}
    <div class="write-head">
      <span class="write-symbol-label">${ch}</span>
      <span class="write-word-label">${info.e} ${esc(info.word)}</span>
    </div>
    ${queueNote}
    <canvas id="traceCanvas"></canvas>
    <div class="action-row">
      <button class="action-btn bg-blue" onclick="speak('${esc(info.say)}')">🔊 聽發音</button>
      <button class="action-btn bg-orange" onclick="A.clearTrace()">🧹 擦掉重寫</button>
    </div>
    <div class="action-row">
      <button class="action-btn bg-green" onclick="A.finishTrace()">✅ 我寫好了</button>
    </div>
  </div>`;
  setupCanvas();
  speak(`用手指照著灰色的字,慢慢寫「${ch}」`);
}
function setupCanvas() {
  const canvas = document.getElementById("traceCanvas");
  const px = Math.max(260, Math.min(460, window.innerWidth - 40, window.innerHeight - 360));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.height = px + "px";
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = px * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawTemplate();
  canvas.onpointerdown = e => {
    e.preventDefault(); drawing = true;
    const r = canvas.getBoundingClientRect(); lastX = e.clientX - r.left; lastY = e.clientY - r.top;
    canvas.setPointerCapture(e.pointerId);
  };
  canvas.onpointermove = e => {
    if (!drawing) return;
    const r = canvas.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
    ctx.strokeStyle = "#E86A33"; ctx.lineWidth = 13; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
    lastX = x; lastY = y; hasInk = true;
  };
  canvas.onpointerup = canvas.onpointercancel = canvas.onpointerleave = () => { drawing = false; };
}
function drawTemplate() {
  const canvas = document.getElementById("traceCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width / dpr, h = canvas.height / dpr;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#E8DFD3"; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#D8CFC4";
  ctx.font = `900 ${Math.min(w, h) * 0.72}px "Microsoft JhengHei", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(traceChar, w / 2, h / 2 + Math.min(w, h) * 0.03);
  hasInk = false;
}
A.clearTrace = () => { drawTemplate(); speak("擦乾淨了,再寫一次!"); };
A.finishTrace = () => {
  if (!hasInk) { speak("還沒寫喔!用手指照著灰色的字描寫看看。"); return; }
  const first = !store.data.bpmf.practiced[traceChar];
  store.data.bpmf.practiced[traceChar] = (store.data.bpmf.practiced[traceChar] || 0) + 1;
  if (first) store.data.stars += 1;
  store.stampToday(); store.save();
  confetti(12); applause(1.2); bigPop("👍");
  if (traceDone) { setTimeout(() => traceDone(), 1400); }
  else {
    speak(first ? "寫得真好!你得到一顆星星!" : "寫得越來越漂亮了,真棒!");
    setTimeout(() => drawTemplate(), 1400);
  }
};
window.addEventListener("resize", () => { if (document.getElementById("traceCanvas")) setupCanvas(); });

/* ================= 手寫選字 ================= */
function viewWriteMenu() {
  const chars = [];
  UNITS.forEach(u => { if (store.unitUnlocked(u.id)) u.items.forEach(it => { if (!chars.includes(it.w)) chars.push(it.w); }); });
  app.innerHTML = `<div class="screen">
    ${topbar("/", "想練習寫哪一個字?用手指點它。也可以到下面點注音符號來寫。")}
    <div class="section-title">✍️ 想寫哪個字?</div>
    <div class="symbol-grid">
      ${chars.map(ch => `<button class="symbol-btn" onclick="A.nav('/write/${ch}')">${ch}${store.data.bpmf.practiced[ch] ? '<span class="done">✅</span>' : ""}</button>`).join("")}
    </div>
    <div class="section-title">🅱️ 注音符號</div>
    <div class="symbol-grid">
      ${SYMBOLS.map(s => `<button class="symbol-btn" onclick="A.nav('/write/${s.z}')">${s.z}<span class="mini">${s.emoji}</span>${store.data.bpmf.practiced[s.z] ? '<span class="done">✅</span>' : ""}</button>`).join("")}
    </div>
  </div>`;
}

/* ================= 注音總表與學習卡 ================= */
function viewBpmf() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是所有的注音符號。想學哪一個,就用手指點它,它就會唸給你聽。")}
    ${BPMF_GROUPS.map(g => `
      <div class="section-title">${g.title}</div>
      <div class="symbol-grid">
        ${g.list.split("").map(z => {
          const s = SYM[z];
          return `<button class="symbol-btn" onclick="A.nav('/bpmf/${z}')">${z}<span class="mini">${s.emoji}</span>${store.data.bpmf.practiced[z] ? '<span class="done">✅</span>' : ""}</button>`;
        }).join("")}
      </div>`).join("")}
  </div>`;
}
function viewBpmfCard(z) {
  const idx = SYMBOLS.findIndex(s => s.z === z);
  if (idx < 0) return nav("/bpmf");
  const s = SYMBOLS[idx];
  const prev = SYMBOLS[(idx - 1 + SYMBOLS.length) % SYMBOLS.length].z;
  const next = SYMBOLS[(idx + 1) % SYMBOLS.length].z;
  app.innerHTML = `<div class="screen">
    ${topbar("/bpmf", "跟著唸一次!點藍色按鈕再聽一次,點紫色按鈕練習寫這個符號。點下一個,學新的符號。")}
    <div class="learn-card">
      <div class="learn-symbol">${s.z}</div>
      <div class="learn-emoji">${s.emoji}</div>
      <div class="learn-word">${esc(s.word)}</div>
    </div>
    <div class="action-row">
      <button class="action-btn bg-blue" onclick="A.sayBpmf('${s.z}')">🔊 再聽一次</button>
      <button class="action-btn bg-purple" onclick="A.nav('/write/${s.z}')">✍️ 寫寫看</button>
    </div>
    <div class="nav-row">
      <button class="nav-btn" onclick="A.nav('/bpmf/${prev}')">⏮️ 上一個</button>
      <button class="nav-btn" onclick="A.nav('/bpmf/${next}')">下一個 ⏭️</button>
    </div>
  </div>`;
  A.sayBpmf(s.z);
}
A.sayBpmf = z => { const s = SYM[z]; speak(`${s.sound}。${s.word}的${s.sound}。${s.word}`); };

/* ================= 注音闖關 ================= */
function viewGames() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "選一關來玩!聽聲音,找出正確的注音符號,就可以拿星星。過了一關,下一關才會打開。")}
    <div class="section-title">🎧 注音闖關</div>
    <div class="level-grid">
      ${BPMF_LEVELS.map((syms, i) => {
        const stars = store.data.bpmf.levels[i] || 0;
        const open = i === 0 || (store.data.bpmf.levels[i - 1] || 0) >= 1;
        return `<button class="level-btn ${open ? "" : "locked"}" onclick="${open ? `A.nav('/games/${i + 1}')` : "A.lockedLevel()"}">
          <div class="lv-num">${open ? "" : "🔒 "}第 ${i + 1} 關</div>
          <div class="lv-syms">${syms.join(" ")}</div>
          <div class="lv-stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
        </button>`;
      }).join("")}
    </div>
  </div>`;
}
A.lockedLevel = () => speak("這一關還沒開喔!先把前面那一關過關,拿到星星,就可以玩了。");

let bq = null; // 注音測驗狀態
function viewBpmfQuiz(levelIdx) {
  if (levelIdx < 0 || levelIdx >= BPMF_LEVELS.length) return nav("/games");
  bq = { level: levelIdx, qIdx: 0, correct: 0, awaiting: false, total: 5 };
  speak("仔細聽,點出你聽到的注音符號!");
  setTimeout(nextBpmfQ, 2200);
}
function nextBpmfQ() {
  bq.qIdx++;
  if (bq.qIdx > bq.total) return finishBpmfQuiz();
  const pool = BPMF_LEVELS[bq.level];
  bq.answer = pool[Math.floor(Math.random() * pool.length)];
  const others = pool.filter(z => z !== bq.answer);
  while (others.length < 2) {
    const r = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)].z;
    if (r !== bq.answer && !others.includes(r)) others.push(r);
  }
  bq.choices = shuffle([bq.answer, ...shuffle(others).slice(0, 2)]);
  bq.awaiting = true; bq.firstTry = true;
  const progress = Array.from({ length: bq.total }, (_, k) => k < bq.qIdx - 1 ? "🟢" : (k === bq.qIdx - 1 ? "🔵" : "⚪")).join(" ");
  app.innerHTML = `<div class="screen">
    ${topbar("/games", "點大大的藍色喇叭聽聲音,然後在下面三個裡面,點出你聽到的那一個注音符號。")}
    <div class="section-title">🎧 第 ${bq.level + 1} 關</div>
    <div class="quiz-progress">${progress}</div>
    <button class="big-sound-btn" onclick="A.playB()">🔊</button>
    <div class="choice-row">
      ${bq.choices.map((z, i) => `<button class="choice-btn" id="bh${i}" onclick="A.answerB(${i})">${z}</button>`).join("")}
    </div>
  </div>`;
  setTimeout(() => A.playB(), 350);
}
A.playB = () => { const s = SYM[bq.answer]; speak(`${s.sound}。${s.word}的${s.sound}`); };
A.answerB = i => {
  if (!bq.awaiting) return;
  const btn = document.getElementById("bh" + i);
  if (bq.choices[i] === bq.answer) {
    bq.awaiting = false;
    if (bq.firstTry) bq.correct++;
    btn.classList.add("correct"); bigPop("⭕"); praise();
    setTimeout(() => nextBpmfQ(), 1900);
  } else {
    bq.firstTry = false;
    btn.classList.add("wrong"); encourage();
    setTimeout(() => A.playB(), 2600);
  }
};
function finishBpmfQuiz() {
  const stars = bq.correct >= 5 ? 3 : bq.correct >= 4 ? 2 : bq.correct >= 3 ? 1 : 0;
  const prev = store.data.bpmf.levels[bq.level] || 0;
  if (stars > prev) { store.data.stars += stars - prev; store.data.bpmf.levels[bq.level] = stars; }
  store.stampToday(); store.checkBadges(); store.save();
  const hasNext = bq.level + 1 < BPMF_LEVELS.length;
  finishScreen({
    stars,
    title: stars === 3 ? "全部答對,太厲害了!" : stars >= 1 ? "過關了,好棒!" : "再練習一次,一定可以的!",
    sub: `答對 ${bq.correct} 題(共 ${bq.total} 題)`,
    retry: `/games/${bq.level + 1}`,
    next: stars >= 1 && hasNext ? `/games/${bq.level + 2}` : "/games",
    nextLabel: stars >= 1 && hasNext ? "➡️ 下一關" : "📋 回關卡",
  });
}

/* ================= 我的獎勵 ================= */
function viewRewards() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const t = todayStr();
  let cells = "";
  for (let i = 0; i < firstDay; i++) cells += `<div></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const stamped = store.data.days[key];
    cells += `<div class="cal-day ${stamped ? "stamped" : ""} ${key === t ? "today" : ""}">
      <div>${d}</div>${stamped ? '<div class="stamp">🌟</div>' : ""}
    </div>`;
  }
  const streak = store.streakNow();
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是你的獎勵!上面是連續學習的天數,中間的月曆,每天有學習就會蓋一個星星章。下面是你得到的徽章。")}
    <div class="streak-banner">
      <div class="fire">🔥</div>
      <div class="s-text">連續學習 ${streak} 天</div>
      <div style="font-size:22px;color:#7a6a58">認識 ${store.knownChars()} 個字・⭐ ${store.data.stars} 顆星星</div>
    </div>
    <div class="section-title">📅 ${m + 1} 月學習月曆</div>
    <div class="cal-grid">
      ${["日", "一", "二", "三", "四", "五", "六"].map(d => `<div class="cal-head">${d}</div>`).join("")}
      ${cells}
    </div>
    <div class="section-title">🏅 我的徽章</div>
    <div class="badge-list">
      ${BADGES.map(b => `<div class="badge-card ${store.data.badges[b.id] ? "earned" : ""}">
        <div class="b-emoji">${b.emoji}</div>
        <div class="b-name">${b.name}</div>
        <div class="b-desc">${b.desc}</div>
      </div>`).join("")}
    </div>
  </div>`;
}

/* ================= 設定(學號) ================= */
function viewSettings() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這是你的學號。換新的手機或平板時,在新的機器上輸入這個學號,你的星星和進度就會全部回來。可以請家人幫你抄下來。")}
    <div class="section-title">🔑 我的學號</div>
    <div class="code-box">
      <div class="c-label">記下這 6 個字,進度不會不見</div>
      <div class="c-code">${store.data.code}</div>
      <div class="c-label">換手機、換平板都可以用它找回進度</div>
    </div>
    <div class="section-title">📥 找回我的進度</div>
    <div class="sub-note">輸入以前的學號,把進度接回來</div>
    <input class="code-input" id="codeInput" maxlength="6" placeholder="ABC234" autocomplete="off">
    <div class="action-row">
      <button class="action-btn bg-green" onclick="A.restore()">✅ 找回進度</button>
    </div>
    <div class="sync-note">進度會自動存到雲端,不用擔心。</div>
  </div>`;
}
A.restore = async () => {
  const v = document.getElementById("codeInput").value;
  speak("正在找你的進度,等一下喔。");
  const r = await store.restore(v);
  if (r.ok) { celebrate(); speak("找到了!你的進度全部回來了!"); setTimeout(() => nav("/"), 2000); }
  else speak(r.msg);
};

/* ================= 路由 ================= */
function render() {
  const p = decodeURIComponent(location.pathname);
  let m;
  if (p === "/" || p === "") return viewHome();
  if (p === "/units") return viewUnits();
  if ((m = p.match(/^\/unit\/(\d+)\/learn$/))) return viewUnitLearn(+m[1]);
  if ((m = p.match(/^\/unit\/(\d+)\/(listen|look|sentence)$/))) { const u = UNIT_BY_ID[+m[1]]; if (!u) return nav("/units"); return startQuiz(+m[1], m[2]); }
  if ((m = p.match(/^\/unit\/(\d+)\/write$/))) return viewUnitWrite(+m[1]);
  if ((m = p.match(/^\/unit\/(\d+)$/))) return viewUnit(+m[1]);
  if (p === "/bpmf") return viewBpmf();
  if ((m = p.match(/^\/bpmf\/(.+)$/))) return viewBpmfCard(m[1]);
  if (p === "/games") return viewGames();
  if ((m = p.match(/^\/games\/(\d+)$/))) return viewBpmfQuiz(+m[1] - 1);
  if (p === "/write") return viewWriteMenu();
  if ((m = p.match(/^\/write\/(.+)$/))) { writeQueue = []; return openTrace(m[1], "/write", null); }
  if (p === "/rewards") return viewRewards();
  if (p === "/settings") return viewSettings();
  viewHome();
}

store.syncFromCloud().then(changed => { if (changed) render(); });
render();
