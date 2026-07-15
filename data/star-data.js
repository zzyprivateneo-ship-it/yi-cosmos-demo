class DataFetchError extends Error { constructor(message) { super(message); this.name = 'DataFetchError'; } }
class DataParseError extends Error { constructor(message) { super(message); this.name = 'DataParseError'; } }
class DataValidationError extends Error { constructor(message) { super(message); this.name = 'DataValidationError'; } }
class DataIntegrityError extends Error { constructor(message) { super(message); this.name = 'DataIntegrityError'; } }

const cache = new Map();

function dataUrl(name) {
  return new URL(name, import.meta.url);
}

async function fetchJson(role, url) {
  const key = `${role}:${url.href}`;
  if (cache.has(key)) return cache.get(key);
  const promise = (async () => {
    let response;
    try {
      response = await fetch(url);
    } catch (error) {
      throw new DataFetchError(`${role} ${url.pathname}: fetch 失败：${error.message}`);
    }
    if (!response.ok) throw new DataFetchError(`${role} ${url.pathname}: HTTP ${response.status}`);
    let text;
    try {
      text = await response.text();
    } catch (error) {
      throw new DataFetchError(`${role} ${url.pathname}: 读取响应失败：${error.message}`);
    }
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new DataParseError(`${role} ${url.pathname}: JSON 解析失败：${error.message}`);
    }
  })();
  cache.set(key, promise);
  try { return await promise; } catch (error) { cache.delete(key); throw error; }
}

function assert(condition, role, field, expected, actual) {
  if (!condition) throw new DataValidationError(`${role}: ${field} 期望 ${expected}，实际 ${actual}`);
}

export function validateStarData(data) {
  assert(data && typeof data === 'object', 'primary-star-data', 'root', 'object', typeof data);
  for (const key of ['metadata','trigrams','scholars','hexagrams','appendices','hexagramOnlyRecords','reviewCandidates','alignments','v2Review']) {
    assert(key in data, 'primary-star-data', `root.${key}`, '存在', '缺失');
  }
  assert(data.metadata.version === '2.0.0', 'primary-star-data', 'metadata.version', '2.0.0', data.metadata.version);
  assert(data.metadata.stats.hexagrams === 64, 'primary-star-data', 'metadata.stats.hexagrams', 64, data.metadata.stats.hexagrams);
  assert(data.metadata.stats.scholars === 21, 'primary-star-data', 'metadata.stats.scholars', 21, data.metadata.stats.scholars);
  assert(data.metadata.v2Stats.sections === 1099, 'primary-star-data', 'metadata.v2Stats.sections', 1099, data.metadata.v2Stats.sections);
  assert(data.metadata.v2Stats.visibleAnnotations === 2599, 'primary-star-data', 'metadata.v2Stats.visibleAnnotations', 2599, data.metadata.v2Stats.visibleAnnotations);
  assert(Array.isArray(data.trigrams) && data.trigrams.length === 8, 'primary-star-data', 'trigrams.length', 8, data.trigrams?.length);
  assert(Array.isArray(data.scholars) && data.scholars.length === 21, 'primary-star-data', 'scholars.length', 21, data.scholars?.length);
  assert(Array.isArray(data.hexagrams) && data.hexagrams.length === 64, 'primary-star-data', 'hexagrams.length', 64, data.hexagrams?.length);
  const scholarNames = new Set(data.scholars.map(s => s.name));
  const numbers = data.hexagrams.map(h => h.number).sort((a,b)=>a-b);
  assert(numbers.every((n,i)=>n===i+1), 'primary-star-data', 'hexagram.number', '1..64', numbers.join(','));
  let sections = 0, annotations = 0, lineNodes = 0;
  const sectionIds = new Set();
  for (const hex of data.hexagrams) {
    assert(Array.isArray(hex.lines) && hex.lines.length === 6 && hex.lines.every(x => x === 0 || x === 1), 'primary-star-data', `hexagrams[${hex.number}].lines`, '6 个 0/1', hex.lines);
    assert(Array.isArray(hex.sections), 'primary-star-data', `hexagrams[${hex.number}].sections`, 'array', typeof hex.sections);
    assert(hex.sectionCount == null || Number.isInteger(hex.sectionCount), 'primary-star-data', `hexagrams[${hex.number}].sectionCount`, '整数或空', hex.sectionCount);
    const localIds = new Set(hex.sections.map(s => s.id));
    for (const sid of hex.primaryLineSectionIds || []) assert(localIds.has(sid), 'primary-star-data', `hexagrams[${hex.number}].primaryLineSectionIds`, '本卦区段', sid);
    for (const n of hex.scholarNames || []) assert(scholarNames.has(n), 'primary-star-data', `hexagrams[${hex.number}].scholarNames`, '根级注家', n);
    for (const s of hex.sections) {
      assert(!sectionIds.has(s.id), 'primary-star-data', 'section.id', '唯一', s.id);
      sectionIds.add(s.id);
      for (const key of ['id','type','title','canonicalText','translation','variants','annotations','hiddenSameWitnesses','mappedRecordIds']) assert(key in s, 'primary-star-data', `section.${key}`, '存在', '缺失');
      if ('hiddenSameWitnessRecordIds' in s) assert(Array.isArray(s.hiddenSameWitnessRecordIds), 'primary-star-data', 'section.hiddenSameWitnessRecordIds', '数组', typeof s.hiddenSameWitnessRecordIds);
      for (const a of s.annotations || []) {
        for (const key of ['recordId','work','scholar','text']) assert(Boolean(a[key]), 'primary-star-data', `annotation.${key}`, '非空', a[key]);
      }
    }
    const ann = hex.sections.reduce((sum,s)=>sum+(s.annotations?.length || 0),0);
    assert(hex.commentaryCount === ann, 'primary-star-data', `hexagrams[${hex.number}].commentaryCount`, ann, hex.commentaryCount);
    sections += hex.sections.length;
    annotations += ann;
    lineNodes += hex.lineNodes?.length || 0;
  }
  assert(sections === 1099, 'primary-star-data', 'sections total', 1099, sections);
  assert(annotations === 2599, 'primary-star-data', 'visible annotations total', 2599, annotations);
  assert(lineNodes === 386, 'primary-star-data', 'lineNodes total', 386, lineNodes);
  assert(sectionIds.size === 1099, 'primary-star-data', 'unique section ids', 1099, sectionIds.size);
  return true;
}

