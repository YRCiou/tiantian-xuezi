// 課程資料驗證:改完 units*.js / qexam.js / exam.js 後執行
//   node scripts/validate-data.js
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public", "js", "data");

const g = {};
const src = ["bpmf.js", "stages.js", "units.js", "units-s2.js", "units-s3.js", "units-s4.js", "all.js", "qexam.js", "exam.js"]
  .map(f => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
new Function("g", src + "\n['UNITS','UNIT_BY_ID','LESSONS','BADGES','STAGES','REVIEW_POINTS','PASS','QEXAMS','EXAMS','SYMBOLS','BPMF_LEVELS','ALL_CHARS']" +
  ".forEach(k => { try { g[k] = eval(k); } catch (e) {} });")(g);

const errs = [];
const warns = [];
const err = m => errs.push(m);
const BAD_CHARS = /['\\<>&"]/;
const ZY_OK = /^[\u3105-\u3129ˊˇˋ˙]+$/;
const BLANK = /（\s*）|（　+）|\(　*\)|（　*\)/;

// ---- 單元 ----
const seen = new Map();
const textFields = [];
g.UNITS.forEach(u => {
  const at = `單元 ${u.id}`;
  if (!u.title || !u.emoji) err(`${at}: 缺 title 或 emoji`);
  if (!u.stage || u.stage < 1 || u.stage > 4) err(`${at}: stage 不正確`);
  if (!Array.isArray(u.items) || u.items.length < 8 || u.items.length > 14) err(`${at}: items 數量 ${u.items && u.items.length}`);
  if (!Array.isArray(u.phrases) || u.phrases.length < 4) err(`${at}: phrases 少於 4 句`);
  textFields.push([at + " title", u.title]);
  u.items.forEach(it => {
    const w = it.w;
    if (!w || [...w].length !== 1) return err(`${at}: w 必須是單一個字(${w})`);
    if (seen.has(w)) err(`${at}: 字「${w}」與單元 ${seen.get(w)} 重複`);
    else seen.set(w, u.id);
    if (!ZY_OK.test(it.zy || "")) err(`${at} ${w}: 注音格式怪怪的(${it.zy})`);
    if (!it.e) err(`${at} ${w}: 缺 emoji`);
    if (!it.word || !it.word.includes(w)) err(`${at} ${w}: word「${it.word}」沒有包含這個字`);
    if (!Array.isArray(it.words) || !it.words.length) err(`${at} ${w}: 缺 words`);
    else {
      if (it.words[0] !== it.word) err(`${at} ${w}: words[0] 應該等於 word`);
      it.words.forEach(x => { if (!x.includes(w)) err(`${at} ${w}: 詞語「${x}」沒有包含這個字`); });
    }
    if (!it.s || !it.s.includes(w)) err(`${at} ${w}: 例句沒有包含這個字`);
    if (it.s && [...it.s].length > 16) warns.push(`${at} ${w}: 例句有點長(${[...it.s].length} 字)`);
    textFields.push([`${at} ${w}`, it.word], [`${at} ${w}`, it.s], ...(it.words || []).map(x => [`${at} ${w} 詞語`, x]));
  });
  u.phrases.forEach(p => { if (!p.t || !p.e) err(`${at}: phrase 缺 t 或 e`); textFields.push([at + " 常用句", p.t]); });
  // 朗讀短文
  if (!u.story || !u.story.title || !u.story.text) err(`${at}: 缺 story`);
  else {
    const n = [...u.story.text].length;
    if (n < 25 || n > 90) warns.push(`${at}: 短文長度 ${n} 字`);
    textFields.push([at + " 短文", u.story.text], [at + " 短文標題", u.story.title]);
  }
  if (!Array.isArray(u.cloze) || u.cloze.length !== 3) err(`${at}: cloze 應該有 3 題`);
  else u.cloze.forEach((c, i) => {
    const cat = `${at} 填空第 ${i + 1} 題`;
    if (!BLANK.test(c.q)) err(`${cat}: 題目沒有空格記號`);
    if (!Array.isArray(c.opts) || c.opts.length !== 3) err(`${cat}: 應該有 3 個選項`);
    else if (new Set(c.opts).size !== 3) err(`${cat}: 選項重複`);
    if (typeof c.a !== "number" || c.a < 0 || c.a >= (c.opts || []).length) err(`${cat}: a 超出範圍`);
    else {
      const filled = c.q.replace(BLANK, c.opts[c.a]);
      if (u.story && !u.story.text.includes(filled.replace(/[。,!?]$/, "").slice(-6))) {
        warns.push(`${cat}: 填回正解後,句子在短文裡找不到`);
      }
    }
    textFields.push([cat, c.q], ...c.opts.map(o => [cat + " 選項", o]));
  });
});

// ---- 考卷(季檢定 + 模擬考) ----
[["季檢定", g.QEXAMS], ["模擬考", g.EXAMS]].forEach(([label, list]) => {
  list.forEach(e => {
    const at = `${label} ${e.id}`;
    if (e.questions.length !== 10) err(`${at}: 應該有 10 題,實際 ${e.questions.length}`);
    e.questions.forEach((q, i) => {
      const qat = `${at} 第 ${i + 1} 題`;
      if (!q.opts || q.opts.length !== 4) err(`${qat}: 應該有 4 個選項`);
      else if (new Set(q.opts).size !== 4) err(`${qat}: 選項重複`);
      if (typeof q.a !== "number" || q.a < 0 || q.a > 3) err(`${qat}: a 超出範圍`);
      if (q.t === "聽" && !q.say) err(`${qat}: 聽力題缺 say`);
      if (q.t !== "聽" && !BLANK.test(q.q) && q.t === "字") err(`${qat}: 選字題沒有空格記號`);
      textFields.push([qat, q.q], ...q.opts.map(o => [qat + " 選項", o]));
    });
  });
});

// ---- 危險字元(inline onclick 會被打壞) ----
textFields.forEach(([where, text]) => {
  if (typeof text === "string" && BAD_CHARS.test(text)) err(`${where}: 含有危險字元 ${text.match(BAD_CHARS)[0]} → 「${text}」`);
});

// ---- 關卡與課程結構 ----
if (g.UNITS.length !== 40) err(`單元總數應該是 40,實際 ${g.UNITS.length}`);
g.REVIEW_POINTS.forEach(n => { if (!g.UNITS.find(u => u.id === n)) err(`總複習點 ${n} 沒有對應單元`); });
g.STAGES.forEach(st => {
  if (!g.QEXAMS.find(e => e.id === st.id)) err(`第 ${st.id} 季缺季檢定`);
  for (let i = st.units[0]; i <= st.units[1]; i++) if (!g.UNITS.find(u => u.id === i)) err(`第 ${st.id} 季缺單元 ${i}`);
});

const chars = [...seen.keys()].length;
console.log(`單元 ${g.UNITS.length} 個・字 ${chars} 個・關卡 ${g.UNITS.length * g.LESSONS.length + g.REVIEW_POINTS.length + g.QEXAMS.length + g.EXAMS.length} 關`);
if (warns.length) { console.log(`\n提醒 ${warns.length} 則:`); warns.forEach(w => console.log("  ⚠ " + w)); }
if (errs.length) { console.log(`\n❌ 錯誤 ${errs.length} 則:`); errs.forEach(e => console.log("  " + e)); process.exit(1); }
console.log("\n✅ 全部通過");
