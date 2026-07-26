// 進度儲存:localStorage 為主,Cloudflare KV 同步(免登入,用「學號」還原)
const STORE_KEY = "ttxz-v1";

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 去掉易混淆的 I O 0 1
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const store = {
  data: null,
  load() {
    try { this.data = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    if (!this.data || !this.data.code) {
      this.data = {
        code: genCode(), stars: 0, updatedAt: 0,
        days: {},                 // "2026-07-26": true(每天完成任一關卡就蓋章)
        streak: { last: "", count: 0 },
        bpmf: { levels: {}, practiced: {} },
        units: {},                // unitId: { learn:0-3, listen:0-3, look:0-3, sentence:0-3, write:0-3 }
        badges: {},               // badgeId: true
      };
      this.save();
    }
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
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      return { ok: true };
    } catch (e) { return { ok: false, msg: "網路連不上,等一下再試" }; }
  },
  async syncFromCloud() {
    // 開站時:若雲端資料比較新就用雲端的
    try {
      const remote = await this.pull(this.data.code);
      if (remote && remote.updatedAt > (this.data.updatedAt || 0)) {
        this.data = remote;
        localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
        return true;
      }
    } catch (e) {}
    return false;
  },

  // ---- 學習進度 ----
  unit(id) {
    if (!this.data.units[id]) this.data.units[id] = { learn: 0, listen: 0, look: 0, sentence: 0, write: 0 };
    return this.data.units[id];
  },
  setLesson(unitId, key, stars) {
    const u = this.unit(unitId);
    const gained = Math.max(0, stars - (u[key] || 0));
    if (gained > 0) { u[key] = stars; this.data.stars += gained; }
    this.stampToday();
    this.checkBadges();
    this.save();
    return gained;
  },
  unitDone(id) {
    const u = this.data.units[id];
    return !!u && LESSONS.every(l => (u[l.key] || 0) >= 1);
  },
  unitStars(id) {
    const u = this.data.units[id];
    if (!u) return 0;
    return LESSONS.reduce((s, l) => s + (u[l.key] || 0), 0);
  },
  unitUnlocked(id) {
    if (id === 1) return true;
    return this.unitDone(id - 1);
  },
  knownChars() {
    const set = new Set();
    UNITS.forEach(u => {
      if ((this.unit(u.id).learn || 0) >= 1) u.items.forEach(it => set.add(it.w));
    });
    return set.size;
  },
  // ---- 每日蓋章與連續天數 ----
  stampToday() {
    const t = todayStr();
    if (this.data.days[t]) return;
    this.data.days[t] = true;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    this.data.streak.count = (this.data.streak.last === yStr) ? this.data.streak.count + 1 : 1;
    this.data.streak.last = t;
  },
  streakNow() {
    const t = todayStr();
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yStr = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    if (this.data.streak.last === t || this.data.streak.last === yStr) return this.data.streak.count;
    return 0;
  },
  // ---- 徽章 ----
  checkBadges() {
    const b = this.data.badges;
    const newly = [];
    const earn = id => { if (!b[id]) { b[id] = true; newly.push(BADGES.find(x => x.id === id)); } };
    const anyLesson = Object.values(this.data.units).some(u => LESSONS.some(l => (u[l.key] || 0) >= 1));
    if (anyLesson) earn("first-lesson");
    if (UNITS.some(u => this.unitDone(u.id))) earn("first-unit");
    if (UNITS.every(u => this.unitDone(u.id))) earn("all-units");
    const s = this.streakNow();
    if (s >= 3) earn("streak-3");
    if (s >= 7) earn("streak-7");
    if (s >= 30) earn("streak-30");
    const k = this.knownChars();
    if (k >= 30) earn("chars-30");
    if (k >= 60) earn("chars-60");
    if (k >= 100) earn("chars-100");
    if (BPMF_LEVELS.every((_, i) => (this.data.bpmf.levels[i] || 0) >= 1)) earn("bpmf-all");
    return newly;
  },
};
store.load();