export function validateSemanticLayout(data) {
  assert(data && typeof data === 'object', 'semantic-layout', 'root', 'object', typeof data);
  assert(data.metadata?.documents === 64, 'semantic-layout', 'metadata.documents', 64, data.metadata?.documents);
  assert(data.metadata?.vocabulary === 646, 'semantic-layout', 'metadata.vocabulary', 646, data.metadata?.vocabulary);
  assert(Array.isArray(data.positions) && data.positions.length === 64, 'semantic-layout', 'positions.length', 64, data.positions?.length);
  const nums = new Set(data.positions.map(p => p.number));
  assert(nums.size === 64 && [...nums].every(n => n >= 1 && n <= 64), 'semantic-layout', 'positions.number', '1..64', [...nums].join(','));
  for (const p of data.positions) {
    assert(Array.isArray(p.direction) && p.direction.length === 3 && p.direction.every(Number.isFinite), 'semantic-layout', `positions[${p.number}].direction`, '3 个有限数', p.direction);
    assert(p.direction.some(x => x !== 0), 'semantic-layout', `positions[${p.number}].direction`, '非零向量', p.direction);
  }
  return true;
}

export async function loadStarData(options = {}) {
  const mainUrl = options.mainUrl ? new URL(options.mainUrl, import.meta.url) : dataUrl('zhouyi-integrated-v2.json');
  const semanticUrl = options.semanticUrl ? new URL(options.semanticUrl, import.meta.url) : dataUrl('semantic-layout.json');
  const [starData, semanticLayout] = await Promise.all([
    fetchJson('primary-star-data', mainUrl),
    fetchJson('semantic-layout', semanticUrl),
  ]);
  validateStarData(starData);
  validateSemanticLayout(semanticLayout);
  return { starData, semanticLayout };
}

export function clearStarDataCache() { cache.clear(); }
export { DataFetchError, DataParseError, DataValidationError, DataIntegrityError };
