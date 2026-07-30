// 課程架構:四季 × 10 單元、每單元 8 關、每 5 單元一次總複習、每季一次季檢定
// 另有「永遠玩不完」的練習區:每日挑戰、闖關塔、朗讀練習室、錯字複習箱

const STAGES = [
  { id: 1, title: "生活入門", emoji: "🌱", units: [1, 10],  desc: "數字、時間、家人、吃喝、路上的字" },
  { id: 2, title: "出門辦事", emoji: "🚪", units: [11, 20], desc: "看醫生、郵局銀行、搭車、填表格" },
  { id: 3, title: "家庭與健康", emoji: "🏠", units: [21, 30], desc: "煮飯家事、身體健康、緊急求助" },
  { id: 4, title: "社會生活", emoji: "🎎", units: [31, 40], desc: "節慶人情、水電帳單、活到老學到老" },
];
const STAGE_BY_ID = Object.fromEntries(STAGES.map(s => [s.id, s]));
function stageOfUnit(id) { return STAGES.find(s => id >= s.units[0] && id <= s.units[1]) || STAGES[0]; }

// 一個單元的八關:發音、聽力、認讀、字詞、語句、朗讀、寫字、考核
const LESSONS = [
  { key: "learn",    emoji: "📖", title: "學一學",   desc: "認識新字,跟著唸" },
  { key: "listen",   emoji: "🎧", title: "聽聲音",   desc: "聽發音,找出字" },
  { key: "look",     emoji: "🖼️", title: "看圖選字", desc: "看圖案,找出字" },
  { key: "word",     emoji: "🧩", title: "詞語練習", desc: "把詞語補完整" },
  { key: "sentence", emoji: "✏️", title: "句子填空", desc: "把句子補完整" },
  { key: "read",     emoji: "📢", title: "讀一讀",   desc: "朗讀短文,再填空" },
  { key: "write",    emoji: "✍️", title: "寫一寫",   desc: "描字,還有聽寫" },
  { key: "utest",    emoji: "🏁", title: "單元小考", desc: "考過六十分才過關" },
];
const LESSON_BY_KEY = Object.fromEntries(LESSONS.map(l => [l.key, l]));
const PASS = 60; // 過關分數

// 總複習關:每 5 個單元一次
const REVIEW_POINTS = [5, 10, 15, 20, 25, 30, 35, 40];

const BADGES = [
  { id: "first-lesson", emoji: "🌱", name: "好的開始", desc: "完成第一關" },
  { id: "first-unit",   emoji: "🎖️", name: "第一單元", desc: "完成一整個單元" },
  { id: "streak-3",     emoji: "🔥", name: "三天不間斷", desc: "連續學 3 天" },
  { id: "streak-7",     emoji: "🏅", name: "一週全勤", desc: "連續學 7 天" },
  { id: "streak-30",    emoji: "👑", name: "月月學習王", desc: "連續學 30 天" },
  { id: "chars-30",     emoji: "📖", name: "認識30個字", desc: "學會 30 個字" },
  { id: "chars-60",     emoji: "📚", name: "認識60個字", desc: "學會 60 個字" },
  { id: "chars-100",    emoji: "🏆", name: "百字達人", desc: "學會 100 個字" },
  { id: "chars-200",    emoji: "📜", name: "二百字達人", desc: "學會 200 個字" },
  { id: "chars-400",    emoji: "🎇", name: "四百字達人", desc: "學會 400 個字" },
  { id: "season-1",     emoji: "🌱", name: "生活入門", desc: "完成第一季" },
  { id: "season-2",     emoji: "🚪", name: "出門辦事", desc: "完成第二季" },
  { id: "season-3",     emoji: "🏠", name: "家庭健康", desc: "完成第三季" },
  { id: "season-4",     emoji: "🎎", name: "社會生活", desc: "完成第四季" },
  { id: "review-master", emoji: "🔁", name: "複習高手", desc: "八次總複習全過" },
  { id: "qexam-all",    emoji: "🎯", name: "四季達標", desc: "四回季檢定通過" },
  { id: "box-clear",    emoji: "🧹", name: "錯字清空", desc: "把錯字複習箱清空" },
  { id: "daily-7",      emoji: "📅", name: "挑戰一週", desc: "完成 7 次每日挑戰" },
  { id: "daily-30",     emoji: "🗓️", name: "挑戰一個月", desc: "完成 30 次每日挑戰" },
  { id: "tower-10",     emoji: "🗼", name: "闖關塔十層", desc: "闖關塔爬到 10 層" },
  { id: "tower-30",     emoji: "🚀", name: "闖關塔三十層", desc: "闖關塔爬到 30 層" },
  { id: "all-units",    emoji: "🌟", name: "識字畢業生", desc: "完成全部單元" },
  { id: "bpmf-all",     emoji: "🎓", name: "注音小老師", desc: "注音闖關全過" },
  { id: "exam-pass",    emoji: "🏵️", name: "檢定小狀元", desc: "三回模擬考都通過" },
];
