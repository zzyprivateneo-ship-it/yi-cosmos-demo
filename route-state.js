export const ROUTE_STATE_VERSION = "1.0.0";
export const ROUTE_NAMESPACE = "yi-cosmos";
const MAX_PARAM_CODEPOINTS = 256;
const STAR_PARAMS = ["hex", "line", "scholar"];
const LIFE_PARAMS = ["entity", "year"];

export function normalizePathname(pathname) {
  let path = String(pathname || "/").replace(/\\/g, "/");
  path = path.replace(/\/index\.html$/i, "/");
  if (path === "" || path === "/index.html") path = "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path !== "/" && !path.endsWith("/")) path += "/";
  if (path === "/divination/index.html/") path = "/divination/";
  if (path === "/star-map/index.html/") path = "/star-map/";
  if (path === "/life-history/index.html/") path = "/life-history/";
  return path;
}

export function parseStrictInteger(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!/^-?\d+$/.test(raw)) return { ok: false, value: null, raw };
  const valueNumber = Number(raw);
  if (!Number.isSafeInteger(valueNumber)) return { ok: false, value: null, raw };
  return { ok: true, value: Object.is(valueNumber, -0) ? 0 : valueNumber, raw };
}

export function readSingleParam(searchParams, name) {
  const values = searchParams.getAll(name);
  if (!values.length) return { present: false, value: null, duplicate: false, tooLong: false };
  const value = String(values[0] ?? "");
  return {
    present: true,
    value,
    duplicate: values.length > 1,
    tooLong: Array.from(value).length > MAX_PARAM_CODEPOINTS
  };
}

function toUrl(input, fallbackPath) {
  try {
    return new URL(input, "https://yi.local");
  } catch {
    return new URL(fallbackPath, "https://yi.local");
  }
}

function cleanString(value) {
  return String(value == null ? "" : value).trim();
}

function hasHex(indexes, number) {
  return Boolean(indexes?.hexByNumber?.has?.(Number(number)));
}

function hexFromRaw(raw, indexes) {
  const value = cleanString(raw);
  if (!value) return null;
  const integer = parseStrictInteger(value);
  if (integer.ok && hasHex(indexes, integer.value)) return Number(integer.value);
  const named = indexes?.hexByName?.get?.(value);
  if (named) return Number(named.number ?? named);
  const symbol = indexes?.hexBySymbol?.get?.(value);
  if (symbol) return Number(symbol.number ?? symbol);
  return null;
}

function validScholar(raw, indexes) {
  const value = cleanString(raw);
  if (!value || Array.from(value).length > MAX_PARAM_CODEPOINTS) return null;
  return indexes?.scholarNames?.has?.(value) ? value : null;
}

function participantHas(indexes, scholar, hex) {
  if (!scholar) return true;
  return Boolean(indexes?.scholarParticipants?.get?.(scholar)?.has?.(Number(hex)));
}

function primaryLineHas(indexes, hex, line) {
  const lines = indexes?.primaryLinesByHex?.get?.(Number(hex));
  return Boolean(lines?.has?.(Number(line)));
}

function scholarMaterialHas(indexes, scholar, hex, line) {
  if (!scholar) return true;
  const materials = indexes?.scholarMaterialsByHexAndLine;
  if (!materials) return false;
  if (materials.has?.(`${scholar}|${Number(hex)}|${Number(line)}`)) return true;
  if (materials.has?.(`${Number(hex)}|${Number(line)}|${scholar}`)) return true;
  const byScholar = materials.get?.(scholar);
  if (byScholar?.has?.(`${Number(hex)}|${Number(line)}`)) return true;
  return false;
}

function paramDiagnostics(url, allowed) {
  const invalidParams = [];
  const duplicateParams = [];
  const allowedSet = new Set(allowed);
  for (const key of new Set([...url.searchParams.keys()])) {
    if (!allowedSet.has(key)) invalidParams.push(key);
    else if (url.searchParams.getAll(key).length > 1) duplicateParams.push(key);
  }
  return { invalidParams, duplicateParams };
}

export function parseStarRoute(inputUrl, indexes = {}) {
  const url = toUrl(inputUrl, "/star-map/");
  const diagnostics = paramDiagnostics(url, STAR_PARAMS);
  let scholar = null;
  let hex = null;
  let line = null;
  const scholarParam = readSingleParam(url.searchParams, "scholar");
  if (scholarParam.present) {
    if (scholarParam.duplicate) diagnostics.duplicateParams.push("scholar");
    scholar = scholarParam.tooLong ? null : validScholar(scholarParam.value, indexes);
    if (!scholar) diagnostics.invalidParams.push("scholar");
  }
  const hexParam = readSingleParam(url.searchParams, "hex");
  if (hexParam.present) {
    if (hexParam.duplicate) diagnostics.duplicateParams.push("hex");
    hex = hexParam.tooLong ? null : hexFromRaw(hexParam.value, indexes);
    if (!hex) diagnostics.invalidParams.push("hex");
  }
  if (scholar && hex && !participantHas(indexes, scholar, hex)) {
    diagnostics.invalidParams.push("hex");
    hex = null;
  }
  const lineParam = readSingleParam(url.searchParams, "line");
  if (lineParam.present) {
    if (lineParam.duplicate) diagnostics.duplicateParams.push("line");
    if (hex && !lineParam.tooLong) {
      const parsed = parseStrictInteger(lineParam.value);
      if (parsed.ok && parsed.value >= 1 && parsed.value <= 6 && primaryLineHas(indexes, hex, parsed.value) && scholarMaterialHas(indexes, scholar, hex, parsed.value)) line = parsed.value;
      else diagnostics.invalidParams.push("line");
    } else diagnostics.invalidParams.push("line");
  }
  const route = { route: "star-map", scholar, hex, line };
  const canonicalUrl = serializeStarRoute(route, url);
  return {
    route,
    canonicalUrl,
    canonicalPathAndSearch: canonicalUrl.pathname + canonicalUrl.search,
    signature: routeSignature(route),
    invalidParams: [...new Set(diagnostics.invalidParams)],
    duplicateParams: [...new Set(diagnostics.duplicateParams)]
  };
}

