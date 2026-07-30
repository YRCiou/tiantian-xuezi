// 進度儲存:localStorage 為主,Cloudflare KV 同步(免登入,用「學號」還原)
// v2:關卡改百分制(60 分過關),新增總複習、季檢定、錯字複習箱、每日挑戰、闖關塔
const STORE_KEY = "ttxz-v1";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 I O 0 1
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function todayStr(d) {
  d = d || new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function starsOf(score) { return score >= 100 ? 3 : score >= 80 ? 2 : score >= PASS ? 1 : 0; }

const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    if (!this.data || !this.data.code) {
      this.data = {
        v: 2, code: genCode(), stars: 0, updatedAt: 0,
        days: {},                 // "2026-07-26": true(每天完成任一關卡就蓋章)
        streak: { last: "", count: 0 },
        bpmf: { levels: {}, practiced: {} },
        units: {},                // unitId: { learn..utest: 0-100 }
        reviews: {}, qexams: {}, exams: {},
        reviewBox: {},            // 字: { miss, last }
        daily: {}, dailyCount: 0, // 每日挑戰
        tower: { best: 0 },       // 闖關塔最高層
        badges: {},
      };
      this.save();
    }
    this.migrate();
  },
  // ---- 舊版(星星制)資料遷移 ----
  migrate() {
    const d = this.data;
    if (d.v >= 2) { this.ensureFields(); return; }
    const toScore = s => (s >= 3 ? 100 : s >= 2 ? 80 : s >= 1 ? 60 : 0);
    const OLD_KEYS = ["learn", "listen", "look", "sentence", "write"];
    Object.keys(d.units || {}).forEach(id => {
      const u = d.units[id];
      const oldDone = OLD_KEYS.every(k => (u[k] || 0) >= 1); // 舊制五關全過
      OLD_KEYS.forEach(k => { u[k] = toScore(u[k] || 0); });
      // 新增的三關:舊制已完成的單元直接補及格,不讓老學員進度倒退
      u.word = oldDone ? 60 : 0;
      u.read = oldDone ? 60 : 0;
      u.utest = oldDone ? 60 : 0;
    });
    Object.keys(d.exams || {}).forEach(id => { d.exams[id] = toScore(d.exams[id]); });
    d.reviews = d.reviews || {};
    // 舊制完成的單元,對應的總複習關也視為通過
    REVIEW_POINTS.forEach(n => {
      const all = [];
      for (let i = n - 4; i <= n; i++) all.push(d.units[i]);
      if (all.every(u => u && u.utest >= PASS)) d.reviews[n] = 60;
    });
    d.v = 2;
    this.ensureFields();
    this.save();
  },
  ensureFields() {
    const d = this.data;
    d.reviews = d.reviews || {}; d.qexams = d.qexams || {}; d.exams = d.exams || {};
    d.reviewBox = d.reviewBox || {}; d.daily = d.daily || {}; d.tower = d.tower || { best: 0 };
    if (typeof d.dailyCount !== "number") d.dailyCount = Object.keys(d.daily).length;
    d.bpmf = d.bpmf || { levels: {}, practiced: {} };
  },
  save() {
    this.data.updatedAt = Date.now();
    localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
    this.pushSoon();
  },
  // ---- 雲端同步(Cloudflare KV) ----
  _pushTimer: null,
  pushSoon() {
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this.push(), 1500);
  },
  async push() {
    try {
      await fetch("/api/progress/" + this.data.code, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(this.data),
      });
    } catch (e) { /* 離線也沒關係,下次再同步 */ }
  },
  async pull(code) {
    const r = await fetch("/api/progress/" + code);
    if (!r.ok) return null;
    return await r.json();
  },
  async restore(code) {
    code = (code || "").trim().toUpperCase();
    if (code.length !== 6) return { ok: false, msg: "學號是 6 個字喔" };
    try {
      const remote = await this.pull(code);
      if (!remote || !remote.code) return { ok: false, msg: "找不到這個學號" };
      this.data = remote;
      this.migrate();
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      return { ok: true };
    } catch (e) { return { ok: false, msg: "網路連不上,等一下再試" }; }
  },
  async syncFromCloud() {
    try {
      const remote = await this.pull(this.data.code);
      if (remote && remote.updatedAt > (this.data.updatedAt || 0)) {
        this.data = remote;
        this.migrate();
        localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
        return true;
      }
    } catch (e) {}
    return false;
  },

  // ---- 單元關卡(百分制) ----
  unit(id) {
    if (!this.data.units[id]) {
      this.data.units[id] = {};
      LESSONS.forEach(l => { this.data.units[id][l.key] = 0; });
    }
    return this.data.units[id];
  },
  lessonScore(unitId, key) { return this.unit(unitId)[key] || 0; },
  setLesson(unitId, key, score) {
    const u = this.unit(unitId);
    const before = starsOf(u[key] || 0);
    if (score > (u[key] || 0)) u[key] = score;
    const gained = Math.max(0, starsOf(u[key]) - before);
    this.data.stars += gained;
    this.stampToday();
    this.checkBadges();
    this.save();
    return gained;
  },
  lessonUnlocked(unitId, key) {
    const i = LESSONS.findIndex(l => l.key === key);
    if (i <= 0) return true;
    return this.lessonScore(unitId, LESSONS[i - 1].key) >= PASS;
  },
  unitDone(id) { return this.lessonScore(id, "utest") >= PASS; },
  unitProgress(id) { return LESSONS.filter(l => this.lessonScore(id, l.key) >= PASS).length; },
  unitStars(id) { return LESSONS.reduce((s, l) => s + starsOf(this.lessonScore(id, l.key)), 0); },
  unitUnlocked(id) {
    if (id === 1) return true;                       // 識字是主課程,第一關直接開放
    if (!this.unitDone(id - 1)) return false;        // 前一個單元要考過小考
    if (REVIEW_POINTS.includes(id - 1) && this.reviewScore(id - 1) < PASS) return false;
    const st = stageOfUnit(id);
    if (st.units[0] === id && st.id > 1 && this.qexamScore(st.id - 1) < PASS) return false;
    return true;
  },
  unitLockReason(id) {
    if (this.unitUnlocked(id)) return "";
    const st = stageOfUnit(id);
    if (st.units[0] === id && st.id > 1 && this.qexamScore(st.id - 1) < PASS)
      return `先通過第 ${st.id - 1} 季的季檢定`;
    if (REVIEW_POINTS.includes(id - 1) && this.unitDone(id - 1) && this.reviewScore(id - 1) < PASS)
      return `先過第 ${id - 1} 單元後的總複習`;
    return `先完成第 ${id - 1} 單元`;
  },

  // ---- 總複習關 ----
  reviewScore(n) { return this.data.reviews[n] || 0; },
  setReview(n, score) {
    const before = starsOf(this.reviewScore(n));
    if (score > this.reviewScore(n)) this.data.reviews[n] = score;
    this.data.stars += Math.max(0, starsOf(this.data.reviews[n]) - before);
    this.stampToday(); this.checkBadges(); this.save();
  },
  reviewUnlocked(n) {
    for (let i = n - 4; i <= n; i++) if (!this.unitDone(i)) return false;
    return true;
  },

  // ---- 季檢定 ----
  qexamScore(i) { return this.data.qexams[i] || 0; },
  setQexam(i, score) {
    const before = starsOf(this.qexamScore(i));
    if (score > this.qexamScore(i)) this.data.qexams[i] = score;
    this.data.stars += Math.max(0, starsOf(this.data.qexams[i]) - before);
    this.stampToday(); this.checkBadges(); this.save();
  },
  qexamUnlocked(i) {
    const st = STAGE_BY_ID[i];
    if (!st) return false;
    for (let u = st.units[0]; u <= st.units[1]; u++) if (!this.unitDone(u)) return false;
    return REVIEW_POINTS.filter(n => n >= st.units[0] && n <= st.units[1]).every(n => this.reviewScore(n) >= PASS);
  },
  stageDone(i) { return this.qexamScore(i) >= PASS; },

  // ---- 模擬考(通過任一季檢定就開放,超前的人不用等到年底) ----
  examScore(id) { return this.data.exams[id] || 0; },
  setExam(id, score) {
    const before = starsOf(this.examScore(id));
    if (score > this.examScore(id)) this.data.exams[id] = score;
    this.data.stars += Math.max(0, starsOf(this.data.exams[id]) - before);
    this.stampToday(); this.checkBadges(); this.save();
  },
  examUnlocked() { return STAGES.some(s => this.qexamScore(s.id) >= PASS); },

  // ---- 錯字複習箱 ----
  boxAdd(ch) {
    if (!ch || !ALL_CHARS.has(ch)) return;
    const b = this.data.reviewBox;
    b[ch] = { miss: Math.min(3, (b[ch] ? b[ch].miss : 0) + 1), last: todayStr() };
    this.save();
  },
  boxHit(ch) {
    const b = this.data.reviewBox;
    if (!b[ch]) return;
    b[ch].miss -= 1;
    if (b[ch].miss <= 0) delete b[ch];
    this.save();
  },
  boxList() { return Object.keys(this.data.reviewBox).filter(ch => ALL_CHARS.has(ch)); },
  boxCount() { return this.boxList().length; },

  // ---- 每日挑戰 ----
  dailyDone(day) { return !!this.data.daily[day || todayStr()]; },
  dailyScore(day) { return this.data.daily[day || todayStr()] || 0; },
  setDaily(score) {
    const t = todayStr();
    if (!this.data.daily[t]) this.data.dailyCount += 1;
    if (score > (this.data.daily[t] || 0)) this.data.daily[t] = score;
    this.data.stars += 1;
    this.stampToday(); this.checkBadges(); this.save();
  },

  // ---- 闖關塔 ----
  towerBest() { return (this.data.tower && this.data.tower.best) || 0; },
  setTower(floor) {
    if (floor > this.towerBest()) { this.data.tower.best = floor; this.data.stars += 1; }
    this.stampToday(); this.checkBadges(); this.save();
  },

  // ---- 學過的字 ----
  learnedChars() {
    const out = [];
    UNITS.forEach(u => {
      if (this.lessonScore(u.id, "learn") >= PASS) u.items.forEach(it => out.push(it));
    });
    return out;
  },
  knownChars() { return this.learnedChars().length; },
  practiceOpen() { return this.knownChars() > 0; },
  bpmfDone() { return BPMF_LEVELS.every((_, i) => (this.data.bpmf.levels[i] || 0) >= 1); },
  allUnitsDone() { return UNITS.every(u => this.unitDone(u.id)); },

  // ---- 每日蓋章與連續天數 ----
  stampToday() {
    const t = todayStr();
    if (this.data.days[t]) return;
    this.data.days[t] = true;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = todayStr(y);
    this.data.streak.count = (this.data.streak.last === yStr) ? this.data.streak.count + 1 : 1;
    this.data.streak.last = t;
  },
  streakNow() {
    const t = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = todayStr(y);
    if (this.data.streak.last === t || this.data.streak.last === yStr) return this.data.streak.count;
    return 0;
  },

  // ---- 徽章 ----
  checkBadges() {
    const b = this.data.badges;
    const newly = [];
    const earn = id => { if (!b[id]) { b[id] = true; newly.push(BADGES.find(x => x.id === id)); } };
    if (Object.values(this.data.units).some(u => LESSONS.some(l => (u[l.key] || 0) >= PASS))) earn("first-lesson");
    if (UNITS.some(u => this.unitDone(u.id))) earn("first-unit");
    if (this.allUnitsDone()) earn("all-units");
    const s = this.streakNow();
    if (s >= 3) earn("streak-3");
    if (s >= 7) earn("streak-7");
    if (s >= 30) earn("streak-30");
    const k = this.knownChars();
    if (k >= 30) earn("chars-30");
    if (k >= 60) earn("chars-60");
    if (k >= 100) earn("chars-100");
    if (k >= 200) earn("chars-200");
    if (k >= 400) earn("chars-400");
    STAGES.forEach(st => { if (this.stageDone(st.id)) earn("season-" + st.id); });
    if (REVIEW_POINTS.every(n => this.reviewScore(n) >= PASS)) earn("review-master");
    if (STAGES.every(st => this.qexamScore(st.id) >= PASS)) earn("qexam-all");
    if (this.data.dailyCount >= 7) earn("daily-7");
    if (this.data.dailyCount >= 30) earn("daily-30");
    if (this.towerBest() >= 10) earn("tower-10");
    if (this.towerBest() >= 30) earn("tower-30");
    if (this.bpmfDone()) earn("bpmf-all");
    if (EXAMS.every(e => this.examScore(e.id) >= 80)) earn("exam-pass");
    return newly;
  },
};
store.load();
