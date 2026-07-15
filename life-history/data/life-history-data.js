class DataFetchError extends Error { constructor(message) { super(message); this.name = 'DataFetchError'; } }
class DataParseError extends Error { constructor(message) { super(message); this.name = 'DataParseError'; } }
class DataValidationError extends Error { constructor(message) { super(message); this.name = 'DataValidationError'; } }

const cache = new Map();
function dataUrl(name) { return new URL(name, import.meta.url); }
async function fetchJson(role, url) {
  const key = `${role}:${url.href}`;
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    let response;
    try { response = await fetch(url); } catch (error) { throw new DataFetchError(`${role} ${url.pathname}: fetch 失败：${error.message}`); }
    if (!response.ok) throw new DataFetchError(`${role} ${url.pathname}: HTTP ${response.status}`);
    const text = await response.text();
    try { return JSON.parse(text); } catch (error) { throw new DataParseError(`${role} ${url.pathname}: JSON 解析失败：${error.message}`); }
  })();
  cache.set(key, promise);
  try { return await promise; } catch (error) { cache.delete(key); throw error; }
}
function assert(condition, role, field, expected, actual) {
  if (!condition) throw new DataValidationError(`${role}: ${field} 期望 ${expected}，实际 ${actual}`);
}
export function validateLifeHistoryData(data) {
  assert(data && typeof data === 'object', 'primary-life-history-data', 'root', 'object', typeof data);
  for (const key of ['schemaVersion','meta','sources','periods','entities','concepts','relations','events','assertions']) assert(key in data, 'primary-life-history-data', `root.${key}`, '存在', '缺失');
  assert(data.schemaVersion === '2.0.0', 'primary-life-history-data', 'schemaVersion', '2.0.0', data.schemaVersion);
  assert(data.sources.length === 2, 'primary-life-history-data', 'sources.length', 2, data.sources.length);
  assert(data.periods.length === 7, 'primary-life-history-data', 'periods.length', 7, data.periods.length);
  assert(data.entities.length === 117, 'primary-life-history-data', 'entities.length', 117, data.entities.length);
  assert(data.concepts.length === 21, 'primary-life-history-data', 'concepts.length', 21, data.concepts.length);
  assert(data.relations.length === 190, 'primary-life-history-data', 'relations.length', 190, data.relations.length);
  assert(data.events.length === 4, 'primary-life-history-data', 'events.length', 4, data.events.length);
  assert(data.assertions.length === 3, 'primary-life-history-data', 'assertions.length', 3, data.assertions.length);
  const entityIds = new Set(data.entities.map(e => e.id));
  const conceptIds = new Set(data.concepts.map(c => c.id));
  const eventIds = new Set(data.events.map(e => e.id));
  assert(entityIds.size === 117, 'primary-life-history-data', 'entity ids', '117 unique', entityIds.size);
  assert(conceptIds.size === 21, 'primary-life-history-data', 'concept ids', '21 unique', conceptIds.size);
  for (const r of data.relations) {
    assert(entityIds.has(r.subject), 'primary-life-history-data', `relations[${r.id}].subject`, '有效实体', r.subject);
    assert(entityIds.has(r.object) || (r.predicate === 'participated_in' && eventIds.has(r.object)), 'primary-life-history-data', `relations[${r.id}].object`, '有效实体或参与事件', r.object);
    assert(Number.isFinite(r.confidence) && r.confidence >= 0 && r.confidence <= 1, 'primary-life-history-data', `relations[${r.id}].confidence`, '0..1', r.confidence);
    assert(Array.isArray(r.evidence) && r.evidence.length > 0, 'primary-life-history-data', `relations[${r.id}].evidence`, '非空数组', r.evidence?.length);
  }
  for (const event of data.events) {
    for (const id of event.participants || []) assert(entityIds.has(id), 'primary-life-history-data', `events[${event.id}].participants`, '有效实体', id);
    for (const id of event.concepts || []) assert(conceptIds.has(id), 'primary-life-history-data', `events[${event.id}].concepts`, '有效概念', id);
  }
  return true;
}
export async function loadLifeHistoryData(options = {}) {
  const mainUrl = options.mainUrl ? new URL(options.mainUrl, import.meta.url) : dataUrl('life-history-v2.json');
  const lifeHistoryData = await fetchJson('primary-life-history-data', mainUrl);
  validateLifeHistoryData(lifeHistoryData);
  return { lifeHistoryData };
}
export function clearLifeHistoryDataCache() { cache.clear(); }
export { DataFetchError, DataParseError, DataValidationError };
