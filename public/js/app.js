/* 天天學字 — 路由 + 畫面
   主課程(識字):/units /unit/3 /unit/3/listen /review/5 /qexam/1 /exam
   練習區(永遠玩不完):/daily 每日挑戰 /tower 闖關塔 /reading 朗讀 /box 錯字複習
   補充教材:/bpmf /games
   其他:/write /rewards /settings
*/
const app = document.getElementById("app");
const A = {}; // 全域事件處理器,給 inline onclick 用

function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
const BLANK = /（\s*）|（　+）|\(　*\)|（　*\)/g;

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
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
// 用日期當種子的亂數(每日挑戰:同一天題目一樣,隔天換新的)
function seededRand(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function seededShuffle(a, rnd) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ================= 出題引擎 ================= */
// 把句子或詞語裡所有的目標字都挖成空格(只挖第一個的話,重複出現時會露答案)
function blankOut(text, ch) {
  return esc(text).split(ch).join('<span class="blank">?</span>');
}
// 把短文切成一句一句(不用 lookbehind,舊版 Safari 也能跑)
function splitSentences(text) {
  const out = []; let cur = "";
  for (const ch of text) { cur += ch; if ("。!?".includes(ch)) { out.push(cur); cur = ""; } }
  if (cur.trim()) out.push(cur);
  return out;
}
// 固定資料的選項要洗牌,否則正解永遠在同一個位置,一直點第一個就會過關
function shuffleOpts(opts, a) {
  const right = opts[a];
  const mixed = shuffle(opts.slice());
  return { opts: mixed, a: mixed.indexOf(right) };
}
// 題目物件:{ type, item, say, promptHtml, opts:[字], a:正解索引 }
function distractors(target, pool, n) {
  const others = pool.filter(it => it.w !== target.w);
  const shuffled = shuffle(others.slice());
  // 優先挑注音開頭相同(音近)或例詞主題相近的字,增加鑑別度
  shuffled.sort((x, y) => {
    const sim = it => (it.zy[0] === target.zy[0] ? 1 : 0);
    return sim(y) - sim(x);
  });
  const near = shuffled.slice(0, Math.max(n * 2, 4));
  return shuffle(near).slice(0, n);
}
function makeQuestion(item, kind, pool, optCount) {
  const n = (optCount || 3) - 1;
  const wrongs = distractors(item, pool, n);
  const opts = shuffle([item, ...wrongs]).map(it => it.w);
  const a = opts.indexOf(item.w);
  const base = { item, opts, a, type: kind };
  if (kind === "listen") {
    return Object.assign(base, {
      say: `${item.w}。${item.word}的${item.w}`,
      promptHtml: `<button class="big-sound-btn" onclick="A.sayQ()">🔊</button>`,
      autoPlay: true,
    });
  }
  if (kind === "look") {
    // 只給圖案和聲音,字不能出現在題目上(不然等於把答案寫出來)
    return Object.assign(base, {
      say: item.word,
      rate: 0.8,
      promptHtml: `<div class="quiz-prompt" onclick="A.sayQ()"><div class="qp-emoji" style="font-size:110px">${item.e}</div>
        <div class="qp-hint">🔊 點圖案,再聽一次這個詞</div></div>`,
      autoPlay: true,
    });
  }
  if (kind === "word") {
    const word = pick(item.words && item.words.length ? item.words : [item.word]);
    return Object.assign(base, {
      say: word,
      rate: 0.75,
      promptHtml: `<div class="quiz-prompt" onclick="A.sayQ()"><div class="qp-emoji">${item.e}</div>
        <div class="qp-text">${blankOut(word, item.w)}</div>
        <div class="qp-hint">🔊 點一下,再聽一次這個詞</div></div>`,
      autoPlay: true,
    });
  }
  // sentence
  return Object.assign(base, {
    say: item.s,
    rate: 0.8,
    promptHtml: `<div class="quiz-prompt" onclick="A.sayQ()"><div class="qp-text">${blankOut(item.s, item.w)}</div>
      <div class="qp-hint">🔊 點句子可以再聽一次</div></div>`,
    autoPlay: true,
  });
}
// 混合題:給小考、總複習、每日挑戰、闖關塔用
function makeMixed(items, pool, plan, optCount, rnd) {
  const shuf = rnd ? seededShuffle(items.slice(), rnd) : shuffle(items.slice());
  const qs = [];
  let i = 0;
  plan.forEach(([kind, count]) => {
    for (let k = 0; k < count; k++) {
      const item = shuf[i % shuf.length]; i++;
      qs.push(makeQuestion(item, kind, pool, optCount));
    }
  });
  return rnd ? seededShuffle(qs, rnd) : shuffle(qs);
}

/* ================= 測驗流程(全站共用) ================= */
let Q = null; // { title, emoji, back, help, questions, idx, correct, awaiting, firstTry, onFinish }
function runQuiz(cfg) {
  Q = Object.assign({ idx: -1, correct: 0, awaiting: false }, cfg);
  if (!Q.questions.length) { speak("這裡還沒有題目喔!"); return nav(Q.back); }
  speak(Q.intro || "仔細看題目,點出正確的答案!");
  setTimeout(nextQ, 2200);
}
function nextQ() {
  Q.idx++;
  if (Q.idx >= Q.questions.length) return finishRun();
  const q = Q.questions[Q.idx];
  Q.awaiting = true; Q.firstTry = true;
  const progress = Q.questions.map((_, k) => k < Q.idx ? "🟢" : (k === Q.idx ? "🔵" : "⚪")).join(" ");
  const wide = q.opts.some(o => o.length > 2) || q.opts.length > 3;
  app.innerHTML = `<div class="screen">
    ${topbar(Q.back, Q.help)}
    <div class="section-title">${Q.emoji} ${esc(Q.title)}</div>
    <div class="quiz-progress">${progress}</div>
    ${q.promptHtml}
    <div class="choice-row" ${wide ? 'style="grid-template-columns:repeat(2,1fr)"' : ""}>
      ${q.opts.map((o, i) => `<button class="choice-btn" id="ch${i}" ${o.length > 3 ? 'style="font-size:30px"' : ""} onclick="A.answer(${i})">${esc(o)}</button>`).join("")}
    </div>
  </div>`;
  if (q.autoPlay) setTimeout(() => A.sayQ(), 350);
}
A.sayQ = () => { const q = Q.questions[Q.idx]; if (q.say) speak(q.say, q.rate || 1); };
A.answer = i => {
  if (!Q.awaiting) return;
  const q = Q.questions[Q.idx];
  const btn = document.getElementById("ch" + i);
  if (i === q.a) {
    Q.awaiting = false;
    if (Q.firstTry) { Q.correct++; if (q.item) store.boxHit(q.item.w); }
    btn.classList.add("correct"); bigPop("⭕"); praise();
    setTimeout(() => nextQ(), 1900);
  } else {
    if (Q.firstTry && q.item) store.boxAdd(q.item.w);
    Q.firstTry = false;
    btn.classList.add("wrong"); encourage();
    setTimeout(() => A.sayQ(), 2600);
  }
};
function finishRun() {
  const n = Q.questions.length;
  const score = Math.round(Q.correct / n * 100);
  Q.onFinish(score, Q.correct, n);
}

/* ================= 過關畫面 ================= */
function finishScreen(opt) {
  app.innerHTML = `<div class="screen">
    <div class="topbar"><span></span><span class="star-count">⭐ ${store.data.stars}</span><span></span></div>
    <div class="result-box">
      <div class="result-stars">${opt.stars > 0 ? "⭐".repeat(opt.stars) : "💪"}</div>
      <div class="result-text">${esc(opt.title)}</div>
      <div class="result-sub">${esc(opt.sub || "")}</div>
      <div class="action-row" style="max-width:480px;margin:0 auto;">
        <button class="action-btn bg-blue" onclick="A.nav('${opt.retry}')">${opt.retryLabel || "🔁 再玩一次"}</button>
        <button class="action-btn bg-green" onclick="A.nav('${opt.next}')">${opt.nextLabel}</button>
      </div>
      ${opt.note ? `<div class="sub-note" style="margin-top:16px">${esc(opt.note)}</div>` : ""}
    </div>
  </div>`;
  if (opt.stars > 0) celebrate();
  speak(opt.say || (opt.title + (opt.stars > 0 ? `你得到${opt.stars}顆星星!` : "")), 0.95);
  const newly = store.checkBadges(); store.save();
  if (opt.extraCelebrate) setTimeout(() => { confetti(24); speak(opt.extraCelebrate); }, 2600);
  if (newly.length) setTimeout(() => { bigPop("🏅"); speak(`恭喜你得到新徽章:${newly.map(b => b.name).join("、")}!`); }, 4200);
}
// 單元關卡結算(60 分過關,不過就回去複習)
function finishLesson(uid, key, score, correct, n) {
  store.setLesson(uid, key, score);
  const pass = score >= PASS;
  const i = LESSONS.findIndex(l => l.key === key);
  const nextKey = LESSONS[i + 1] ? LESSONS[i + 1].key : null;
  const unitJustDone = key === "utest" && pass;
  finishScreen({
    stars: starsOf(score),
    title: score === 100 ? "一百分!太厲害了!" : pass ? `${score} 分,過關了!` : `${score} 分,再練習一次!`,
    sub: `答對 ${correct} 題(共 ${n} 題)`,
    retry: `/unit/${uid}/${key}`,
    next: pass ? (nextKey ? `/unit/${uid}/${nextKey}` : `/unit/${uid}`) : `/unit/${uid}/learn`,
    nextLabel: pass ? (nextKey ? "➡️ 下一關" : "📋 回單元") : "📖 回去學一學",
    note: pass ? "" : "六十分才能過關喔,我們再複習一次,你一定可以的!",
    extraCelebrate: unitJustDone ? `太好了!第${uid}單元全部完成!` : null,
  });
}

/* ================= 首頁 ================= */
function nextTask() {
  // 1. 錯字太多先複習
  if (store.boxCount() >= 5) return { type: "box" };
  // 2. 主課程:單元 → 總複習 → 季檢定
  for (const u of UNITS) {
    if (!store.unitUnlocked(u.id)) break;
    for (const l of LESSONS) {
      if (store.lessonScore(u.id, l.key) < PASS) return { type: "unit", unit: u, lesson: l };
    }
    if (REVIEW_POINTS.includes(u.id) && store.reviewScore(u.id) < PASS) return { type: "review", n: u.id };
    const st = stageOfUnit(u.id);
    if (u.id === st.units[1] && store.qexamScore(st.id) < PASS) return { type: "qexam", stage: st };
  }
  // 3. 模擬考
  for (const e of EXAMS) if (store.examScore(e.id) < 80) return { type: "exam", exam: e };
  // 4. 主課程全破 → 每天都有得玩
  if (!store.dailyDone()) return { type: "daily" };
  return { type: "tower" };
}
function taskCard(task) {
  const m = {
    box:    { nav: "/box",    label: `🔁 複習錯過的字(${store.boxCount()} 個)`, hint: "先把不熟的字補起來" },
    daily:  { nav: "/daily",  label: "📅 今天的每日挑戰", hint: "每天都有新題目" },
    tower:  { nav: "/tower",  label: `🗼 闖關塔・第 ${store.towerBest() + 1} 層`, hint: "一層一層往上爬,沒有盡頭" },
  };
  if (m[task.type]) return m[task.type];
  if (task.type === "unit") return { nav: `/unit/${task.unit.id}/${task.lesson.key}`, label: `${task.unit.emoji} 第${task.unit.id}單元 ${task.unit.title}・${task.lesson.emoji} ${task.lesson.title}`, hint: task.lesson.desc };
  if (task.type === "review") return { nav: `/review/${task.n}`, label: `🔁 第 ${task.n - 4} 到 ${task.n} 單元・總複習`, hint: "考過六十分,才能繼續往下學" };
  if (task.type === "qexam") return { nav: `/qexam/${task.stage.id}`, label: `🎯 第${task.stage.id}季 季檢定・${task.stage.title}`, hint: "這一季的總驗收" };
  return { nav: `/exam/${task.exam.id}`, label: `🎓 檢定挑戰・${task.exam.title}`, hint: "仿正式檢定的模擬考" };
}
function viewHome() {
  const task = nextTask();
  const card = taskCard(task);
  const streak = store.streakNow();
  const stamped = store.data.days[todayStr()];
  const box = store.boxCount();
  const open = store.practiceOpen();
  app.innerHTML = `<div class="screen">
    ${topbar(null, "歡迎來到天天學字!點中間橘色的大卡片,就會帶你去今天要學的東西。下面的識字單元是主課程,旁邊還有每日挑戰、闖關塔可以一直玩。")}
    <div class="home-title">天天學字</div>
    <div class="home-sub">每天學一點,越學越棒!</div>
    <div class="hero-card" onclick="A.nav('${card.nav}')">
      <div class="hero-line1">${stamped ? "✅ 今天已經學過了,再玩一次也可以!" : "☀️ 今天的任務"}</div>
      <div class="hero-line2">${card.label}</div>
      <div style="font-size:22px;color:#7a6a58;margin-top:6px">${card.hint}</div>
    </div>
    <div class="stat-row">
      <div class="stat-box"><div class="num">🔥${streak}</div><div class="lbl">連續天數</div></div>
      <div class="stat-box"><div class="num">${store.knownChars()}</div><div class="lbl">認識的字</div></div>
      <div class="stat-box"><div class="num">⭐${store.data.stars}</div><div class="lbl">星星</div></div>
    </div>
    <div class="menu">
      <div class="menu-card c1" onclick="A.nav('/units')"><span class="emoji">📚</span><span class="label">識字單元</span><span class="hint">主課程・40 單元</span></div>
      <div class="menu-card c1" onclick="A.nav('/exam')"><span class="emoji">🎓</span><span class="label">檢定挑戰</span><span class="hint">${store.examUnlocked() ? "模擬考" : "🔒 過一季就開"}</span></div>
    </div>
    <div class="menu-divider">🎲 天天都能玩(不用等,隨時來)</div>
    <div class="menu">
      <div class="menu-card c3" onclick="A.nav('/daily')"><span class="emoji">📅</span><span class="label">每日挑戰</span><span class="hint">${!open ? "先學第一課" : store.dailyDone() ? "今天完成 ✅" : "每天換新題"}</span></div>
      <div class="menu-card c2" onclick="A.nav('/tower')"><span class="emoji">🗼</span><span class="label">闖關塔</span><span class="hint">${open ? `最高 ${store.towerBest()} 層` : "先學第一課"}</span></div>
      <div class="menu-card c4" onclick="A.nav('/reading')"><span class="emoji">📢</span><span class="label">朗讀練習</span><span class="hint">${open ? "唸出聲音" : "先學第一課"}</span></div>
      <div class="menu-card c5" onclick="A.nav('/box')"><span class="emoji">🔁</span><span class="label">錯字複習</span><span class="hint">${box ? `${box} 個字要複習` : "目前都很好 👍"}</span></div>
      <div class="menu-card c4" onclick="A.nav('/write')"><span class="emoji">✍️</span><span class="label">寫字練習</span><span class="hint">動動手</span></div>
      <div class="menu-card c5" onclick="A.nav('/rewards')"><span class="emoji">🏅</span><span class="label">我的獎勵</span><span class="hint">月曆徽章</span></div>
    </div>
    <div class="menu-divider">🧩 補充教材(想練發音就來)</div>
    <div class="menu">
      <div class="menu-card c2" onclick="A.nav('/bpmf')"><span class="emoji">🅱️</span><span class="label">注音符號</span><span class="hint">學發音</span></div>
      <div class="menu-card c3" onclick="A.nav('/games')"><span class="emoji">🎧</span><span class="label">注音闖關</span><span class="hint">十關小遊戲</span></div>
    </div>
    <div class="sync-note" style="margin-top:18px" onclick="A.nav('/settings')">🔑 我的學號:<b>${store.data.code}</b>(點我看說明)</div>
  </div>`;
}

/* ================= 識字單元列表(依四季分組) ================= */
function viewUnits() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是識字主課程,一共四季四十個單元。完成一個單元,下一個就會打開。每五個單元有一次總複習,每一季最後有一次季檢定。")}
    <div class="section-title">📚 識字單元</div>
    ${STAGES.map(st => {
      const ids = []; for (let i = st.units[0]; i <= st.units[1]; i++) ids.push(i);
      const doneN = ids.filter(i => store.unitDone(i)).length;
      const stOpen = st.id === 1 || store.stageDone(st.id - 1);
      return `<div class="stage-head">
          <div class="st-title">${st.emoji} 第${st.id}季 ${st.title}</div>
          <div class="st-sub">${stOpen ? `${st.desc}・完成 ${doneN}/10 單元` : `🔒 先通過第 ${st.id - 1} 季的季檢定`}</div>
        </div>
        <div class="unit-list">
        ${ids.map(id => {
          const u = UNIT_BY_ID[id];
          if (!u) return "";
          const unlocked = store.unitUnlocked(id);
          const done = store.unitDone(id);
          const n = store.unitProgress(id);
          return `<div class="unit-card ${unlocked ? "" : "locked"}" onclick="${unlocked ? `A.nav('/unit/${id}')` : `A.lockedMsg(${id})`}">
            <span class="u-emoji">${unlocked ? u.emoji : "🔒"}</span>
            <span class="u-mid">
              <div class="u-title">第${id}單元 ${esc(u.title)}</div>
              <div class="u-progress">${unlocked ? `完成 ${n}/${LESSONS.length} 關` : store.unitLockReason(id)}</div>
            </span>
            <span class="unit-done-mark">${done ? "🏆" : ""}</span>
          </div>`;
        }).join("")}
        ${REVIEW_POINTS.filter(n => n >= st.units[0] && n <= st.units[1]).map(n => {
          const open = store.reviewUnlocked(n);
          const sc = store.reviewScore(n);
          return `<div class="unit-card review-card ${open ? "" : "locked"}" onclick="${open ? `A.nav('/review/${n}')` : "A.reviewLocked()"}">
            <span class="u-emoji">${open ? "🔁" : "🔒"}</span>
            <span class="u-mid">
              <div class="u-title">總複習(第 ${n - 4} 到 ${n} 單元)</div>
              <div class="u-progress">${sc >= PASS ? `${sc} 分 通過 ✅` : open ? "考過六十分才能繼續" : `先完成第 ${n} 單元`}</div>
            </span>
            <span class="unit-done-mark">${sc >= PASS ? "🏆" : ""}</span>
          </div>`;
        }).join("")}
        <div class="unit-card qexam-card ${store.qexamUnlocked(st.id) ? "" : "locked"}" onclick="${store.qexamUnlocked(st.id) ? `A.nav('/qexam/${st.id}')` : "A.qexamLocked()"}">
          <span class="u-emoji">${store.qexamUnlocked(st.id) ? "🎯" : "🔒"}</span>
          <span class="u-mid">
            <div class="u-title">第${st.id}季 季檢定</div>
            <div class="u-progress">${store.qexamScore(st.id) >= PASS ? `${store.qexamScore(st.id)} 分 通過 ✅` : "這一季的總驗收,六十分過關"}</div>
          </span>
          <span class="unit-done-mark">${store.qexamScore(st.id) >= PASS ? "🏆" : ""}</span>
        </div>
        </div>`;
    }).join("")}
  </div>`;
}
A.lockedMsg = id => speak("這個單元還沒打開喔!" + store.unitLockReason(id) + ",就可以來學了。");
A.reviewLocked = () => speak("總複習還沒打開喔!先把前面五個單元都完成。");
A.qexamLocked = () => speak("季檢定還沒打開喔!先把這一季的十個單元和兩次總複習都完成。");

/* ================= 單元關卡列表 ================= */
function viewUnit(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return nav("/units");
  app.innerHTML = `<div class="screen">
    ${topbar("/units", "這個單元有八關,要一關一關過。先學一學認識新字,再玩聽力、看圖、詞語、句子、朗讀、寫字,最後考一次小考。小考六十分才能去下一個單元。")}
    <div class="section-title">${u.emoji} 第${u.id}單元 ${esc(u.title)}</div>
    <div class="lesson-list">
      ${LESSONS.map(l => {
        const sc = store.lessonScore(id, l.key);
        const open = store.lessonUnlocked(id, l.key);
        return `<div class="lesson-card ${sc >= PASS ? "done" : ""} ${open ? "" : "locked"}" onclick="${open ? `A.nav('/unit/${id}/${l.key}')` : "A.lessonLocked()"}">
          <span class="l-emoji">${open ? l.emoji : "🔒"}</span>
          <span class="l-title">${l.title}<div style="font-size:20px;color:#7a6a58;font-weight:normal">${sc > 0 ? `${sc} 分` : l.desc}</div></span>
          <span class="l-stars">${"⭐".repeat(starsOf(sc))}${"☆".repeat(3 - starsOf(sc))}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="section-title" style="margin-top:26px">💬 好用的一句話</div>
    ${u.phrases.map(ph => `<div class="phrase-card" onclick="speak('${esc(ph.t)}', 0.8)">
      <div class="p-emoji">${ph.e}</div><div class="p-text">${esc(ph.t)}</div>
    </div>`).join("")}
  </div>`;
}
A.lessonLocked = () => speak("這一關還沒打開喔!先把上面那一關過了,就可以玩了。");

/* ================= 1 學一學(字卡 + 跟讀) ================= */
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
    ${topbar(`/unit/${u.id}`, "看這個字,聽它的聲音。聽完以後,自己也跟著唸一次,聲音大一點沒關係!唸完點下一個。")}
    <div class="learn-card">
      <div class="learn-symbol">${it.w}</div>
      <div class="learn-zy">${it.zy}</div>
      <div class="learn-emoji">${it.e}</div>
      <div class="learn-word">${esc(it.words.join("、"))}</div>
      <div class="learn-sentence">${esc(it.s)}</div>
    </div>
    <div class="say-along">🗣️ 換你唸唸看:<b>${it.w}</b>,${esc(it.word)}</div>
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
    store.setLesson(uid, "learn", 100);
    learnIdx = 0;
    finishScreen({
      stars: 3, title: "全部認識了,太棒了!", sub: `你學會了 ${u.items.length} 個新字!`,
      retry: `/unit/${uid}/learn`, next: `/unit/${uid}/listen`, nextLabel: "🎧 去玩聽聲音",
    });
  } else { learnIdx++; renderLearnCard(u); }
};

/* ================= 2~5 聽聲音 / 看圖 / 詞語 / 句子 ================= */
function startUnitQuiz(uid, kind) {
  const u = UNIT_BY_ID[uid];
  const items = shuffle(u.items.slice()).slice(0, 8);
  const l = LESSON_BY_KEY[kind];
  runQuiz({
    title: `第${uid}單元 ${l.title}`, emoji: l.emoji, back: `/unit/${uid}`,
    help: "先聽聲音或看題目,再從下面的字裡,點出正確的那一個。答錯沒關係,可以再試一次!",
    intro: { listen: "仔細聽,點出你聽到的字!", look: "看圖案,點出對的字!", word: "聽這個詞,把空格補起來!", sentence: "聽句子,把對的字放進空格!" }[kind],
    questions: items.map(it => makeQuestion(it, kind, u.items)),
    onFinish: (score, c, n) => finishLesson(uid, kind, score, c, n),
  });
}

/* ================= 6 讀一讀(朗讀短文 + 短文填空) ================= */
let readState = null;
function viewUnitRead(id) {
  const u = UNIT_BY_ID[id];
  if (!u || !u.story) return nav(`/unit/${id}`);
  readState = { uid: id, played: false };
  renderReadStory(u);
}
function renderReadStory(u) {
  const sentences = splitSentences(u.story.text);
  app.innerHTML = `<div class="screen">
    ${topbar(`/unit/${u.id}`, "這裡有一篇短短的文章。先點藍色按鈕聽一次,再自己唸出聲音。一句一句慢慢唸,唸完就可以去做填空題。")}
    <div class="section-title">📢 ${esc(u.story.title)}</div>
    <div class="story-box">
      ${sentences.map((s, i) => `<span class="story-line" id="sl${i}" onclick="A.saySentence(${i})">${esc(s)}</span>`).join("")}
    </div>
    <div class="say-along">🗣️ 點每一句都可以單獨聽,聽完請跟著唸出聲音</div>
    <div class="action-row">
      <button class="action-btn bg-blue" onclick="A.readAll()">🔊 唸給我聽</button>
      <button class="action-btn bg-green" onclick="A.readDone()">✅ 我唸完了</button>
    </div>
  </div>`;
  setTimeout(() => A.readAll(), 500);
}
A.saySentence = i => {
  const u = UNIT_BY_ID[readState.uid];
  const sentences = splitSentences(u.story.text);
  document.querySelectorAll(".story-line").forEach(el => el.classList.remove("hl"));
  const el = document.getElementById("sl" + i); if (el) el.classList.add("hl");
  speak(sentences[i], 0.75);
};
A.readAll = () => {
  const u = UNIT_BY_ID[readState.uid];
  readState.played = true;
  speak(u.story.text, 0.72);
};
A.readDone = () => {
  const u = UNIT_BY_ID[readState.uid];
  const qs = u.cloze.map(c => {
    const m = shuffleOpts(c.opts, c.a);
    return {
      type: "cloze", item: ITEM_BY_CHAR[c.opts[c.a]] || null,
      say: c.q.replace(BLANK, "空格"), rate: 0.8,
      promptHtml: `<div class="quiz-prompt" onclick="A.sayQ()"><div class="qp-text">${esc(c.q).replace(BLANK, '<span class="blank">?</span>')}</div>
        <div class="qp-hint">🔊 點句子可以再聽一次</div></div>`,
      autoPlay: true, opts: m.opts, a: m.a,
    };
  });
  runQuiz({
    title: `第${u.id}單元 讀一讀`, emoji: "📢", back: `/unit/${u.id}`,
    help: "剛才唸過的文章,現在把少掉的字補回去。點出正確的字!",
    intro: "很好!現在把文章裡少掉的字補回去。",
    questions: qs,
    onFinish: (score, c, n) => finishLesson(u.id, "read", score, c, n),
  });
};

/* ================= 7 寫一寫(描字 + 聽寫) ================= */
let writeQueue = [], writeCtx = null;
function viewUnitWrite(id) {
  const u = UNIT_BY_ID[id];
  if (!u) return nav("/units");
  const items = shuffle(u.items.slice());
  const traceChars = items.slice(0, Math.max(1, items.length - 2)).map(it => it.w);
  const dictation = items.slice(-2); // 最後兩個字改成聽寫:先聽音選字,再描寫
  writeCtx = { uid: id, penalty: 0, dictation, dIdx: 0 };
  writeQueue = traceChars.slice();
  const step = () => {
    writeQueue.shift();
    if (writeQueue.length === 0) return startDictation();
    openTrace(writeQueue[0], `/unit/${id}`, step);
  };
  openTrace(writeQueue[0], `/unit/${id}`, step);
}
function startDictation() {
  const u = UNIT_BY_ID[writeCtx.uid];
  if (writeCtx.dIdx >= writeCtx.dictation.length) {
    const score = Math.max(0, 100 - writeCtx.penalty);
    return finishLesson(writeCtx.uid, "write", score, u.items.length, u.items.length);
  }
  const it = writeCtx.dictation[writeCtx.dIdx];
  const wrongs = distractors(it, u.items, 2);
  const opts = shuffle([it, ...wrongs]).map(x => x.w);
  const a = opts.indexOf(it.w);
  app.innerHTML = `<div class="screen">
    ${topbar(`/unit/${u.id}`, "這是聽寫。先點喇叭聽一個字,點出正確的字,然後把它寫一次。")}
    <div class="section-title">✍️ 聽寫:聽聲音,選出這個字</div>
    <button class="big-sound-btn" onclick="A.sayDict()">🔊</button>
    <div class="choice-row">
      ${opts.map((o, i) => `<button class="choice-btn" id="dc${i}" onclick="A.answerDict(${i},${a})">${o}</button>`).join("")}
    </div>
  </div>`;
  setTimeout(() => A.sayDict(), 400);
}
A.sayDict = () => { const it = writeCtx.dictation[writeCtx.dIdx]; speak(`${it.w}。${it.word}的${it.w}`); };
A.answerDict = (i, a) => {
  const it = writeCtx.dictation[writeCtx.dIdx];
  const btn = document.getElementById("dc" + i);
  if (i === a) {
    btn.classList.add("correct"); bigPop("⭕"); praise(); store.boxHit(it.w);
    setTimeout(() => {
      writeQueue = [it.w];
      openTrace(it.w, `/unit/${writeCtx.uid}`, () => { writeCtx.dIdx++; writeQueue = []; startDictation(); });
    }, 1700);
  } else {
    writeCtx.penalty += 10; store.boxAdd(it.w);
    btn.classList.add("wrong"); encourage();
    setTimeout(() => A.sayDict(), 2400);
  }
};

/* ================= 8 單元小考 ================= */
function startUnitTest(uid) {
  const u = UNIT_BY_ID[uid];
  const qs = makeMixed(u.items, u.items, [["listen", 2], ["look", 2], ["word", 3], ["sentence", 3]]);
  runQuiz({
    title: `第${uid}單元 小考`, emoji: "🏁", back: `/unit/${uid}`,
    help: "這是單元小考,一共十題。答對六題以上就過關,可以去下一個單元。慢慢來,不用急!",
    intro: "單元小考開始!一共十題,答對六題就過關。",
    questions: qs,
    onFinish: (score, c, n) => finishLesson(uid, "utest", score, c, n),
  });
}

/* ================= 總複習關 ================= */
function startReview(n) {
  if (!store.reviewUnlocked(n)) { nav("/units"); return A.reviewLocked(); }
  const recent = [];
  for (let i = n - 4; i <= n; i++) if (UNIT_BY_ID[i]) recent.push(...UNIT_BY_ID[i].items);
  const earlier = [];
  for (let i = 1; i <= n - 5; i++) if (UNIT_BY_ID[i]) earlier.push(...UNIT_BY_ID[i].items);
  const pool = recent.concat(earlier);
  const qs = makeMixed(shuffle(recent).slice(0, 10), pool, [["listen", 2], ["look", 2], ["word", 3], ["sentence", 3]]);
  if (earlier.length) {
    shuffle(earlier).slice(0, 2).forEach(it => qs.push(makeQuestion(it, pick(["listen", "word", "sentence"]), pool)));
  }
  shuffle(qs);
  runQuiz({
    title: `總複習(第 ${n - 4} 到 ${n} 單元)`, emoji: "🔁", back: "/units",
    help: "這是總複習,題目是前面學過的字。答對六成就過關,過關才能繼續往下學新的單元。",
    intro: "總複習開始!題目都是前面學過的字,慢慢想。",
    questions: qs,
    onFinish: (score, c, num) => {
      store.setReview(n, score);
      const pass = score >= PASS;
      finishScreen({
        stars: starsOf(score),
        title: pass ? `${score} 分,總複習通過!` : `${score} 分,再複習一次!`,
        sub: `答對 ${c} 題(共 ${num} 題)`,
        retry: `/review/${n}`,
        next: pass ? `/unit/${n + 1}` : `/unit/${n - 4}`,
        nextLabel: pass ? "➡️ 學新單元" : "📖 回去複習",
        note: pass ? "" : "沒關係,回去把前面的單元再看一次,再來挑戰!",
      });
    },
  });
}

/* ================= 季檢定 ================= */
function startQexam(i) {
  const e = QEXAM_BY_ID[i];
  const st = STAGE_BY_ID[i];
  if (!e) return nav("/units");
  if (!store.qexamUnlocked(i)) { nav("/units"); return A.qexamLocked(); }
  runExamLike(e, {
    title: `第${i}季 季檢定・${st.title}`, emoji: "🎯", back: "/units",
    help: "這是季檢定,像真的考試一樣自己讀題目。看不懂可以點喇叭聽。六十分就過關,過關才能進下一季。",
    onFinish: (score, c, n) => {
      store.setQexam(i, score);
      const pass = score >= PASS;
      finishScreen({
        stars: starsOf(score),
        title: pass ? `${score} 分,季檢定通過!` : `${score} 分,再加油一次!`,
        sub: pass ? `第${i}季完成了,你真的很棒!` : `答對 ${c} 題(共 ${n} 題)`,
        retry: `/qexam/${i}`,
        next: pass ? (STAGE_BY_ID[i + 1] ? `/unit/${st.units[1] + 1}` : "/exam") : "/units",
        nextLabel: pass ? (STAGE_BY_ID[i + 1] ? "➡️ 進入下一季" : "🎓 去挑戰模擬考") : "📚 回去複習",
        extraCelebrate: pass ? `恭喜你完成第${i}季!${STAGE_BY_ID[i + 1] ? "下一季打開了!" : ""}` : null,
      });
    },
  });
}

/* ================= 模擬考(仿全民中檢初等) ================= */
function viewExams() {
  const unlocked = store.examUnlocked();
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是檢定挑戰,題目模仿正式的中文檢定考試。通過任何一季的季檢定就可以來考,想考幾次都可以。八十分算通過。")}
    <div class="section-title">🎓 檢定挑戰</div>
    <div class="sub-note">${unlocked ? "每回 10 題,80 分以上通過!考幾次都可以。" : "🔒 通過第一季的季檢定,這裡就會打開!"}</div>
    <div class="lesson-list">
      ${EXAMS.map(e => {
        const sc = store.examScore(e.id);
        return `<div class="lesson-card ${sc >= 80 ? "done" : ""} ${unlocked ? "" : "locked"}"
          onclick="${unlocked ? `A.nav('/exam/${e.id}')` : "A.examLocked()"}">
          <span class="l-emoji">${unlocked ? e.emoji : "🔒"}</span>
          <span class="l-title">${e.title}<div style="font-size:20px;color:#7a6a58;font-weight:normal">${sc ? `${sc} 分` : "選字・聽寫・讀句子"}</div></span>
          <span class="l-stars">${"⭐".repeat(starsOf(sc))}${"☆".repeat(3 - starsOf(sc))}</span>
        </div>`;
      }).join("")}
    </div>
    <div class="sub-note" style="margin-top:20px">題型參考全民中文能力檢定(初等),都是原創練習題。<br>三回都考到 80 分,就拿到「檢定小狀元」徽章 🏵️</div>
  </div>`;
}
A.examLocked = () => speak("檢定挑戰還沒打開喔!先通過第一季的季檢定,就可以來考考看了。");

function runExamLike(e, cfg) {
  const qs = e.questions.map(q => {
    const isListen = q.t === "聽";
    const m = shuffleOpts(q.opts, q.a);
    return {
      type: "exam", item: null,
      say: isListen ? q.say : q.q.replace(BLANK, "空格"), rate: isListen ? 1 : 0.8,
      autoPlay: isListen,
      promptHtml: isListen
        ? `<button class="big-sound-btn" onclick="A.sayQ()">🔊</button><div class="sub-note">${esc(q.q)}</div>`
        : `<div class="quiz-prompt"><div class="qp-text" style="font-size:32px">${esc(q.q).replace(BLANK, '<span class="blank">?</span>')}</div>
           <div class="qp-hint" onclick="A.sayQ()">🔊 點我聽題目</div></div>`,
      opts: m.opts, a: m.a,
    };
  });
  runQuiz({
    title: cfg.title, emoji: cfg.emoji, back: cfg.back, help: cfg.help,
    intro: "考試開始!慢慢看題目,不會的可以點喇叭聽。",
    questions: qs, onFinish: cfg.onFinish,
  });
}
function startExam(id) {
  const e = EXAM_BY_ID[id];
  if (!e) return nav("/exam");
  if (!store.examUnlocked()) { viewExams(); return A.examLocked(); }
  runExamLike(e, {
    title: e.title, emoji: e.emoji, back: "/exam",
    help: "像真的考試一樣,自己讀題目,從四個選項裡點出正確答案。看不懂可以點藍色喇叭把題目唸給你聽。",
    onFinish: (score, c, n) => {
      store.setExam(id, score);
      const passed = score >= 80;
      const nextExam = EXAMS.find(x => store.examScore(x.id) < 80);
      finishScreen({
        stars: starsOf(score),
        title: score === 100 ? "一百分!太厲害了!" : passed ? `${score} 分,通過了!` : `${score} 分,再練習一下!`,
        sub: passed ? "已經有檢定的實力囉!" : `答對 ${c} 題(共 ${n} 題)`,
        retry: `/exam/${id}`,
        next: passed && nextExam ? `/exam/${nextExam.id}` : "/exam",
        nextLabel: passed && nextExam ? "➡️ 下一回" : "📋 回列表",
      });
    },
  });
}

/* ================= 每日挑戰(每天換題,永遠有得玩) ================= */
function startDaily() {
  const learned = store.learnedChars();
  if (!learned.length) { nav("/"); return speak("先去識字單元學第一課,每日挑戰就會打開囉!"); }
  const day = todayStr();
  const rnd = seededRand("daily-" + day + "-" + learned.length);
  const items = seededShuffle(learned.slice(), rnd).slice(0, 10);
  const plan = [["listen", 3], ["look", 2], ["word", 2], ["sentence", 3]];
  const qs = makeMixed(items, learned, plan, learned.length >= 12 ? 4 : 3, rnd);
  runQuiz({
    title: "每日挑戰", emoji: "📅", back: "/",
    help: "每日挑戰的題目,是從你學過的字裡面出的。每天都不一樣,天天都可以來玩。",
    intro: "今天的挑戰開始!題目都是你學過的字。",
    questions: qs,
    onFinish: (score, c, n) => {
      store.setDaily(score);
      finishScreen({
        stars: starsOf(score),
        title: score >= 80 ? `${score} 分,今天狀態真好!` : `${score} 分,今天也有進步!`,
        sub: `答對 ${c} 題(共 ${n} 題)・已完成 ${store.data.dailyCount} 次每日挑戰`,
        retry: "/daily", retryLabel: "🔁 再玩一次",
        next: "/", nextLabel: "🏠 回首頁",
        note: "明天再來,會有新的題目喔!",
      });
    },
  });
}

/* ================= 闖關塔(無限層,越爬越難) ================= */
function startTower(floor) {
  const learned = store.learnedChars();
  if (!learned.length) { nav("/"); return speak("先去識字單元學第一課,闖關塔就會打開囉!"); }
  const f = Math.max(1, floor || store.towerBest() + 1);
  const optCount = f >= 6 && learned.length >= 8 ? 4 : 3;
  const kinds = f >= 11 ? [["listen", 2], ["word", 2], ["sentence", 2]] :
                f >= 4 ? [["listen", 2], ["look", 1], ["word", 1], ["sentence", 1]] :
                         [["listen", 2], ["look", 2], ["word", 1]];
  const items = shuffle(learned.slice()).slice(0, 8);
  const qs = makeMixed(items, learned, kinds, optCount);
  runQuiz({
    title: `闖關塔 第 ${f} 層`, emoji: "🗼", back: "/tower",
    help: "闖關塔一層比一層難,答對六成就可以上一層。爬到第幾層都可以,沒有盡頭,想休息隨時可以回家。",
    intro: `第 ${f} 層,開始!`,
    questions: qs,
    onFinish: (score, c, n) => {
      const pass = score >= PASS;
      if (pass) store.setTower(f);
      finishScreen({
        stars: starsOf(score),
        title: pass ? `過關!你在第 ${f} 層` : `${score} 分,這一層再試一次!`,
        sub: `答對 ${c} 題(共 ${n} 題)・最高紀錄 ${store.towerBest()} 層`,
        retry: `/tower/${f}`, retryLabel: pass ? "🔁 再爬一次這層" : "🔁 再試一次",
        next: pass ? `/tower/${f + 1}` : "/tower",
        nextLabel: pass ? `⬆️ 上第 ${f + 1} 層` : "🗼 回闖關塔",
      });
    },
  });
}
function viewTower() {
  const best = store.towerBest();
  const open = store.practiceOpen();
  app.innerHTML = `<div class="screen">
    ${topbar("/", "闖關塔沒有盡頭,一層一層往上爬。題目都是你學過的字,越高層越難。爬累了隨時可以回家休息。")}
    <div class="section-title">🗼 闖關塔</div>
    <div class="streak-banner">
      <div class="fire">🗼</div>
      <div class="s-text">最高爬到 ${best} 層</div>
      <div style="font-size:22px;color:#7a6a58">${open ? "題目從你學過的字裡面出,越爬越難" : "先去識字單元學第一課就會打開"}</div>
    </div>
    <div class="action-row">
      <button class="action-btn bg-green" onclick="${open ? `A.nav('/tower/${best + 1}')` : "A.practiceLocked()"}">⬆️ 挑戰第 ${best + 1} 層</button>
    </div>
    ${best > 0 ? `<div class="action-row"><button class="action-btn bg-blue" onclick="A.nav('/tower/1')">🔁 從第 1 層重新爬</button></div>` : ""}
  </div>`;
}
A.practiceLocked = () => speak("先去識字單元學第一課,這裡就會打開囉!");

/* ================= 朗讀練習室 ================= */
function viewReading() {
  const units = UNITS.filter(u => store.lessonScore(u.id, "learn") >= PASS && u.story);
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是朗讀練習室。學過的短文和句子都在這裡,想唸哪一篇就點哪一篇。點了會先唸給你聽,你再跟著唸。")}
    <div class="section-title">📢 朗讀練習</div>
    ${units.length === 0 ? `<div class="sub-note">先去識字單元學第一課,這裡就會有文章囉!</div>` : ""}
    ${units.map(u => `<div class="phrase-card" onclick="A.nav('/reading/${u.id}')">
      <div class="p-emoji">${u.emoji}</div>
      <div class="p-text">${esc(u.story.title)}<div style="font-size:20px;color:#7a6a58">第${u.id}單元 ${esc(u.title)}</div></div>
    </div>`).join("")}
    ${units.length ? `<div class="section-title" style="margin-top:24px">💬 生活常用句</div>` : ""}
    ${units.flatMap(u => u.phrases).map(ph => `<div class="phrase-card" onclick="speak('${esc(ph.t)}', 0.75)">
      <div class="p-emoji">${ph.e}</div><div class="p-text">${esc(ph.t)}</div>
    </div>`).join("")}
  </div>`;
}
function viewReadingOne(id) {
  const u = UNIT_BY_ID[id];
  if (!u || !u.story) return nav("/reading");
  const sentences = splitSentences(u.story.text);
  app.innerHTML = `<div class="screen">
    ${topbar("/reading", "先點藍色按鈕聽一次,再自己唸出聲音。也可以點單獨一句,一句一句慢慢練。")}
    <div class="section-title">📢 ${esc(u.story.title)}</div>
    <div class="story-box">
      ${sentences.map((s, i) => `<span class="story-line" onclick="A.sayOne(${id},${i})" id="rl${i}">${esc(s)}</span>`).join("")}
    </div>
    <div class="say-along">🗣️ 唸出聲音,對記憶最有幫助!</div>
    <div class="action-row">
      <button class="action-btn bg-blue" onclick="speak(READ_TEXT, 0.72)">🔊 整篇唸給我聽</button>
      <button class="action-btn bg-green" onclick="A.readPractised(${id})">✅ 我唸完了</button>
    </div>
  </div>`;
  window.READ_TEXT = u.story.text;
}
A.sayOne = (id, i) => {
  const u = UNIT_BY_ID[id];
  const sentences = splitSentences(u.story.text);
  document.querySelectorAll(".story-line").forEach(el => el.classList.remove("hl"));
  const el = document.getElementById("rl" + i); if (el) el.classList.add("hl");
  speak(sentences[i], 0.75);
};
A.readPractised = id => {
  store.stampToday(); store.data.stars += 1; store.checkBadges(); store.save();
  confetti(12); applause(1.2); bigPop("👍");
  speak("唸得很好!多唸幾次,字就會記得更牢。");
  setTimeout(() => nav("/reading"), 2200);
};

/* ================= 錯字複習箱 ================= */
function viewBox() {
  const list = store.boxList();
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡放的是你答錯過的字。多練幾次,答對了就會從這裡消失。這是最有效的複習方法!")}
    <div class="section-title">🔁 錯字複習</div>
    ${list.length === 0
      ? `<div class="streak-banner"><div class="fire">🎉</div><div class="s-text">沒有要複習的字!</div>
         <div style="font-size:22px;color:#7a6a58">你都答對了,真棒!</div></div>`
      : `<div class="sub-note">有 ${list.length} 個字要多練習</div>
         <div class="symbol-grid">${list.map(ch => `<button class="symbol-btn" onclick="A.nav('/write/${ch}')">${ch}</button>`).join("")}</div>
         <div class="action-row"><button class="action-btn bg-green" onclick="A.nav('/box/go')">▶️ 開始複習</button></div>`}
  </div>`;
}
function startBoxQuiz() {
  const list = store.boxList();
  if (!list.length) { nav("/box"); return speak("沒有要複習的字,你都答對了!"); }
  const items = list.map(ch => ITEM_BY_CHAR[ch]).filter(Boolean);
  const pool = store.learnedChars().length >= 4 ? store.learnedChars() : ALL_ITEMS;
  const qs = [];
  items.slice(0, 8).forEach(it => {
    qs.push(makeQuestion(it, "listen", pool));
    qs.push(makeQuestion(it, "sentence", pool));
  });
  runQuiz({
    title: "錯字複習", emoji: "🔁", back: "/box",
    help: "這些是你答錯過的字。每個字會考兩次,答對了就從複習箱拿掉。",
    intro: "我們把不熟的字再練一次!",
    questions: shuffle(qs),
    onFinish: (score, c, n) => {
      const left = store.boxCount();
      if (left === 0) store.checkBadges();
      store.stampToday(); store.save();
      finishScreen({
        stars: starsOf(score),
        title: left === 0 ? "全部複習完了,太棒了!" : `複習完成!還有 ${left} 個字`,
        sub: `答對 ${c} 題(共 ${n} 題)`,
        retry: "/box/go", next: "/", nextLabel: "🏠 回首頁",
      });
    },
  });
}

/* ================= 手寫板(共用) ================= */
let traceDone = null, traceChar = "", hasInk = false, drawing = false, lastX = 0, lastY = 0;
function charInfo(ch) {
  const it = ITEM_BY_CHAR[ch];
  if (it) return { word: it.word, e: it.e, say: `${ch}。${it.word}的${ch}` };
  if (typeof SYM !== "undefined" && SYM[ch]) return { word: SYM[ch].word, e: SYM[ch].emoji, say: `${SYM[ch].sound}。${SYM[ch].word}的${SYM[ch].sound}` };
  return { word: ch, e: "✏️", say: ch };
}
function openTrace(ch, backPath, onDone) {
  traceChar = ch; traceDone = onDone || null; hasInk = false;
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
  if (!canvas) return;
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

/* ================= 補充教材:注音總表與學習卡 ================= */
function viewBpmf() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是所有的注音符號,是幫助你學發音的補充教材。想學哪一個,就用手指點它,它就會唸給你聽。")}
    <div class="sub-note">💡 注音是幫忙學發音的工具,不用先學完也可以去識字單元認字。</div>
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

/* ================= 補充教材:注音闖關 ================= */
function viewGames() {
  app.innerHTML = `<div class="screen">
    ${topbar("/", "選一關來玩!聽聲音,找出正確的注音符號,就可以拿星星。這是補充教材,想玩就玩,不會影響識字課程。")}
    <div class="section-title">🎧 注音闖關</div>
    <div class="sub-note">💡 補充教材,隨時可以玩。十關全過可以拿「注音小老師」徽章 🎓</div>
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

let bq = null;
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
  const wasDone = store.bpmfDone();
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
    extraCelebrate: !wasDone && store.bpmfDone() ? "哇!注音十關全部過關!你是注音小老師!" : null,
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
  app.innerHTML = `<div class="screen">
    ${topbar("/", "這裡是你的獎勵!上面是連續學習的天數,中間的月曆,每天有學習就會蓋一個星星章。下面是你得到的徽章。")}
    <div class="streak-banner">
      <div class="fire">🔥</div>
      <div class="s-text">連續學習 ${store.streakNow()} 天</div>
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
  if ((m = p.match(/^\/unit\/(\d+)\/([a-z]+)$/))) {
    const id = +m[1], key = m[2];
    const u = UNIT_BY_ID[id];
    if (!u || !LESSON_BY_KEY[key]) return nav("/units");
    if (!store.unitUnlocked(id)) { nav("/units"); return A.lockedMsg(id); }
    if (!store.lessonUnlocked(id, key)) { viewUnit(id); return A.lessonLocked(); }
    if (key === "learn") return viewUnitLearn(id);
    if (key === "read") return viewUnitRead(id);
    if (key === "write") return viewUnitWrite(id);
    if (key === "utest") return startUnitTest(id);
    return startUnitQuiz(id, key);
  }
  if ((m = p.match(/^\/unit\/(\d+)$/))) return viewUnit(+m[1]);
  if ((m = p.match(/^\/review\/(\d+)$/))) return startReview(+m[1]);
  if ((m = p.match(/^\/qexam\/(\d+)$/))) return startQexam(+m[1]);
  if (p === "/exam") return viewExams();
  if ((m = p.match(/^\/exam\/(\d+)$/))) return startExam(+m[1]);
  if (p === "/daily") return startDaily();
  if (p === "/tower") return viewTower();
  if ((m = p.match(/^\/tower\/(\d+)$/))) return startTower(+m[1]);
  if (p === "/reading") return viewReading();
  if ((m = p.match(/^\/reading\/(\d+)$/))) return viewReadingOne(+m[1]);
  if (p === "/box") return viewBox();
  if (p === "/box/go") return startBoxQuiz();
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
