import * as THREE from "../node_modules/three/build/three.module.js";
import { loadLifeHistoryData, clearLifeHistoryDataCache } from "./data/life-history-data.js";
import { scholarForEntity } from "../data/scholar-life-map.js";
import { ROUTE_STATE_VERSION, createHistoryState, parseLifeRoute, routeSignature, serializeLifeRoute } from "../route-state.js";

const SPAN = { start: -700, end: 1989 };
const CORE_POSITIONS = Object.freeze({
  "system:received": [0, 0, 0],
  "work:yizhuan": [6.2, 2.6, 0.8],
  "system:silk": [-6.1, -3.1, 1.5],
  "system:wangbi": [4.8, -5.4, -1.3],
  "system:zhengyi": [-6.4, 4.1, -1.8],
  "system:jijie": [0.4, 7.2, 2.2]
});
const CLUSTER_COLORS = Object.freeze({
  "school:preqin-divination": "#b8a476", "school:preqin-yili": "#9db49a", "school:han-xiangshu": "#b58f7e",
  "school:feishi": "#8fa4b5", "school:huanglao": "#82a9a3", "system:wangbi": "#a099b6",
  "system:zhengyi": "#879db0", "system:jijie": "#b6a174", "school:song-tushu": "#8fb2b6",
  "system:cheng": "#91a594", "system:zhu": "#ad969f", "school:qing-kaoju": "#8095a8",
  "school:modern-critical": "#aab4bb", "school:song-xinxue": "#9a8fac", "school:song-gongli": "#a79f73",
  "school:ming-qing-xiangshu": "#a17868", "school:qing-bianwei": "#779f9b", "school:modern-science": "#788ead",
  "school:international-translation": "#a68aa0"
});
const FALLBACK_COLORS = ["#9aa8ae", "#ada18d", "#98aaa0", "#a39cab"];
const TYPE_STYLE = {
  text_system: { label: "文本系统", css: "text-system", color: "#eee4cc", core: 1.18, glow: 4.30 },
  school: { label: "学派", css: "school", color: "#c6d2d7", core: 0.92, glow: 3.65 },
  work: { label: "著作", css: "work", color: "#c8c3d1", core: 0.68, glow: 3.15 },
  person: { label: "学者", css: "person", color: "#e7ebec", core: 0.53, glow: 2.75 }
};
const REL_GROUP = {
  authored: "authored", studied_under: "lineage", influenced_by: "lineage", developed: "lineage", based_on: "lineage",
  preserved: "lineage", revived: "lineage", criticized: "debate", affiliated_with: "affiliation"
};
const REL_TEXT = {
  authored: ["著述", "作者"], studied_under: ["师从", "传授于"], influenced_by: ["受到影响", "影响"], developed: ["发展", "由其发展"],
  based_on: ["基于", "成为基础"], preserved: ["保存", "由其保存"], revived: ["复兴", "由其复兴"], criticized: ["批评", "受到批评"],
  affiliated_with: ["主要归属", "包含"], participated_in: ["参与", "参与者"]
};
const REL_COLOR = { authored: "#ded5c1", lineage: "#b8c7cd", debate: "#c3b2ba", affiliation: "#7f898d" };
const RELATION_STYLE = {
  authored: { group: "authored", color: "#ded5c1", opacity: 0.48 },
  studied_under: { group: "lineage", color: "#b8c7cd", opacity: 0.46 },
  influenced_by: { group: "lineage", color: "#b8c7cd", opacity: 0.42 },
  developed: { group: "lineage", color: "#c3ced1", opacity: 0.46 },
  based_on: { group: "lineage", color: "#c0c9cd", opacity: 0.40 },
  preserved: { group: "lineage", color: "#cbd0c7", opacity: 0.46 },
  revived: { group: "lineage", color: "#cbd0c7", opacity: 0.46 },
  criticized: { group: "debate", color: "#c3b2ba", opacity: 0.44 },
  affiliated_with: { group: "affiliation", color: "#7f898d", opacity: 0.10 }
};
const DEFAULT_ROTATION = new THREE.Euler(-0.16, -0.24, 0.025);
const CAMERA_HOME = 92;
const CAMERA_MIN = 46;
const CAMERA_MAX = 138;
const CORE_IDS = new Set([
  "system:received", "system:silk", "system:wangbi",
  "system:zhengyi", "system:jijie", "work:yizhuan"
]);
const shootingStars = [];
const qs = id => document.getElementById(id);
const text = (el, value) => { if (el) el.textContent = value == null ? "" : String(value); };
const clear = el => { while (el && el.firstChild) el.removeChild(el.firstChild); };
const node = (tag, cls, value) => { const el = document.createElement(tag); if (cls) el.className = cls; if (value != null) el.textContent = value; return el; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const finite = v => Number.isFinite(v);

const dom = {};
const state = {
  data: null, byId: new Map(), displayById: new Map(), nodes: [], nodeById: new Map(), pickables: [], nebulaPickables: [],
  relationLines: [], flowParticles: [], nebulae: [], clusterCenters: new Map(), clusterFrames: new Map(), clusterByEntity: new Map(),
  orbitByEntity: new Map(), orbitElapsed: 0, shootingStars, year: 1200, span: SPAN, selectedId: "", hoveredId: "", hoveredClusterId: "", focusedClusterId: "",
  focusedNodeId: "", focusLevel: "overview", focusDistance: 92, relationMode: "all", reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  webglFallback: false, activePeriodId: "", activeEventId: "", initialized: false, backgroundPointCount: 0, visibleLineCount: 0, timelineTrackWidth: 2400, timelineDragging: false, timelineMoved: false, timelineStartX: 0, timelineStartYear: 1200,
  drawableRelationCount: 0, layoutMaxError: 0, dataCounts: {}, cameraTarget: new THREE.Vector3(0, 0, 0),
  dataReady: false, viewReady: false, routeReady: false, isApplyingRoute: false, routeIndexes: null,
  parsedRoute: null, canonicalPathAndSearch: "", routeSignature: "", lastWriteMode: "", lastWriteSource: "",
  popstateApplyCount: 0, canonicalReplaceCount: 0, invalidParams: [], duplicateParams: [], fetchCount: 0
};
const scene = {
  renderer: null, scene: null, camera: null, root: null, background: null,
  nebulaLayer: null, lineLayer: null, flowLayer: null, nodeLayer: null,
  raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(-2, -2),
  raf: 0, last: 0, clock: new THREE.Clock(),
  dragging: false, dragMoved: false, dragStart: null,
  labels: new Map(), textures: new Map(), nebulaTextures: new Map(),
  backgroundStars: [], selectedObject: null,
  cameraTarget: new THREE.Vector3(),
  cameraGoalPosition: new THREE.Vector3(0, 0, CAMERA_HOME),
  cameraGoalTarget: new THREE.Vector3(),
  focusDirection: new THREE.Vector3(0, 0, 1),
  glowTexture: null,
  projected: new THREE.Vector3(),
  worldPosition: new THREE.Vector3(),
  focusWorldPosition: new THREE.Vector3(),
  desiredCameraPosition: new THREE.Vector3(),
  orbitQuaternion: new THREE.Quaternion()
};

function fnv1a(input) {
  let hash = 2166136261;
  const s = String(input);
  for (let i = 0; i < s.length; i++) { hash ^= s.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
const hash01 = key => fnv1a(key) / 4294967295;
function seeded(seed) { let v = seed >>> 0; return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 4294967296); }
function yearOf(entity) { return entity.chronology?.visualInterval || entity.chronology?.lifespan || entity.chronology?.activity || null; }
function yearStart(entity) { return yearOf(entity)?.start ?? SPAN.start; }
function formatYear(y) { const n = Math.round(y); return n < 0 ? `公元前${Math.abs(n)}年` : `公元${n}年`; }
function formatYears(entity) {
  const it = yearOf(entity);
  if (!it) return "年代待考";
  const prefix = it.certainty === "disputed" ? "年代有争议 · " : it.certainty === "approximate" ? "约 · " : "";
  return `${prefix}${formatYear(it.start)}—${formatYear(it.end)}`;
}
function displayDescription(entity) {
  const raw = String(entity.description || "");
  const sentences = raw.match(/[^。！？]+[。！？]?/g) || [raw];
  const cleaned = sentences.map(s => s.replace("从书中所述的学术位置来看，", "").trim()).filter(s => s && !s.includes("周易研究史")).join("");
  return cleaned || raw;
}
function periodForYear(year) { return state.data.periods.find(p => year >= p.start && year < p.end) || null; }
function eventForYear(year) {
  const active = state.data.events.find(e => year >= e.temporal.start && year <= e.temporal.end);
  if (active) return active;
  let best = null, dist = Infinity;
  for (const e of state.data.events) { const d = Math.abs(year - e.temporal.start); if (d <= 30 && d < dist) { best = e; dist = d; } }
  return best;
}
function alphaFor(entity, year = state.year) {
  const start = yearStart(entity);
  if (year < start) return 0;
  const dur = entity.type === "person" ? 8 : entity.type === "work" ? 16 : 24;
  return clamp((year - start) / dur, 0.24, 1);
}
function colorForCluster(id) {
  if (CORE_POSITIONS[id]) return "#f4ecd8";
  if (CLUSTER_COLORS[id]) return CLUSTER_COLORS[id];
  return FALLBACK_COLORS[fnv1a(id) % FALLBACK_COLORS.length];
}
function validateData(data) {
  const counts = {
    sources: data.sources.length, periods: data.periods.length, entities: data.entities.length, concepts: data.concepts.length,
    relations: data.relations.length, events: data.events.length, assertions: data.assertions.length,
    person: data.entities.filter(e => e.type === "person").length, work: data.entities.filter(e => e.type === "work").length,
    school: data.entities.filter(e => e.type === "school").length, text_system: data.entities.filter(e => e.type === "text_system").length
  };
  const required = { sources: 2, periods: 7, entities: 117, concepts: 21, relations: 190, events: 4, assertions: 3, person: 53, work: 43, school: 16, text_system: 5 };
  for (const [k, v] of Object.entries(required)) if (counts[k] !== v) throw new Error(`生命史数量异常：${k}=${counts[k]}/${v}`);
  const pred = {};
  for (const r of data.relations) pred[r.predicate] = (pred[r.predicate] || 0) + 1;
  const need = { affiliated_with: 103, authored: 42, influenced_by: 16, criticized: 7, based_on: 6, studied_under: 5, developed: 4, participated_in: 4, revived: 2, preserved: 1 };
  for (const [k, v] of Object.entries(need)) if (pred[k] !== v) throw new Error(`关系谓词异常：${k}=${pred[k]}/${v}`);
  state.dataCounts = { ...counts, predicates: pred };
}
function resolveCluster(entity, visited = new Set()) {
  if (!entity || visited.has(entity.id)) throw new Error(`星团归属循环或缺失：${entity?.id || "null"}`);
  if (entity.type === "school" || entity.type === "text_system") return entity.id;
  visited.add(entity.id);
  const parent = entity.visual?.primaryParent;
  if (!parent) throw new Error(`缺少 primaryParent：${entity.id}`);
  return resolveCluster(state.byId.get(parent), visited);
}
function makeAxis(id) {
  const axis = new THREE.Vector3(lerp(-0.72, 0.72, hash01(`${id}:axis-x`)), lerp(0.55, 1, hash01(`${id}:axis-y`)), lerp(-0.72, 0.72, hash01(`${id}:axis-z`))).normalize();
  return { axis, tilt: [lerp(-0.95, 0.95, hash01(`${id}:tilt-x`)), lerp(-Math.PI, Math.PI, hash01(`${id}:tilt-y`)), lerp(-0.8, 0.8, hash01(`${id}:tilt-z`))] };
}
function buildLayout() {
  const clusters = state.data.entities.filter(e => e.type === "school" || e.type === "text_system").sort((a, b) => yearStart(a) - yearStart(b) || a.id.localeCompare(b.id));
  if (clusters.length !== 21) throw new Error("星团核心不是 21");
  const outer = clusters.filter(e => !CORE_POSITIONS[e.id]);
  let outerIndex = 0;
  for (const c of clusters) {
    let pos;
    if (CORE_POSITIONS[c.id]) pos = new THREE.Vector3(...CORE_POSITIONS[c.id]);
    else {
      const progress = clamp((yearStart(c) - SPAN.start) / (SPAN.end - SPAN.start), 0, 1);
      const yUnit = 1 - ((outerIndex + 0.5) / outer.length) * 2;
      const planar = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));
      const angle = outerIndex * 2.399963 + progress * 2.1;
      const radius = 22 + (outerIndex % 3) * 3.8 + progress * 5.2;
      pos = new THREE.Vector3(Math.cos(angle) * planar * radius, yUnit * radius * 0.78, Math.sin(angle) * planar * radius);
      outerIndex++;
    }
    state.clusterCenters.set(c.id, pos);
    state.clusterFrames.set(c.id, makeAxis(c.id));
  }
  for (const entity of state.data.entities) {
    const clusterId = resolveCluster(entity);
    state.clusterByEntity.set(entity.id, clusterId);
    let basePosition = CORE_POSITIONS[entity.id] ? new THREE.Vector3(...CORE_POSITIONS[entity.id]) : state.clusterCenters.get(clusterId).clone();
    if (!CORE_POSITIONS[entity.id] && entity.type !== "school" && entity.type !== "text_system") {
      const params = entity.type === "work" ? [2.7, 6.4, 0.92, 1.08] : [3.5, 8.1, 1.02, 1.16];
      const [minRadius, maxRadius, yScale, zScale] = params;
      const azimuth = hash01(`${entity.id}:volume-a`) * Math.PI * 2;
      const vertical = lerp(-1, 1, hash01(`${entity.id}:volume-y`));
      const radialPlane = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      const radius = lerp(minRadius, maxRadius, hash01(`${entity.id}:volume-r`) ** 0.72);
      const offset = new THREE.Vector3(Math.cos(azimuth) * radialPlane * radius, vertical * radius * yScale, Math.sin(azimuth) * radialPlane * radius * zScale);
      const frame = state.clusterFrames.get(clusterId);
      offset.applyEuler(new THREE.Euler(frame.tilt[0], frame.tilt[1], frame.tilt[2]));
      basePosition.add(offset);
    }
    if (CORE_IDS.has(entity.id)) {
      state.orbitByEntity.set(entity.id, { basePosition, clusterId, axis: new THREE.Vector3(0, 1, 0), speed: 0 });
    } else {
      const orbitClusterCenter = state.clusterCenters.get(clusterId) || basePosition;
      const orbitDistance = Math.sqrt(orbitClusterCenter.x ** 2 + orbitClusterCenter.z ** 2);
      state.orbitByEntity.set(entity.id, { basePosition, clusterId, axis: state.clusterFrames.get(clusterId)?.axis || new THREE.Vector3(0, 1, 0), speed: 0.00155 + clamp((36 - orbitDistance) / 16, 0, 1) * 0.00105 });
    }
  }
}
function initDom() {
  for (const id of ["life-app", "universe", "node-labels", "tooltip", "a11y-nodes", "detail-panel", "detail-kind", "detail-name", "detail-years", "detail-description", "detail-tags", "detail-actions", "detail-relations", "reset-view", "load-status", "era-label", "year-label", "event-label", "active-hint", "timeline-scale", "time-ticks", "time-range"]) dom[id] = qs(id);
}
function makeGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 160; canvas.height = 160;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(80, 80, 0, 80, 80, 80);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,255,.95)");
  g.addColorStop(0.25, "rgba(255,255,255,.3)");
  g.addColorStop(0.62, "rgba(255,255,255,.055)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 160, 160);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeNebulaTexture(seed) {
  const cacheKey = seed % 11;
  if (scene.nebulaTextures.has(cacheKey)) return scene.nebulaTextures.get(cacheKey);
  const rand = seeded(cacheKey * 7919 + 173);
  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 256, 256);
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 82; i++) {
    const x = 128 + (rand() - 0.5) * 172, y = 128 + (rand() - 0.5) * 112;
    const radius = 12 + rand() * 48, alpha = 0.025 + rand() * 0.075;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(0.38, `rgba(255,255,255,${alpha * 0.66})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 13; i++) {
    const x = 128 + (rand() - 0.5) * 150, y = 128 + (rand() - 0.5) * 80;
    const radius = 16 + rand() * 35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, `rgba(0,0,0,${0.12 + rand() * 0.2})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
  ctx.globalCompositeOperation = "destination-in";
  const edge = ctx.createRadialGradient(128, 128, 35, 128, 128, 126);
  edge.addColorStop(0, "rgba(255,255,255,1)");
  edge.addColorStop(0.58, "rgba(255,255,255,.86)");
  edge.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = edge; ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  scene.nebulaTextures.set(cacheKey, t);
  return t;
}
function createBackgroundLayer(count, size, opacity, seed, radiusMin, radiusMax, brightnessMin, brightnessMax) {
  const rand = seeded(seed);
  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = lerp(radiusMin, radiusMax, rand());
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(lerp(-1, 1, rand()));
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
    const shade = lerp(brightnessMin, brightnessMax, rand());
    colors.set([shade, shade, shade], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ vertexColors: true, size, opacity, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false });
  const pts = new THREE.Points(geo, mat);
  scene.background.add(pts); scene.backgroundStars.push(pts); state.backgroundPointCount += count;
}
function createShootingStars() {
  const rand = seeded(8848);
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const mat = new THREE.LineBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, fog: false });
    const line = new THREE.Line(geo, mat);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: scene.glowTexture, color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    head.scale.set(1.5, 1.5, 1);
    scene.background.add(line, head);
    shootingStars.push({ line, head, random: rand, active: false, nextTime: 8 + i * 18 + rand() * 8, startTime: 0, duration: 1, start: new THREE.Vector3(), travel: new THREE.Vector3() });
  }
}
function beginShootingStar(meteor, time) {
  meteor.active = true; meteor.startTime = time; meteor.duration = 0.75 + meteor.random() * 0.75;
  meteor.start.set(-72 + meteor.random() * 144, 28 + meteor.random() * 48, -25 + meteor.random() * 45);
  meteor.travel.set(32 + meteor.random() * 34, -22 - meteor.random() * 27, -4 + meteor.random() * 8);
}
function updateShootingStars(time) {
  if (state.reducedMotion) return;
  shootingStars.forEach((meteor) => {
    if (!meteor.active && time >= meteor.nextTime) beginShootingStar(meteor, time);
    if (!meteor.active) return;
    const progress = (time - meteor.startTime) / meteor.duration;
    if (progress >= 1) { meteor.active = false; meteor.nextTime = time + 22 + meteor.random() * 30; meteor.line.material.opacity = 0; meteor.head.material.opacity = 0; return; }
    const head = meteor.start.clone().addScaledVector(meteor.travel, progress);
    const tail = head.clone().addScaledVector(meteor.travel, -0.28);
    const position = meteor.line.geometry.getAttribute("position");
    position.setXYZ(0, tail.x, tail.y, tail.z); position.setXYZ(1, head.x, head.y, head.z);
    position.needsUpdate = true;
    const brightness = Math.sin(progress * Math.PI);
    meteor.line.material.opacity = brightness * 0.62;
    meteor.head.material.opacity = brightness * 0.82;
    meteor.head.position.copy(head);
  });
}
function createBackground() {
  createBackgroundLayer(2300, 0.18, 0.48, 101, 85, 235, 0.08, 0.38);
  createBackgroundLayer(620, 0.34, 0.66, 202, 85, 235, 0.24, 0.72);
  createBackgroundLayer(110, 0.62, 0.82, 303, 85, 235, 0.58, 1);
  createShootingStars();
}
function createNode(entity) {
  const style = TYPE_STYLE[entity.type], clusterId = state.clusterByEntity.get(entity.id);
  const isCore = CORE_IDS.has(entity.id);
  const imp = Number(entity.visual?.importance || 1), importanceScale = clamp(imp ** 1.7, 0.64, 1.66);
  const coreScale = isCore ? (entity.type === "work" ? 2.3 : 1.62) : 1;
  const baseSize = style.core * importanceScale * coreScale;
  const brightness = isCore ? 1 : clamp(0.62 + (imp - 0.8) * 0.76, 0.62, 1);
  const nodeColor = isCore ? "#f4ecd8" : colorForCluster(clusterId);
  const breathAmplitude = isCore ? 0.075 : imp >= 1.15 ? 0.045 : 0.008;
  const breathPeriod = isCore ? lerp(5, 7, hash01(`${entity.id}:breath-period`)) : lerp(7, 10, hash01(`${entity.id}:breath-period`));
  const group = new THREE.Group(); group.position.copy(state.orbitByEntity.get(entity.id).basePosition); group.userData.entityId = entity.id;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: scene.glowTexture, color: nodeColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(baseSize * style.glow); glow.raycast = () => {}; group.add(glow);
  const core = new THREE.Sprite(new THREE.SpriteMaterial({ map: scene.glowTexture, color: nodeColor, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  core.scale.setScalar(baseSize); core.userData.entityId = entity.id; group.add(core);
  scene.nodeLayer.add(group);
  const label = node("span", `node-label ${TYPE_STYLE[entity.type].css} ${isCore ? "core-text" : "cluster-tone"}`, entity.shortName || entity.name);
  if (!isCore) label.style.setProperty("--cluster-color", nodeColor);
  dom["node-labels"].appendChild(label); scene.labels.set(entity.id, label);
  const info = { entity, group, core, glow, label, baseSize, brightness, importance: imp, isCore, clusterId, clusterColor: nodeColor, breathAmplitude, breathSpeed: (Math.PI * 2) / breathPeriod, alpha: alphaFor(entity), targetAlpha: alphaFor(entity), pulsePhase: hash01(entity.id) * Math.PI * 2 };
  state.nodes.push(info); state.nodeById.set(entity.id, info); state.pickables.push(core);
}
function createA11yList() {
  clear(dom["a11y-nodes"]);
  for (const entity of state.data.entities) {
    const li = node("li", "");
    const btn = node("button", "", `${TYPE_STYLE[entity.type].label}：${entity.name}`);
    btn.type = "button"; btn.addEventListener("click", () => selectEntity(entity.id, { focus: true }));
    li.appendChild(btn); dom["a11y-nodes"].appendChild(li);
  }
}
function createNebulae() {
  state.clusterCenters.forEach((center, clusterId) => {
    const list = state.data.entities.filter(e => state.clusterByEntity.get(e.id) === clusterId && !CORE_IDS.has(e.id));
    if (!list.length) return;
    const spread = clamp(5.2 + list.length * 0.42, 5.8, 9.5);
    const color = colorForCluster(clusterId);
    const rand = seeded(fnv1a(`${clusterId}:nebula`));
    const frame = state.clusterFrames.get(clusterId);
    const orientation = new THREE.Quaternion().setFromEuler(new THREE.Euler(frame.tilt[0], frame.tilt[1], frame.tilt[2]));
    const orbitAxis = frame.axis;

    const dustCount = Math.min(240, 92 + list.length * 18);
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      const radius = Math.pow(rand(), 0.58) * spread;
      const angle = rand() * Math.PI * 2, vertical = rand() * 2 - 1;
      const radialPlane = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      dustPositions[i * 3] = Math.cos(angle) * radialPlane * radius;
      dustPositions[i * 3 + 1] = vertical * radius * 0.86;
      dustPositions[i * 3 + 2] = Math.sin(angle) * radialPlane * radius * 1.08;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: scene.glowTexture, color, size: 0.42, opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));

    const knotCount = Math.min(18, 7 + list.length * 2);
    const knotPositions = new Float32Array(knotCount * 3);
    for (let i = 0; i < knotCount; i++) {
      const radius = Math.pow(rand(), 1.35) * spread * 0.72;
      const angle = rand() * Math.PI * 2, vertical = rand() * 2 - 1;
      const radialPlane = Math.sqrt(Math.max(0, 1 - vertical * vertical));
      knotPositions[i * 3] = Math.cos(angle) * radialPlane * radius;
      knotPositions[i * 3 + 1] = vertical * radius * 0.72;
      knotPositions[i * 3 + 2] = Math.sin(angle) * radialPlane * radius;
    }
    const knotGeo = new THREE.BufferGeometry();
    knotGeo.setAttribute("position", new THREE.BufferAttribute(knotPositions, 3));
    const knots = new THREE.Points(knotGeo, new THREE.PointsMaterial({ map: scene.glowTexture, color, size: 0.82, opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));

    const hazeLayers = [];
    for (let li = 0; li < 3; li++) {
      const hazeMat = new THREE.MeshBasicMaterial({ map: makeNebulaTexture(fnv1a(clusterId) + li * 37), color, opacity: 0, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), hazeMat);
      const layerScale = 3.5 - li * 0.42;
      haze.scale.set(spread * layerScale, spread * (1.82 - li * 0.1), 1);
      haze.position.set((rand() - 0.5) * 1.8, (rand() - 0.5) * 1.8, (li - 1) * 0.9);
      if (li === 0) haze.rotation.set(0.08, -0.12, rand() * Math.PI * 2);
      if (li === 1) haze.rotation.set(Math.PI * 0.52, 0.16, rand() * Math.PI * 2);
      if (li === 2) haze.rotation.set(-0.14, Math.PI * 0.48, rand() * Math.PI * 2);
      haze.raycast = () => {};
      hazeLayers.push({ sprite: haze, baseRotation: haze.rotation.z, baseScale: haze.scale.clone(), drift: (0.0015 + rand() * 0.002) * (li % 2 ? -1 : 1), opacityFactor: [0.074, 0.052, 0.036][li] });
    }

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: scene.glowTexture, color, opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(spread * 5.4); halo.raycast = () => {};

    const hit = new THREE.Mesh(new THREE.SphereGeometry(spread * 1.08, 14, 9), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false }));
    hit.userData.clusterId = clusterId;

    const group = new THREE.Group(); group.position.copy(center); group.quaternion.copy(orientation);
    group.add(halo, ...hazeLayers.map(l => l.sprite), dust, knots, hit);
    scene.nebulaLayer.add(group); state.nebulaPickables.push(hit);

    const root = state.byId.get(clusterId);
    const distance = Math.sqrt(center.x ** 2 + center.z ** 2);
    state.nebulae.push({ clusterId, group, dust, knots, halo, hitVolume: hit, hazeLayers, spread, basePosition: center.clone(), baseQuaternion: orientation.clone(), axis: orbitAxis, start: root ? yearStart(root) : Math.min(...list.map(yearStart)), speed: 0.00155 + clamp((36 - distance) / 16, 0, 1) * 0.00105, phase: hash01(clusterId) * Math.PI * 2, alpha: 0, targetAlpha: 0, members: list.length });
  });
}
function relationGroup(predicate) { return REL_GROUP[predicate] || "lineage"; }
function relationVisibleBase(rel) {
  if (rel.predicate === "participated_in") return false;
  const group = relationGroup(rel.predicate);
  if (state.relationMode === "none") return false;
  if (state.selectedId && (rel.subject === state.selectedId || rel.object === state.selectedId)) return true;
  if (state.relationMode === "all") return group !== "affiliation";
  return group === state.relationMode;
}
function createRelations() {
  for (const rel of state.data.relations) {
    if (rel.predicate === "participated_in") continue;
    const a = state.nodeById.get(rel.subject), b = state.nodeById.get(rel.object);
    const style = RELATION_STYLE[rel.predicate];
    if (!a || !b || !style) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(new Array(25 * 3).fill(0), 3));
    const mat = new THREE.LineBasicMaterial({ color: style.color, opacity: 0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    const flowParticles = [];
    const flowCount = style.group === "authored" ? 2 : 1;
    for (let pi = 0; pi < flowCount; pi++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: scene.glowTexture, color: style.color, opacity: 0, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }));
      sprite.scale.set(0.36, 0.36, 1); sprite.visible = false; sprite.raycast = () => {};
      scene.flowLayer.add(sprite);
      const particle = { sprite, offset: (pi / flowCount + hash01(`${rel.id}:flow`)) % 1, speed: lerp(0.035, 0.072, hash01(`${rel.id}:flow-speed`)) };
      flowParticles.push(particle); state.flowParticles.push(particle);
    }
    scene.lineLayer.add(line);
    state.relationLines.push({ relation: rel, line, group: style.group, style, startNode: a, endNode: b, flowParticles, opacity: 0, pulsePhase: hash01(`${rel.id}:line-pulse`) * Math.PI * 2 });
  }
  state.drawableRelationCount = state.relationLines.length;
}
function updateRelationGeometry(item) {
  const a = state.nodeById.get(item.relation.subject), b = state.nodeById.get(item.relation.object); if (!a || !b) return;
  const start = a.group.position, end = b.group.position, middle = start.clone().add(end).multiplyScalar(0.5);
  const delta = end.clone().sub(start); let normal = new THREE.Vector3(-delta.y, delta.x, delta.z * 0.3);
  if (normal.lengthSq() < 0.001) normal.set(0, 1, 0); normal.normalize().multiplyScalar(Math.min(4.2, delta.length() * 0.1) * (hash01(item.relation.id) > 0.5 ? 1 : -1)); middle.add(normal);
  const curve = new THREE.QuadraticBezierCurve3(start, middle, end), points = curve.getPoints(24), arr = item.line.geometry.attributes.position.array;
  for (let i = 0; i < points.length; i++) { arr[i * 3] = points[i].x; arr[i * 3 + 1] = points[i].y; arr[i * 3 + 2] = points[i].z; }
  item.line.geometry.attributes.position.needsUpdate = true;
}
function updateGalaxyMotion(delta) {
  if (state.reducedMotion) return;
  state.orbitElapsed += delta;
  state.orbitByEntity.forEach((orbit, entityId) => {
    const n = state.nodeById.get(entityId); if (!n) return;
    n.group.position.copy(orbit.basePosition).applyAxisAngle(orbit.axis, orbit.speed * state.orbitElapsed);
  });
  state.nebulae.forEach((nebula) => {
    const orbitAngle = nebula.speed * state.orbitElapsed;
    nebula.group.position.copy(nebula.basePosition).applyAxisAngle(nebula.axis, orbitAngle);
    scene.orbitQuaternion.setFromAxisAngle(nebula.axis, orbitAngle);
    nebula.group.quaternion.copy(scene.orbitQuaternion).multiply(nebula.baseQuaternion);
    nebula.dust.rotation.y = state.orbitElapsed * 0.012 + nebula.phase;
    nebula.knots.rotation.y = state.orbitElapsed * 0.009 + nebula.phase * 0.7;
    nebula.hazeLayers.forEach((layer) => { layer.sprite.rotation.z = layer.baseRotation + state.orbitElapsed * layer.drift; });
  });
  state.relationLines.forEach(updateRelationGeometry);
}
function updateLineFlow(time) {
  state.relationLines.forEach((item) => {
    const { relation, flowParticles, line } = item;
    const selected = state.selectedId && (relation.subject === state.selectedId || relation.object === state.selectedId);
    const position = line.geometry.getAttribute("position");
    flowParticles.forEach((particle) => {
      if (state.reducedMotion || !line.visible || line.material.opacity < 0.012) { particle.sprite.visible = false; return; }
      const progress = (time * particle.speed + particle.offset) % 1;
      const floatIndex = progress * (position.count - 1);
      const index = Math.min(position.count - 2, Math.floor(floatIndex));
      const mix = floatIndex - index;
      particle.sprite.position.set(lerp(position.getX(index), position.getX(index + 1), mix), lerp(position.getY(index), position.getY(index + 1), mix), lerp(position.getZ(index), position.getZ(index + 1), mix));
      const endpointFade = Math.sin(progress * Math.PI);
      const strength = selected ? 1.25 : 0.58;
      particle.sprite.material.opacity = clamp(line.material.opacity * strength * endpointFade, 0, 0.92);
      const size = selected ? 0.56 : 0.34;
      particle.sprite.scale.set(size, size, 1);
      particle.sprite.visible = true;
    });
  });
}
function nebulaForCluster(clusterId) { return state.nebulae.find(n => n.clusterId === clusterId) || null; }
const focusWorldUp = new THREE.Vector3(0, 1, 0);
const focusOrbitRight = new THREE.Vector3();
const focusOrbitCandidate = new THREE.Vector3();
function rotateFocusedView(deltaX, deltaY) {
  scene.focusDirection.applyAxisAngle(focusWorldUp, -deltaX * 0.0042).normalize();
  focusOrbitRight.crossVectors(focusWorldUp, scene.focusDirection);
  if (focusOrbitRight.lengthSq() < 0.001) focusOrbitRight.set(1, 0, 0);
  focusOrbitRight.normalize();
  focusOrbitCandidate.copy(scene.focusDirection).applyAxisAngle(focusOrbitRight, deltaY * 0.0036).normalize();
  if (Math.abs(focusOrbitCandidate.dot(focusWorldUp)) < 0.94) scene.focusDirection.copy(focusOrbitCandidate);
}
function initThree() {
  try {
    scene.renderer = new THREE.WebGLRenderer({ canvas: dom.universe, antialias: true, alpha: false, powerPreference: "high-performance" });
    scene.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    scene.renderer.setSize(innerWidth, innerHeight);
    scene.renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.scene = new THREE.Scene();
    scene.scene.background = new THREE.Color("#020304");
    scene.scene.fog = new THREE.FogExp2("#020304", 0.0065);
    scene.camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 360);
    scene.camera.position.set(0, 0, CAMERA_HOME);
    scene.camera.lookAt(0, 0, 0);
    scene.glowTexture = makeGlowTexture();
    scene.background = new THREE.Group();
    scene.root = new THREE.Group();
    scene.root.rotation.copy(DEFAULT_ROTATION);
    scene.nebulaLayer = new THREE.Group();
    scene.lineLayer = new THREE.Group();
    scene.flowLayer = new THREE.Group();
    scene.nodeLayer = new THREE.Group();
    scene.root.add(scene.nebulaLayer, scene.lineLayer, scene.flowLayer, scene.nodeLayer);
    scene.scene.add(scene.background, scene.root);
  } catch (error) { state.webglFallback = true; text(dom["load-status"], "三维星图不可用，已切换为列表阅读"); return false; }
  createBackground();
  for (const entity of state.data.entities) createNode(entity);
  createNebulae(); createRelations();
  return true;
}
function updateYear(year, opts = {}) {
  state.year = clamp(Math.round(Number(year) || 1200), SPAN.start, SPAN.end);
  dom["time-range"].value = String(state.year);
  dom["timeline-scale"].setAttribute("aria-valuenow", String(state.year));
  dom["timeline-scale"].setAttribute("aria-valuetext", formatYear(state.year));
  text(dom["year-label"], formatYear(state.year));
  const period = periodForYear(state.year); state.activePeriodId = period?.id || ""; text(dom["era-label"], period ? period.name : "时期过渡");
  const event = eventForYear(state.year); state.activeEventId = event && state.year >= event.temporal.start && state.year <= event.temporal.end ? event.id : "";
  text(dom["event-label"], event ? event.name : "拖动白色刻度，选择历史时刻");
  for (const n of state.nodes) n.targetAlpha = alphaFor(n.entity, state.year);
  updateVisibility(opts.instant);
  updateTimelinePosition();
  if (opts.url !== false) writeLifeRoute({ route: "life-history", entity: state.selectedId || null, year: state.year, yearExplicit: true }, opts.source || "continuous", "replace");
}
function relationTargetOpacity(item) {
  if (!relationVisibleBase(item.relation)) return 0;
  const { relation, startNode, endNode, style } = item;
  const visibility = Math.min(startNode.alpha, endNode.alpha);
  if (visibility < 0.035) return 0;
  const selected = state.selectedId && (relation.subject === state.selectedId || relation.object === state.selectedId);
  if (selected) return clamp(Math.sqrt(visibility) * 1.8 * 0.78, 0.38, 0.78);
  let focusFactor = 1;
  if (state.focusedClusterId) {
    const startFocused = startNode.clusterId === state.focusedClusterId;
    const endFocused = endNode.clusterId === state.focusedClusterId;
    focusFactor = startFocused && endFocused ? 1.35 : startFocused || endFocused ? 0.72 : 0.12;
  }
  return clamp(Math.sqrt(visibility) * style.opacity * focusFactor, 0, style.opacity * 1.35);
}
function updateVisibility(instant = false) {
  if (instant) {
    for (const n of state.nodes) n.alpha = n.targetAlpha;
    state.nebulae.forEach((nebula) => { nebula.targetAlpha = state.year >= nebula.start ? 1 : 0; nebula.alpha = nebula.targetAlpha; });
    for (const item of state.relationLines) item.opacity = relationTargetOpacity(item);
  } else {
    state.nebulae.forEach((nebula) => { nebula.targetAlpha = state.year >= nebula.start ? 1 : 0; });
  }
  let count = 0;
  for (const item of state.relationLines) { if (relationTargetOpacity(item) > 0.003) count++; }
  state.visibleLineCount = count;
}
function renderDetail(entity) {
  text(dom["detail-kind"], TYPE_STYLE[entity.type].label);
  text(dom["detail-name"], entity.name);
  text(dom["detail-years"], formatYears(entity));
  text(dom["detail-description"], displayDescription(entity));
  clear(dom["detail-tags"]); for (const tag of entity.tags || []) dom["detail-tags"].appendChild(node("span", "", tag));
  clear(dom["detail-actions"]);
  const mapped = scholarForEntity(entity.id);
  if (mapped) { const a = node("a", "cross-cosmos-link", `查看${mapped.scholar}注文 ↗`); a.href = `../star-map/?scholar=${encodeURIComponent(mapped.scholar)}`; dom["detail-actions"].appendChild(a); }
  clear(dom["detail-relations"]);
  const title = node("h3", "", "关系"); dom["detail-relations"].appendChild(title);
  let shown = 0;
  for (const rel of state.data.relations) {
    if (rel.predicate === "affiliated_with") continue;
    const subject = rel.subject === entity.id, object = rel.object === entity.id; if (!subject && !object) continue;
    const otherId = subject ? rel.object : rel.subject, other = state.displayById.get(otherId), label = (REL_TEXT[rel.predicate] || [rel.predicate, rel.predicate])[subject ? 0 : 1];
    const row = node("p", rel.reviewStatus === "needs_review" ? "needs-review" : "");
    row.appendChild(node("span", "", `${label} · `));
    if (state.byId.has(otherId)) { const btn = node("button", "", other?.name || otherId); btn.type = "button"; btn.addEventListener("click", () => selectEntity(otherId, { focus: true })); row.appendChild(btn); }
    else row.appendChild(node("span", "", other?.name || otherId));
    if (rel.reviewStatus === "needs_review") row.appendChild(node("em", "", " 待复核"));
    dom["detail-relations"].appendChild(row); if (++shown >= 16) break;
  }
}
let detailTrigger = null;

