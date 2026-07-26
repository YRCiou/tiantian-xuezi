// 注音符號資料:z=符號 sound=發音字 word=例詞 emoji=圖案
const SYMBOLS = [
  { z:"ㄅ", sound:"玻", word:"爸爸", emoji:"👨" },
  { z:"ㄆ", sound:"坡", word:"葡萄", emoji:"🍇" },
  { z:"ㄇ", sound:"摸", word:"帽子", emoji:"🎩" },
  { z:"ㄈ", sound:"佛", word:"飛機", emoji:"✈️" },
  { z:"ㄉ", sound:"得", word:"蛋",   emoji:"🥚" },
  { z:"ㄊ", sound:"特", word:"兔子", emoji:"🐰" },
  { z:"ㄋ", sound:"訥", word:"牛奶", emoji:"🥛" },
  { z:"ㄌ", sound:"勒", word:"老虎", emoji:"🐯" },
  { z:"ㄍ", sound:"哥", word:"狗",   emoji:"🐶" },
  { z:"ㄎ", sound:"科", word:"褲子", emoji:"👖" },
  { z:"ㄏ", sound:"喝", word:"花",   emoji:"🌸" },
  { z:"ㄐ", sound:"基", word:"雞",   emoji:"🐔" },
  { z:"ㄑ", sound:"七", word:"氣球", emoji:"🎈" },
  { z:"ㄒ", sound:"希", word:"西瓜", emoji:"🍉" },
  { z:"ㄓ", sound:"知", word:"豬",   emoji:"🐷" },
  { z:"ㄔ", sound:"吃", word:"車子", emoji:"🚗" },
  { z:"ㄕ", sound:"詩", word:"山",   emoji:"⛰️" },
  { z:"ㄖ", sound:"日", word:"太陽", emoji:"☀️" },
  { z:"ㄗ", sound:"資", word:"嘴巴", emoji:"👄" },
  { z:"ㄘ", sound:"疵", word:"草莓", emoji:"🍓" },
  { z:"ㄙ", sound:"思", word:"雨傘", emoji:"☂️" },
  { z:"ㄧ", sound:"衣", word:"衣服", emoji:"👕" },
  { z:"ㄨ", sound:"屋", word:"烏龜", emoji:"🐢" },
  { z:"ㄩ", sound:"迂", word:"魚",   emoji:"🐟" },
  { z:"ㄚ", sound:"啊", word:"阿嬤", emoji:"👵" },
  { z:"ㄛ", sound:"喔", word:"公雞喔喔叫", emoji:"🐓" },
  { z:"ㄜ", sound:"婀", word:"鵝",   emoji:"🦢" },
  { z:"ㄝ", sound:"耶", word:"爺爺", emoji:"👴" },
  { z:"ㄞ", sound:"哀", word:"愛心", emoji:"❤️" },
  { z:"ㄟ", sound:"欸", word:"杯子", emoji:"🥤" },
  { z:"ㄠ", sound:"熬", word:"貓咪", emoji:"🐱" },
  { z:"ㄡ", sound:"歐", word:"海鷗", emoji:"🕊️" },
  { z:"ㄢ", sound:"安", word:"平安", emoji:"🙏" },
  { z:"ㄣ", sound:"恩", word:"門",   emoji:"🚪" },
  { z:"ㄤ", sound:"骯", word:"糖果", emoji:"🍬" },
  { z:"ㄥ", sound:"燈的韻母鞥", word:"燈", emoji:"💡" },
  { z:"ㄦ", sound:"兒", word:"耳朵", emoji:"👂" },
];
const SYM = Object.fromEntries(SYMBOLS.map(s => [s.z, s]));

const BPMF_GROUPS = [
  { title:"🗣️ 聲母(前面的音)", list:"ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙ" },
  { title:"🎵 介音", list:"ㄧㄨㄩ" },
  { title:"🎶 韻母(後面的音)", list:"ㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ" },
];

const BPMF_LEVELS = [
  "ㄅㄆㄇㄈ", "ㄉㄊㄋㄌ", "ㄍㄎㄏ", "ㄐㄑㄒ", "ㄓㄔㄕㄖ",
  "ㄗㄘㄙ", "ㄧㄨㄩㄚ", "ㄛㄜㄝㄞ", "ㄟㄠㄡㄢ", "ㄣㄤㄥㄦ",
].map(s => s.split(""));