export function serializeStarRoute(route, baseUrl = "https://yi.local/star-map/") {
  const url = toUrl(baseUrl, "/star-map/");
  url.pathname = normalizePathname(url.pathname).endsWith("/star-map/") ? normalizePathname(url.pathname) : "/star-map/";
  url.search = "";
  url.hash = "";
  if (route?.hex != null) url.searchParams.set("hex", String(route.hex));
  if (route?.line != null && route?.hex != null) url.searchParams.set("line", String(route.line));
  if (route?.scholar) url.searchParams.set("scholar", String(route.scholar));
  return url;
}

function visualIntervalFor(indexes, entity) {
  if (typeof indexes.visualIntervalFor === "function") return indexes.visualIntervalFor(entity);
  return entity?.chronology?.visualInterval || entity?.chronology?.lifespan || entity?.chronology?.activity || null;
}

function clampYear(year, span) {
  return Math.max(span.start, Math.min(span.end, year));
}

export function parseLifeRoute(inputUrl, indexes = {}) {
  const url = toUrl(inputUrl, "/life-history/");
  const diagnostics = paramDiagnostics(url, LIFE_PARAMS);
  const span = indexes.timeSpan || { start: -700, end: 1989 };
  const defaultYear = Number.isSafeInteger(indexes.defaultYear) ? indexes.defaultYear : 1200;
  let entity = null;
  const entityParam = readSingleParam(url.searchParams, "entity");
  if (entityParam.present) {
    if (entityParam.duplicate) diagnostics.duplicateParams.push("entity");
    const raw = cleanString(entityParam.value);
    if (!entityParam.tooLong && indexes?.entityById?.has?.(raw)) entity = raw;
    else diagnostics.invalidParams.push("entity");
  }
  let yearExplicit = false;
  let year = defaultYear;
  const yearParam = readSingleParam(url.searchParams, "year");
  if (yearParam.present) {
    if (yearParam.duplicate) diagnostics.duplicateParams.push("year");
    const parsed = yearParam.tooLong ? { ok: false } : parseStrictInteger(yearParam.value);
    if (parsed.ok) {
      year = clampYear(parsed.value, span);
      yearExplicit = true;
      if (year !== parsed.value) diagnostics.invalidParams.push("year");
    } else diagnostics.invalidParams.push("year");
  }
  if (!yearExplicit && entity) {
    const item = indexes.entityById.get(entity);
    const interval = visualIntervalFor(indexes, item);
    if (interval && Number.isFinite(interval.start) && Number.isFinite(interval.end)) year = clampYear(Math.round((interval.start + interval.end) / 2), span);
  }
  const route = { route: "life-history", entity, year, yearExplicit };
  const canonicalUrl = serializeLifeRoute(route, url);
  return {
    route,
    canonicalUrl,
    canonicalPathAndSearch: canonicalUrl.pathname + canonicalUrl.search,
    signature: routeSignature(route),
    invalidParams: [...new Set(diagnostics.invalidParams)],
    duplicateParams: [...new Set(diagnostics.duplicateParams)]
  };
}

export function serializeLifeRoute(route, baseUrl = "https://yi.local/life-history/") {
  const url = toUrl(baseUrl, "/life-history/");
  url.pathname = normalizePathname(url.pathname).endsWith("/life-history/") ? normalizePathname(url.pathname) : "/life-history/";
  url.search = "";
  url.hash = "";
  if (route?.entity) {
    url.searchParams.set("entity", String(route.entity));
    url.searchParams.set("year", String(route.year));
  } else if (route?.yearExplicit) url.searchParams.set("year", String(route.year));
  return url;
}

export function routeSignature(route) {
  if (!route || !route.route) return "unknown";
  if (route.route === "star-map") return `star-map|hex=${route.hex ?? ""}|line=${route.line ?? ""}|scholar=${route.scholar ?? ""}`;
  if (route.route === "life-history") return `life-history|entity=${route.entity ?? ""}|year=${route.year ?? 1200}`;
  if (route.route === "home") return "home";
  if (route.route === "divination") return "divination";
  return String(route.route);
}

export function createHistoryState(route, source = "user") {
  return Object.freeze({
    namespace: ROUTE_NAMESPACE,
    version: ROUTE_STATE_VERSION,
    route: route?.route || "unknown",
    signature: routeSignature(route),
    source
  });
}
