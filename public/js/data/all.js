// 把四季單元合成完整課程
const UNITS = [].concat(
  typeof UNITS_S1 !== "undefined" ? UNITS_S1 : [],
  typeof UNITS_S2 !== "undefined" ? UNITS_S2 : [],
  typeof UNITS_S3 !== "undefined" ? UNITS_S3 : [],
  typeof UNITS_S4 !== "undefined" ? UNITS_S4 : []
);
const UNIT_BY_ID = Object.fromEntries(UNITS.map(u => [u.id, u]));
const ALL_ITEMS = UNITS.flatMap(u => u.items);
const ALL_CHARS = new Set(ALL_ITEMS.map(it => it.w));
const ITEM_BY_CHAR = Object.fromEntries(ALL_ITEMS.map(it => [it.w, it]));
const UNIT_OF_CHAR = {};
UNITS.forEach(u => u.items.forEach(it => { UNIT_OF_CHAR[it.w] = u.id; }));