function selectEntity(id, opts = {}) {
  const info = state.nodeById.get(id); if (!info) return false;
  const same = state.selectedId === id && state.focusLevel === "cluster";
  state.selectedId = id; state.focusedClusterId = info.clusterId; state.focusedNodeId = same || opts.node ? id : ""; state.focusLevel = same || opts.node ? "node" : "cluster";
  const nebula = nebulaForCluster(info.clusterId);
  const direction = scene.camera.position.clone().sub(state.cameraTarget);
  if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
  scene.focusDirection.copy(direction.normalize());
  state.focusDistance = state.focusLevel === "node" ? clamp(10.5 + info.baseSize * 4.2, 10.5, 16.5) : clamp((nebula?.spread || 7) * 3.35, 20, 34);
  scene.selectedObject = info.group; renderDetail(info.entity); updateVisibility(true);
  if (document.activeElement && document.activeElement !== document.body && document.activeElement !== dom["detail-panel"]) detailTrigger = document.activeElement;
  if (opts.focus) setTimeout(function () { dom["detail-name"].setAttribute("tabindex", "-1"); dom["detail-name"].focus(); }, 60);
  if (opts.url !== false) writeLifeRoute(currentLifeRoute(), "user", "push");
  return true;
}
function resetView(resetRotation = false) {
  state.focusedClusterId = ""; state.focusedNodeId = ""; state.focusLevel = "overview"; state.focusDistance = CAMERA_HOME;
  scene.cameraGoalTarget.set(0, 0, 0); scene.cameraGoalPosition.set(0, 0, CAMERA_HOME);
  if (resetRotation && scene.root) scene.root.rotation.copy(DEFAULT_ROTATION);
  scene.selectedObject = state.selectedId ? state.nodeById.get(state.selectedId)?.group || null : null;
  updateVisibility(true);
  if (detailTrigger && typeof detailTrigger.focus === "function") { setTimeout(function () { detailTrigger.focus(); detailTrigger = null; }, 60); }
}
function renderDefaultDetail() {
  text(dom["detail-kind"], "类型：释读宇宙"); text(dom["detail-name"], "拖动星图，观察易学流变"); text(dom["detail-years"], "公元前700年—1989年");
  text(dom["detail-description"], "人物、著作、学派与文本系统在三维空间中结成星团。悬停唤醒星云，单击进入后拖动环绕中心，再次单击同一星体进入近景；按Esc返回全景。");
  clear(dom["detail-tags"]); clear(dom["detail-actions"]); clear(dom["detail-relations"]);
}
function currentLifeRoute() {
  return { route: "life-history", entity: state.selectedId || null, year: state.year, yearExplicit: true };
}
function recordLifeRoute(result) {
  state.parsedRoute = { ...result.route };
  state.canonicalPathAndSearch = result.canonicalPathAndSearch;
  state.routeSignature = result.signature;
  state.invalidParams = result.invalidParams || [];
  state.duplicateParams = result.duplicateParams || [];
}
function writeLifeRoute(route, source = "user", mode = "replace") {
  if (state.isApplyingRoute) return;
  const normalized = parseLifeRoute(serializeLifeRoute(route, location.href), state.routeIndexes);
  recordLifeRoute(normalized);
  const targetPath = normalized.canonicalUrl.pathname + normalized.canonicalUrl.search;
  const currentPath = location.pathname + location.search;
  const nextState = createHistoryState(normalized.route, source);
  const currentState = history.state || {};
  if (currentPath === targetPath && currentState.signature === nextState.signature && currentState.namespace === "yi-cosmos") return;
  const shouldPush = state.routeReady && mode === "push" && currentState.signature !== nextState.signature;
  history[shouldPush ? "pushState" : "replaceState"](nextState, "", targetPath);
  state.lastWriteMode = shouldPush ? "push" : "replace";
  state.lastWriteSource = source;
  if (!shouldPush) state.canonicalReplaceCount += 1;
}
function clearLifeSelectionForRoute() {
  state.selectedId = "";
  state.focusedClusterId = "";
  state.focusedNodeId = "";
  state.focusLevel = "overview"; state.focusDistance = CAMERA_HOME;
  scene.cameraGoalTarget.set(0, 0, 0); scene.cameraGoalPosition.set(0, 0, CAMERA_HOME);
  scene.selectedObject = null;
  renderDefaultDetail();
  updateVisibility(true);
}
function applyParsedLifeRoute(result, source = "init") {
  state.isApplyingRoute = true;
  try {
    recordLifeRoute(result);
    updateYear(result.route.year, { instant: true, url: false });
    if (result.route.entity) selectEntity(result.route.entity, { node: true, url: false });
    else clearLifeSelectionForRoute();
    const canonical = result.canonicalUrl.pathname + result.canonicalUrl.search;
    if (location.pathname + location.search !== canonical || !history.state || history.state.signature !== result.signature) {
      history.replaceState(createHistoryState(result.route, source === "popstate" ? "popstate" : (source === "init" ? "init" : "canonicalize")), "", canonical);
      state.lastWriteMode = "replace";
      state.lastWriteSource = source === "popstate" ? "popstate" : (source === "init" ? "init" : "canonicalize");
      state.canonicalReplaceCount += 1;
    }
  } finally {
    state.isApplyingRoute = false;
  }
}
function restoreFromUrl(source = "init") {
  const result = parseLifeRoute(location.href, state.routeIndexes);
  applyParsedLifeRoute(result, source);
  state.routeReady = true;
}
function onLifePopState() {
  if (!state.routeReady || !state.routeIndexes) return;
  state.popstateApplyCount += 1;
  restoreFromUrl("popstate");
}
function buildTicks() {
  clear(dom["time-ticks"]);
  const count = 160;
  for (let i = 0; i <= count; i++) { const t = node("i", i % 12 === 0 ? "time-tick major" : i % 4 === 0 ? "time-tick medium" : "time-tick"); t.style.left = `${(i / count) * 100}%`; dom["time-ticks"].appendChild(t); }
  for (const event of state.data.events) { const position = (event.temporal.start - SPAN.start) / (SPAN.end - SPAN.start); const t = node("i", "time-tick event"); t.title = event.name; t.style.left = `${clamp(position, 0, 1) * 100}%`; dom["time-ticks"].appendChild(t); }
  updateTimelinePosition();
}
function updateTimelinePosition() {
  const viewportWidth = dom["timeline-scale"].clientWidth || Math.max(600, innerWidth - 60);
  state.timelineTrackWidth = Math.max(2300, viewportWidth * 2.65);
  const progress = (state.year - SPAN.start) / (SPAN.end - SPAN.start);
  const offset = viewportWidth / 2 - progress * state.timelineTrackWidth;
  dom["time-ticks"].style.width = `${state.timelineTrackWidth}px`;
  dom["time-ticks"].style.transform = `translate3d(${offset}px, 0, 0)`;
}
function bindEvents() {
  dom["reset-view"].addEventListener("click", () => resetView(true));
  dom["time-range"].addEventListener("input", e => updateYear(e.currentTarget.value));
  dom["timeline-scale"].addEventListener("pointerdown", e => { state.timelineDragging = true; state.timelineMoved = false; state.timelineStartX = e.clientX; state.timelineStartYear = state.year; dom["timeline-scale"].setPointerCapture(e.pointerId); dom["timeline-scale"].classList.add("dragging"); e.preventDefault(); });
  dom["timeline-scale"].addEventListener("pointermove", e => { if (!state.timelineDragging) return; const deltaX = e.clientX - state.timelineStartX; if (Math.abs(deltaX) > 2) state.timelineMoved = true; const yearsPerPixel = (SPAN.end - SPAN.start) / state.timelineTrackWidth; updateYear(state.timelineStartYear - deltaX * yearsPerPixel); });
  const finishTimelineDrag = e => { if (!state.timelineDragging) return; if (!state.timelineMoved) { const r = dom["timeline-scale"].getBoundingClientRect(); const yearsPerPixel = (SPAN.end - SPAN.start) / state.timelineTrackWidth; updateYear(state.year + (e.clientX - (r.left + r.width / 2)) * yearsPerPixel); } state.timelineDragging = false; dom["timeline-scale"].classList.remove("dragging"); if (dom["timeline-scale"].hasPointerCapture(e.pointerId)) dom["timeline-scale"].releasePointerCapture(e.pointerId); };
  dom["timeline-scale"].addEventListener("pointerup", finishTimelineDrag);
  dom["timeline-scale"].addEventListener("pointercancel", finishTimelineDrag);
  dom["timeline-scale"].addEventListener("keydown", e => {
    let delta = e.shiftKey ? 25 : 5;
    if (e.key === "ArrowLeft") updateYear(state.year - delta); else if (e.key === "ArrowRight") updateYear(state.year + delta); else if (e.key === "Home") updateYear(SPAN.start); else if (e.key === "End") updateYear(SPAN.end); else return;
    e.preventDefault();
  });
  for (const b of document.querySelectorAll("[data-relation-mode]")) b.addEventListener("click", () => { state.relationMode = b.dataset.relationMode; document.querySelectorAll("[data-relation-mode]").forEach(x => { const on = x === b; x.classList.toggle("active", on); x.setAttribute("aria-pressed", String(on)); }); updateVisibility(true); });
  addEventListener("keydown", e => { if (e.key === "Escape" && state.focusedClusterId) resetView(false); });
  addEventListener("resize", () => { if (scene.renderer && scene.camera) { scene.camera.aspect = innerWidth / innerHeight; scene.camera.updateProjectionMatrix(); scene.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75)); scene.renderer.setSize(innerWidth, innerHeight); buildTicks(); } });
  dom.universe.addEventListener("pointerdown", e => { scene.dragging = true; scene.dragMoved = false; scene.dragStart = { x: e.clientX, y: e.clientY }; dom.universe.setPointerCapture(e.pointerId); dom.universe.classList.add("dragging"); });
  addEventListener("pointermove", e => {
    if (scene.dragging) {
      const dx = e.clientX - scene.dragStart.x, dy = e.clientY - scene.dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) scene.dragMoved = true;
      if (state.focusedClusterId) { rotateFocusedView(dx, dy); }
      else { scene.root.rotation.y += dx * 0.0042; scene.root.rotation.x = clamp(scene.root.rotation.x + dy * 0.0036, -1.25, 1.25); }
      scene.dragStart.x = e.clientX; scene.dragStart.y = e.clientY;
      showTooltip(null);
      return;
    }
    if (!scene.camera || state.webglFallback) return;
    const node = pickNode(e.clientX, e.clientY);
    const nebula = node ? null : pickNebula(e.clientX, e.clientY);
    state.hoveredId = node?.entity.id || "";
    state.hoveredClusterId = node?.clusterId || nebula?.clusterId || "";
    dom.universe.classList.toggle("interactive", Boolean(node || nebula));
    showTooltip(node || nebula, e.clientX, e.clientY);
  });
  addEventListener("pointerup", e => {
    if (!scene.dragging) return;
    scene.dragging = false; dom.universe.classList.remove("dragging");
    if (dom.universe.hasPointerCapture(e.pointerId)) dom.universe.releasePointerCapture(e.pointerId);
    if (!scene.dragMoved) pickAt(e.clientX, e.clientY);
  });
  dom.universe.addEventListener("pointercancel", () => { scene.dragging = false; dom.universe.classList.remove("dragging"); });
  dom.universe.addEventListener("pointerleave", () => { if (!scene.dragging) { state.hoveredId = ""; state.hoveredClusterId = ""; dom.universe.classList.remove("interactive"); showTooltip(null); } });
  dom.universe.addEventListener("wheel", e => {
    e.preventDefault();
    if (state.focusedClusterId) {
      const minD = state.focusLevel === "node" ? 7.5 : 14, maxD = state.focusLevel === "node" ? 28 : 52;
      state.focusDistance = clamp(state.focusDistance + e.deltaY * 0.025, minD, maxD);
    } else {
      scene.cameraGoalPosition.z = clamp(scene.cameraGoalPosition.z + e.deltaY * 0.045, CAMERA_MIN, CAMERA_MAX);
    }
  }, { passive: false });
  addEventListener("popstate", onLifePopState);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) { if (scene.raf) { cancelAnimationFrame(scene.raf); scene.raf = 0; } }
    else { if (!scene.raf) animate(); }
  });
  var rmq = matchMedia("(prefers-reduced-motion: reduce)");
  if (rmq.addEventListener) rmq.addEventListener("change", function (e) { state.reducedMotion = e.matches; });
  else if (rmq.addListener) rmq.addListener(function (e) { state.reducedMotion = e.matches; });
}
function showTooltip(target, clientX, clientY) {
  if (!target) { dom["tooltip"].hidden = true; return; }
  const tip = dom["tooltip"];
  tip.textContent = "";
  const strong = document.createElement("strong");
  const span = document.createElement("span");
  if (target.entity) {
    strong.textContent = target.entity.name;
    span.textContent = `${TYPE_STYLE[target.entity.type].label} · ${formatYears(target.entity)}`;
  } else {
    const root = state.byId.get(target.clusterId);
    const memberCount = state.nodes.filter(n => n.clusterId === target.clusterId).length;
    strong.textContent = root?.name || "学术星云";
    span.textContent = `星云 · ${memberCount}颗星 · 单击进入`;
  }
  tip.appendChild(strong);
  tip.appendChild(span);
  dom["tooltip"].style.left = `${clientX + 16}px`;
  dom["tooltip"].style.top = `${clientY + 14}px`;
  dom["tooltip"].style.transform = "none";
  dom["tooltip"].hidden = false;
}
function pickNode(clientX, clientY) {
  if (!scene.camera) return null;
  const r = dom.universe.getBoundingClientRect();
  scene.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  scene.raycaster.setFromCamera(scene.pointer, scene.camera);
  const hits = scene.raycaster.intersectObjects(state.pickables, false);
  for (const hit of hits) {
    const n = state.nodeById.get(hit.object.userData.entityId);
    if (n && n.alpha > 0.08) return n;
  }
  return null;
}
function pickNebula(clientX, clientY) {
  if (!scene.camera) return null;
  const r = dom.universe.getBoundingClientRect();
  scene.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  scene.raycaster.setFromCamera(scene.pointer, scene.camera);
  const hits = scene.raycaster.intersectObjects(state.nebulaPickables, false);
  for (const hit of hits) {
    const nebula = nebulaForCluster(hit.object.userData.clusterId);
    if (nebula && nebula.alpha > 0.08) return nebula;
  }
  return null;
}
function activateNebula(clusterId) {
  if (!clusterId) return;
  if (state.byId.has(clusterId)) { selectEntity(clusterId, { focus: true }); return; }
  const nebula = nebulaForCluster(clusterId);
  const direction = scene.camera.position.clone().sub(state.cameraTarget);
  if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
  scene.focusDirection.copy(direction.normalize());
  state.focusedClusterId = clusterId; state.focusedNodeId = ""; state.focusLevel = "cluster";
  state.focusDistance = clamp((nebula?.spread || 7) * 3.35, 20, 34);
  scene.selectedObject = nebula?.group || null;
  updateVisibility(true);
}
function pickAt(x, y) {
  const node = pickNode(x, y);
  if (node) { selectEntity(node.entity.id, {}); return; }
  const nebula = pickNebula(x, y);
  if (nebula) { activateNebula(nebula.clusterId); return; }
  if (state.focusedClusterId) resetView(false); else resetView(false);
}
function updateCamera(ease) {
  if (state.focusedClusterId) {
    const targetObject = state.focusLevel === "node"
      ? state.nodeById.get(state.focusedNodeId)?.group
      : state.nodeById.get(state.focusedClusterId)?.group || nebulaForCluster(state.focusedClusterId)?.group;
    if (targetObject) {
      targetObject.getWorldPosition(scene.focusWorldPosition);
      scene.cameraGoalTarget.copy(scene.focusWorldPosition);
      scene.desiredCameraPosition.copy(scene.focusWorldPosition).addScaledVector(scene.focusDirection, state.focusDistance);
      scene.cameraGoalPosition.copy(scene.desiredCameraPosition);
    }
  }
  const cameraEase = Math.min(1, ease * 0.92);
  state.cameraTarget.lerp(scene.cameraGoalTarget, cameraEase);
  scene.camera.position.lerp(scene.cameraGoalPosition, cameraEase);
  scene.camera.lookAt(state.cameraTarget);
}
function syncProjectionMatrices() {
  scene.scene.updateMatrixWorld(true);
  scene.camera.updateMatrixWorld(true);
}
function projectLabels() {
  if (!scene.camera) return;
  const width = innerWidth, height = innerHeight;
  for (const n of state.nodes) {
    const label = scene.labels.get(n.entity.id); if (!label) continue;
    const selected = n.entity.id === state.selectedId, hovered = n.entity.id === state.hoveredId;
    const clusterHovered = n.clusterId && n.clusterId === state.hoveredClusterId;
    const contextOpacity = state.focusedClusterId && n.clusterId !== state.focusedClusterId ? (n.isCore ? 0.48 : 0.23) : 1;
    let threshold = n.entity.type === "person" ? 0.46 : n.entity.type === "work" ? 0.2 : 0.1;
    if (selected || hovered || clusterHovered) threshold = 0.02;
    if (n.alpha < threshold) { label.style.opacity = "0"; label.style.visibility = "hidden"; continue; }
    n.group.getWorldPosition(scene.worldPosition);
    scene.projected.copy(scene.worldPosition).project(scene.camera);
    const visible = scene.projected.z > -1 && scene.projected.z < 1 && Math.abs(scene.projected.x) < 1.12 && Math.abs(scene.projected.y) < 1.12;
    if (!visible) { label.style.opacity = "0"; label.style.visibility = "hidden"; continue; }
    const x = (scene.projected.x * 0.5 + 0.5) * width, y = (-scene.projected.y * 0.5 + 0.5) * height;
    const depthFade = clamp(1.12 - (scene.projected.z + 1) * 0.24, 0.48, 1);
    const opacity = clamp(n.alpha * depthFade * contextOpacity * (selected || hovered ? 1.4 : clusterHovered ? 1.1 : 1), 0, 1);
    label.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -150%)`;
    label.style.opacity = String(opacity);
    label.style.visibility = "visible";
    label.style.zIndex = String(Math.round((1 - scene.projected.z) * 1000));
    label.classList.toggle("selected", selected);
  }
}
function animate() {
  scene.raf = requestAnimationFrame(animate);
  const delta = Math.min(scene.clock.getDelta(), 0.05);
  const time = scene.clock.elapsedTime;
  const ease = 1 - Math.exp(-delta * 5.5);
  updateGalaxyMotion(delta);
  updateCamera(ease);
  for (const n of state.nodes) {
    n.alpha += (n.targetAlpha - n.alpha) * ease;
    const selected = n.entity.id === state.selectedId, hovered = n.entity.id === state.hoveredId;
    const clusterHovered = n.clusterId && n.clusterId === state.hoveredClusterId;
    const contextOpacity = state.focusedClusterId && n.clusterId !== state.focusedClusterId ? (n.isCore ? 0.48 : 0.23) : 1;
    const hoverFlicker = hovered && !state.reducedMotion ? 1 + Math.sin(time * 7.2 + n.pulsePhase) * 0.1 + Math.sin(time * 13.7) * 0.035 : 1;
    const boost = selected ? 1.38 : hovered ? 1.3 * hoverFlicker : clusterHovered ? 1.06 : 1;
    const breathWave = state.reducedMotion || selected || hovered ? 0 : Math.sin(time * n.breathSpeed + n.pulsePhase);
    const pulse = 1 + breathWave * n.breathAmplitude;
    const lightPulse = 1 + breathWave * (n.isCore ? 0.13 : n.importance >= 1.15 ? 0.085 : 0.018);
    const coreGlow = n.isCore ? 0.52 : 0.2 + clamp(n.importance - 0.8, 0, 0.6) * 0.18;
    n.core.material.opacity = clamp(n.alpha * n.brightness * boost * lightPulse * contextOpacity, 0, 1);
    n.glow.material.opacity = clamp(n.alpha * n.brightness * (selected ? 0.62 : hovered ? 0.56 : clusterHovered ? coreGlow * 1.32 : coreGlow) * lightPulse * contextOpacity, 0, 0.82);
    n.core.scale.setScalar(n.baseSize * pulse * boost);
    n.glow.scale.setScalar(n.baseSize * TYPE_STYLE[n.entity.type].glow * pulse * (selected ? 1.22 : 1));
    n.group.visible = n.alpha > 0.004;
  }
  for (const nebula of state.nebulae) {
    nebula.alpha += (nebula.targetAlpha - nebula.alpha) * ease;
    const hovered = nebula.clusterId === state.hoveredClusterId, focused = nebula.clusterId === state.focusedClusterId;
    const contextOpacity = state.focusedClusterId && !focused ? 0.18 : 1;
    const interactionBoost = hovered ? 2.25 : focused ? 1.58 : 1;
    const cloudPulse = state.reducedMotion ? 1 : 1 + Math.sin(time * 0.14 + nebula.phase) * 0.08;
    nebula.dust.material.opacity = nebula.alpha * 0.19 * cloudPulse * interactionBoost * contextOpacity;
    nebula.knots.material.opacity = nebula.alpha * 0.34 * cloudPulse * interactionBoost * contextOpacity;
    nebula.halo.material.opacity = nebula.alpha * (hovered ? 0.2 : focused ? 0.095 : 0) * cloudPulse;
    nebula.hazeLayers.forEach((layer) => {
      layer.sprite.material.opacity = nebula.alpha * layer.opacityFactor * cloudPulse * interactionBoost * contextOpacity;
      const scaleBoost = hovered ? 1.1 : focused ? 1.045 : 1;
      layer.sprite.scale.copy(layer.baseScale).multiplyScalar(scaleBoost);
    });
    nebula.group.visible = nebula.alpha > 0.004;
  }
  for (const item of state.relationLines) {
    const target = relationTargetOpacity(item);
    item.opacity += (target - item.opacity) * ease;
    const linePulse = state.reducedMotion ? 1 : 1 + Math.sin(time * 0.72 + item.pulsePhase) * 0.07;
    item.line.material.opacity = clamp(item.opacity * linePulse, 0, 0.84);
    item.line.visible = item.opacity > 0.003;
  }
  updateLineFlow(time);
  if (scene.background) {
    scene.background.rotation.x = scene.root.rotation.x * 0.12;
    scene.background.rotation.y = scene.root.rotation.y * 0.12 + (state.reducedMotion ? 0 : time * 0.003);
    scene.background.rotation.z = scene.root.rotation.z * 0.08;
  }
  updateShootingStars(time);
  syncProjectionMatrices();
  projectLabels();
  scene.renderer.render(scene.scene, scene.camera);
}
function getDiagnostics() {
  return {
    dataCounts: { ...state.dataCounts }, currentYear: state.year, activePeriodId: state.activePeriodId, activeEventId: state.activeEventId,
    relationMode: state.relationMode, selectedId: state.selectedId, focusedClusterId: state.focusedClusterId, focusedNodeId: state.focusedNodeId,
    focusLevel: state.focusLevel, nodeCount: state.nodes.length, labelCount: scene.labels.size, a11yButtonCount: dom["a11y-nodes"].querySelectorAll("button").length,
    nebulaCount: state.nebulae.length, drawableRelationCount: state.drawableRelationCount, visibleNodeCount: state.nodes.filter(n => n.alpha > 0.08).length,
    visibleLineCount: state.visibleLineCount, backgroundPointCount: state.backgroundPointCount, cameraPosition: scene.camera ? { x: scene.camera.position.x, y: scene.camera.position.y, z: scene.camera.position.z } : null,
    cameraTarget: { x: state.cameraTarget.x, y: state.cameraTarget.y, z: state.cameraTarget.z }, threeObjectCounts: scene.scene ? { sceneChildren: scene.scene.children.length, rootChildren: scene.root.children.length, geometries: scene.renderer?.info.memory.geometries || 0, textures: scene.renderer?.info.memory.textures || 0 } : { sceneChildren: 0, rootChildren: 0, geometries: 0, textures: 0 },
    webglFallback: state.webglFallback
  };
}
function getRouteDiagnostics() {
  return {
    version: ROUTE_STATE_VERSION,
    route: "life-history",
    routeReady: state.routeReady,
    isApplyingRoute: state.isApplyingRoute,
    parsedState: state.parsedRoute,
    canonicalPathAndSearch: state.canonicalPathAndSearch,
    signature: state.routeSignature || routeSignature(currentLifeRoute()),
    historyStateNamespace: history.state?.namespace || null,
    historyStateVersion: history.state?.version || null,
    historyLength: history.length,
    lastWriteMode: state.lastWriteMode,
    lastWriteSource: state.lastWriteSource,
    popstateApplyCount: state.popstateApplyCount,
    canonicalReplaceCount: state.canonicalReplaceCount,
    invalidParams: [...state.invalidParams],
    duplicateParams: [...state.duplicateParams],
    fetchCount: state.fetchCount,
    dataReady: state.dataReady,
    viewReady: state.viewReady
  };
}
function fallbackList() {
  state.webglFallback = true; text(dom["load-status"], "三维星图不可用，已切换为列表阅读"); createA11yList(); renderDefaultDetail(); state.viewReady = true; restoreFromUrl();
}
async function main() {
  initDom();
  try {
    const { lifeHistoryData } = await loadLifeHistoryData();
    state.fetchCount += 1;
    state.data = lifeHistoryData; validateData(lifeHistoryData);
    for (const e of lifeHistoryData.entities) { state.byId.set(e.id, e); state.displayById.set(e.id, e); }
    for (const e of lifeHistoryData.events) state.displayById.set(e.id, e);
    for (const c of lifeHistoryData.concepts) state.displayById.set(c.id, c);
    state.routeIndexes = Object.freeze({
      entityById: state.byId,
      timeSpan: SPAN,
      defaultYear: 1200,
      visualIntervalFor: yearOf
    });
    state.dataReady = true;
    buildLayout(); buildTicks(); bindEvents();
    if (initThree()) { createA11yList(); renderDefaultDetail(); text(dom["load-status"], "117颗星 · 190条关系"); state.viewReady = true; updateYear(1200, { instant: true, url: false }); restoreFromUrl(); animate(); }
    else fallbackList();
    state.initialized = true;
    extendQuality();
  } catch (error) {
    console.error(error);
    text(dom["load-status"], "生命史数据加载失败，页面其他部分仍可使用。");
  }
}
Object.defineProperty(window, "__YI_LIFE_DIAGNOSTICS__", { configurable: true, value: getDiagnostics });
Object.defineProperty(window, "__YI_ROUTE_DIAGNOSTICS__", { configurable: true, value: getRouteDiagnostics });

function extendQuality() {
  if (!window.__YI_QUALITY__) return;
  var baseRead = window.__YI_QUALITY__.read;
  window.__YI_QUALITY__.read = function () {
    var base = baseRead ? baseRead() : {};
    return Object.assign(base, {
      page: "life-history",
      dataReady: state.dataReady,
      viewReady: state.viewReady,
      selectedId: state.selectedId,
      focusLevel: state.focusLevel,
      reducedMotion: state.reducedMotion,
      animationRunning: Boolean(scene.raf),
      webglAvailable: Boolean(scene.renderer)
    });
  };
}
addEventListener("beforeunload", () => { if (scene.raf) cancelAnimationFrame(scene.raf); clearLifeHistoryDataCache(); });
main();
