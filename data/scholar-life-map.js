import { serializeLifeRoute, serializeStarRoute } from "../route-state.js";

const ENTRIES = [
  { scholar: "孟喜", entityId: "person:mengxi", lifeName: "孟喜", year: -70 },
  { scholar: "京房", entityId: "person:jingfang", lifeName: "京房", year: -55 },
  { scholar: "马融", entityId: "person:marong", lifeName: "马融", year: 130 },
  { scholar: "郑康成", entityId: "person:zhengxuan", lifeName: "郑玄", year: 165 },
  { scholar: "荀爽", entityId: "person:xunshuang", lifeName: "荀爽", year: 159 },
  { scholar: "虞翻", entityId: "person:yufan", lifeName: "虞翻", year: 199 }
].map(Object.freeze);

export const SCHOLAR_LIFE_MAP = Object.freeze(ENTRIES);
const byScholar = new Map(SCHOLAR_LIFE_MAP.map(item => [item.scholar, item]));
const byEntity = new Map(SCHOLAR_LIFE_MAP.map(item => [item.entityId, item]));
const clean = value => String(value == null ? "" : value).trim();

export function lifeForScholar(scholar) {
  return byScholar.get(clean(scholar)) || null;
}

export function scholarForEntity(entityId) {
  return byEntity.get(clean(entityId)) || null;
}

export function starMapUrl({ hex, line, scholar } = {}) {
  const h = Number(hex);
  const l = Number(line);
  const route = {
    route: "star-map",
    hex: Number.isSafeInteger(h) && h >= 1 && h <= 64 ? h : null,
    line: Number.isSafeInteger(l) && l >= 1 && l <= 6 ? l : null,
    scholar: clean(scholar) || null
  };
  if (!route.hex) route.line = null;
  const url = serializeStarRoute(route, "https://yi.local/star-map/");
  return `${url.pathname}${url.search}`;
}

export function lifeHistoryUrl(scholar) {
  const item = lifeForScholar(scholar);
  if (!item) return null;
  const url = serializeLifeRoute({ route: "life-history", entity: item.entityId, year: item.year, yearExplicit: true }, "https://yi.local/life-history/");
  return `${url.pathname}${url.search}`;
}
