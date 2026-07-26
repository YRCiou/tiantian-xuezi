// 語音(台灣中文)+ 音效(拍手、叮咚)
let twVoice = null;
function pickVoice() {
  const voices = speechSynthesis.getVoices();
  twVoice = voices.find(v => v.lang === "zh-TW")
         || voices.find(v => v.lang && v.lang.startsWith("zh"))
         || null;
}
if ("speechSynthesis" in window) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

function speak(text, rate) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "zh-TW";
  if (twVoice) u.voice = twVoice;
  u.rate = rate || 0.85;
  u.pitch = 1.05;
  speechSynthesis.speak(u);
}
function stopSpeak() { if ("speechSynthesis" in window) speechSynthesis.cancel(); }

let _ac = null;
function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)();
  if (_ac.state === "suspended") _ac.resume();
  return _ac;
}

// 拍手聲:一連串短促的濾波噪音
function applause(duration) {
  try {
    const ctx = ac();
    const dur = duration || 1.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let clap = 0;
    for (let i = 0; i < d.length; i++) {
      if (clap <= 0 && Math.random() < 0.004) clap = ctx.sampleRate * 0.025;
      if (clap > 0) { d[i] = (Math.random() * 2 - 1) * (clap / (ctx.sampleRate * 0.025)) * 0.8; clap--; }
      else d[i] = (Math.random() * 2 - 1) * 0.03;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1600; f.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 1.0;
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start();
  } catch (e) { /* 音效失敗不影響流程 */ }
}

// 答對的叮咚聲
function ding() {
  try {
    const ctx = ac();
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, ctx.currentTime + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.5);
      o.connect(g); g.connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.09); o.stop(ctx.currentTime + i * 0.09 + 0.55);
    });
  } catch (e) {}
}

// 答錯的溫柔提示聲(不刺耳)
function boop() {
  try {
    const ctx = ac();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(330, ctx.currentTime);
    o.frequency.linearRampToValueAtTime(260, ctx.currentTime + 0.25);
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

const PRAISES = ["答對了,太棒了!", "好厲害!", "答對了,真聰明!", "哇,你好棒!", "沒錯,答對囉!", "太厲害了,繼續加油!"];
const ENCOURAGE = ["沒關係,再聽一次,再試試看!", "差一點點,再試一次!", "加油,慢慢來!"];
function praise() { ding(); speak(PRAISES[Math.floor(Math.random() * PRAISES.length)], 1); }
function encourage() { boop(); speak(ENCOURAGE[Math.floor(Math.random() * ENCOURAGE.length)], 0.9); }

// 彩帶 + 大表情
function confetti(n) {
  const emojis = ["⭐", "🌟", "🎉", "✨", "🎊", "🧧"];
  for (let i = 0; i < (n || 16); i++) {
    const el = document.createElement("div");
    el.className = "confetti-piece";
    el.textContent = emojis[i % emojis.length];
    el.style.left = Math.random() * 92 + "vw";
    el.style.animationDelay = Math.random() * 0.6 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
}
function bigPop(emoji) {
  const el = document.createElement("div");
  el.className = "pop";
  el.textContent = emoji;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function celebrate() { confetti(20); applause(1.6); }
