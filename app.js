import * as THREE from './node_modules/three/build/three.module.js';
import { lifeHistoryUrl } from './data/scholar-life-map.js';

const DATA_VERSION = '20260713-white-hexagrams-v1';

const TRIGRAM_INFO = {
  '乾': { color: '#d8b66c', index: 0, nature: '天' },
  '兌': { color: '#7ccfc5', index: 1, nature: '澤' },
  '離': { color: '#e17a62', index: 2, nature: '火' },
  '震': { color: '#8dbd66', index: 3, nature: '雷' },
  '巽': { color: '#69b8a6', index: 4, nature: '風' },
  '坎': { color: '#5a91cf', index: 5, nature: '水' },
  '艮': { color: '#b08a73', index: 6, nature: '山' },
  '坤': { color: '#a99abd', index: 7, nature: '地' },
};
const STAR_COLOR = new THREE.Color('#ffffff');
const HEXAGRAM_COLOR = '#ffffff';

const dom = {
  canvas: document.querySelector('#universe'),
  grid: document.querySelector('#hexagram-grid'),
  filters: document.querySelector('#trigram-filters'),
  search: document.querySelector('#search'),
  filterStatus: document.querySelector('#filter-status'),
  dataStatus: document.querySelector('#data-status'),
  detail: document.querySelector('#detail-panel'),
  detailContent: document.querySelector('#detail-content'),
  closeDetail: document.querySelector('#close-detail'),
  index: document.querySelector('#index-panel'),
  toggleIndex: document.querySelector('#toggle-index'),
  reset: document.querySelector('#reset-view'),
  hover: document.querySelector('#hover-tip'),
  labels: document.querySelector('#hexagram-labels'),
  lineControls: document.querySelector('#line-controls'),
  scholarSelect: document.querySelector('#scholar-select'),
  lineDescription: document.querySelector('#line-description'),
  focusStage: document.querySelector('#focus-stage'),
  focusHexagram: document.querySelector('#focus-hexagram'),
  focusKicker: document.querySelector('#focus-kicker'),
  focusTitle: document.querySelector('#focus-title'),
  focusStar: document.querySelector('#focus-star'),
  focusStarLabel: document.querySelector('#focus-star-label'),
};

const state = {
  data: null,
  selected: null,
  activeTrigram: null,
  query: '',
  meshes: [],
  pointerDown: null,
  dragging: false,
  semanticByNumber: new Map(),
  lineLayers: {},
  lineParticipants: {},
  activeLineMode: 'sequence',
  activeScholar: null,
  selectedLineId: null,
  focusedMesh: null,
  hoveredMesh: null,
  scholarLayout: null,
  scholarLayoutCache: new Map(),
  urlSyncReady: false,
};

function syncDeepLink() {
  if (!state.urlSyncReady) return;
  const url = new URL(window.location.href);
  if (state.selected) url.searchParams.set('hex', String(state.selected.number));
  else url.searchParams.delete('hex');

  const selectedLine = state.selected && state.selectedLineId
    ? getPrimaryLines(state.selected).find((line) => line.id === state.selectedLineId)
    : null;
  if (selectedLine?.linePosition) url.searchParams.set('line', String(selectedLine.linePosition));
  else url.searchParams.delete('line');

  if (state.activeLineMode === 'scholar' && state.activeScholar) url.searchParams.set('scholar', state.activeScholar);
  else url.searchParams.delete('scholar');
  history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

function scholarHistoryLink(scholar) {
  const href = lifeHistoryUrl(scholar);
  if (!href) return '';
  return `<a class="cross-cosmos-link" href="${escapeHtml(href)}">查看${escapeHtml(scholar)}的历史位置 <span>↗</span></a>`;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#000000');
scene.fog = new THREE.FogExp2('#000000', 0.0065);

const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 4, 124);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const cosmos = new THREE.Group();
scene.add(cosmos);
const universe = new THREE.Group();
const DEFAULT_ROTATION = new THREE.Euler(-.24, .08, -.025);
const starLayer = new THREE.Group();
cosmos.add(starLayer, universe);
cosmos.rotation.copy(DEFAULT_ROTATION);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const polyhedronPositions = [];
const polyhedronDirections = [];
const shootingStars = [];
let textLengthScale = { min: 0, max: 1 };

function seededRandom(seed = 20260711) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function makeGlowTexture(color = '#ffffff') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.12, color);
  gradient.addColorStop(.36, `${color}88`);
  gradient.addColorStop(1, '#00000000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarField({ count, size, opacity, seed, brightnessMin, brightnessMax }) {
  const random = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const radius = 85 + random() * 150;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    const shade = brightnessMin + random() * (brightnessMax - brightnessMin);
    colors.set([shade, shade, shade], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, opacity, sizeAttenuation: true, depthWrite: false, fog: false });
  starLayer.add(new THREE.Points(geometry, material));
}

function createShootingStars() {
  const random = seededRandom(8848);
  const glow = makeGlowTexture('#ffffff');
  for (let index = 0; index < 2; index++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const material = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false });
    const line = new THREE.Line(geometry, material);
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    head.scale.set(1.5, 1.5, 1);
    starLayer.add(line, head);
    shootingStars.push({
      line, head, random, active: false, nextTime: 8 + index * 18 + random() * 8,
      startTime: 0, duration: 1, start: new THREE.Vector3(), travel: new THREE.Vector3(),
    });
  }
}

function beginShootingStar(meteor, time) {
  meteor.active = true;
  meteor.startTime = time;
  meteor.duration = .75 + meteor.random() * .75;
  meteor.start.set(-72 + meteor.random() * 144, 28 + meteor.random() * 48, -25 + meteor.random() * 45);
  meteor.travel.set(32 + meteor.random() * 34, -22 - meteor.random() * 27, -4 + meteor.random() * 8);
}

function updateShootingStars(time) {
  shootingStars.forEach((meteor) => {
    if (!meteor.active && time >= meteor.nextTime) beginShootingStar(meteor, time);
    if (!meteor.active) return;
    const progress = (time - meteor.startTime) / meteor.duration;
    if (progress >= 1) {
      meteor.active = false;
      meteor.nextTime = time + 22 + meteor.random() * 30;
      meteor.line.material.opacity = 0;
      meteor.head.material.opacity = 0;
      return;
    }
    const head = meteor.start.clone().addScaledVector(meteor.travel, progress);
    const tail = head.clone().addScaledVector(meteor.travel, -.28);
    const position = meteor.line.geometry.getAttribute('position');
    position.setXYZ(0, tail.x, tail.y, tail.z);
    position.setXYZ(1, head.x, head.y, head.z);
    position.needsUpdate = true;
    const brightness = Math.sin(progress * Math.PI);
    meteor.line.material.opacity = brightness * .62;
    meteor.head.material.opacity = brightness * .82;
    meteor.head.position.copy(head);
  });
}

function createBackground() {
  createStarField({ count: 2300, size: .18, opacity: .48, seed: 101, brightnessMin: .08, brightnessMax: .38 });
  createStarField({ count: 620, size: .34, opacity: .66, seed: 202, brightnessMin: .24, brightnessMax: .72 });
  createStarField({ count: 110, size: .62, opacity: .82, seed: 303, brightnessMin: .58, brightnessMax: 1 });
  createShootingStars();
}

function prepareTextLengthScale() {
  const logs = state.data.hexagrams.map((hexagram) => Math.log1p(hexagram.textLength));
  textLengthScale = { min: Math.min(...logs), max: Math.max(...logs) };
}

function getHexDirection(hexagram) {
  const index = hexagram.number - 1;
  if (polyhedronDirections[index]) return polyhedronDirections[index].clone();
  const semantic = state.semanticByNumber.get(hexagram.number);
  let point;
  if (semantic?.direction?.length === 3) {
    point = new THREE.Vector3(...semantic.direction).normalize();
  } else {
    const y = 1 - (index / 63) * 2;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = index * Math.PI * (3 - Math.sqrt(5));
    point = new THREE.Vector3(Math.cos(angle) * radial, y, Math.sin(angle) * radial).normalize();
  }
  polyhedronDirections[index] = point;
  return point.clone();
}

function getHexPosition(hexagram) {
  const index = hexagram.number - 1;
  if (polyhedronPositions[index]) return polyhedronPositions[index].clone();
  // Logarithmic scaling keeps long chapters visible without letting them dominate the entire form.
  const logLength = Math.log1p(hexagram.textLength);
  const span = Math.max(.0001, textLengthScale.max - textLengthScale.min);
  const normalized = (logLength - textLengthScale.min) / span;
  const radius = 15 + normalized * 35;
  const point = getHexDirection(hexagram).multiplyScalar(radius);
  polyhedronPositions[index] = point;
  return point.clone();
}

function createPolyline(hexagrams, opacity = .34) {
  const geometry = new THREE.BufferGeometry().setFromPoints(hexagrams.map(getHexPosition));
  return new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false }));
}

function createLineSegments(pairs, opacity = .16) {
  const points = pairs.flatMap(([source, target]) => [getHexPosition(source), getHexPosition(target)]);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity, depthWrite: false }));
}

function createRelationPairs() {
  const hexagrams = state.data.hexagrams;
  const byLines = new Map(hexagrams.map((hexagram) => [hexagram.lines.join(''), hexagram]));
  const pairKeys = new Set();
  const relationPairs = [];
  const connect = (source, target) => {
    if (!target || source.number === target.number) return;
    const key = [source.number, target.number].sort((a, b) => a - b).join('-');
    if (pairKeys.has(key)) return;
    pairKeys.add(key);
    relationPairs.push([source, target]);
  };
  hexagrams.forEach((hexagram) => {
    connect(hexagram, byLines.get(hexagram.lines.map((line) => 1 - line).join(''))); // 錯卦
    connect(hexagram, byLines.get([...hexagram.lines].reverse().join(''))); // 綜卦
  });
  return relationPairs;
}

function getHexScholars(hexagram) {
  if (!hexagram._scholarSet) {
    hexagram._scholarSet = new Set(hexagram.scholarNames ?? []);
  }
  return hexagram._scholarSet;
}

function scholarMaterialsForSection(section, scholar) {
  return {
    annotations: (section?.annotations ?? []).filter((item) => item.scholar === scholar),
    variants: (section?.variants ?? []).filter((item) => item.scholar === scholar),
  };
}

function scholarAnnotationsForHexagram(hexagram, scholar) {
  return hexagram.sections.flatMap((section) => section.annotations ?? []).filter((item) => item.scholar === scholar);
}

function tokenizeScholarText(text) {
  const tokens = [];
  const sequences = String(text ?? '').match(/[0-9A-Za-z\u3400-\u9fff]+/g) ?? [];
  sequences.forEach((sequence) => {
    const chars = [...sequence];
    if (chars.length === 1) tokens.push(chars[0]);
    for (let index = 0; index < chars.length - 1; index++) tokens.push(chars[index] + chars[index + 1]);
  });
  return tokens;
}

function hashToken(token, salt) {
  let hash = 2166136261;
  const value = `${salt}|${token}`;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295 * 2 - 1;
}

function buildScholarLayout(scholar) {
  if (state.scholarLayoutCache.has(scholar)) return state.scholarLayoutCache.get(scholar);
  const profiles = state.data.hexagrams.map((hexagram) => {
    const annotations = scholarAnnotationsForHexagram(hexagram, scholar);
    const text = annotations.map((item) => item.text).join('');
    const tokenCounts = new Map();
    tokenizeScholarText(text).forEach((token) => tokenCounts.set(token, (tokenCounts.get(token) ?? 0) + 1));
    return { hexagram, annotations, text, tokenCounts, textLength: [...text].length };
  }).filter((profile) => profile.annotations.length);

  const documentFrequency = new Map();
  profiles.forEach((profile) => {
    profile.tokenCounts.forEach((_, token) => documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1));
  });
  const masses = profiles.map((profile) => Math.log1p(profile.textLength + profile.annotations.length * 18));
  const minMass = Math.min(...masses);
  const maxMass = Math.max(...masses);
  const span = Math.max(.0001, maxMass - minMass);
  const entries = new Map();
  profiles.forEach((profile, profileIndex) => {
    const direction = new THREE.Vector3();
    profile.tokenCounts.forEach((frequency, token) => {
      const idf = Math.log((profiles.length + 1) / ((documentFrequency.get(token) ?? 0) + 1)) + 1;
      const weight = (1 + Math.log(frequency)) * idf;
      direction.x += hashToken(token, 11) * weight;
      direction.y += hashToken(token, 29) * weight;
      direction.z += hashToken(token, 47) * weight;
    });
    if (direction.lengthSq() < .0001) direction.copy(getHexDirection(profile.hexagram));
    direction.normalize();
    const normalizedMass = (masses[profileIndex] - minMass) / span;
    const radius = 17 + normalizedMass * 43;
    entries.set(profile.hexagram.number, {
      hexagram: profile.hexagram,
      direction,
      radius,
      position: direction.clone().multiplyScalar(radius),
      annotationCount: profile.annotations.length,
      textLength: profile.textLength,
    });
  });
  const layout = { scholar, entries };
  state.scholarLayoutCache.set(scholar, layout);
  return layout;
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    child.geometry?.dispose();
    child.material?.dispose();
  }
}

function updateScholarLine(scholar) {
  state.activeScholar = scholar;
  const group = state.lineLayers.scholar;
  if (!group) return;
  clearGroup(group);
  const layout = buildScholarLayout(scholar);
  state.scholarLayout = layout;
  const interpreted = state.data.hexagrams.filter((hexagram) => layout.entries.has(hexagram.number));
  state.lineParticipants.scholar = new Set(interpreted.map((hexagram) => hexagram.number));
  if (interpreted.length > 1) {
    const points = interpreted.map((hexagram) => layout.entries.get(hexagram.number).position);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: .3, depthWrite: false })));
  }
  if (state.activeLineMode === 'scholar') {
    const annotationCount = [...layout.entries.values()].reduce((total, entry) => total + entry.annotationCount, 0);
    dom.lineDescription.textContent = `${scholar}星象：${interpreted.length}卦 · ${annotationCount}条注文`;
    applyFilters();
    refreshSelectedDetail();
    syncDeepLink();
  }
}

function setLineMode(mode) {
  state.activeLineMode = mode;
  if (mode !== 'scholar') state.scholarLayout = null;
  Object.entries(state.lineLayers).forEach(([name, layer]) => { layer.visible = name === mode; });
  dom.lineControls.querySelectorAll('.line-mode').forEach((button) => button.classList.toggle('active', button.dataset.lineMode === mode));
  dom.scholarSelect.hidden = mode !== 'scholar';
  if (mode === 'sequence') dom.lineDescription.textContent = '卦序線：乾至未濟依次相連';
  if (mode === 'scholar') updateScholarLine(state.activeScholar);
  if (mode === 'relations') dom.lineDescription.textContent = '錯綜線：錯卦與綜卦成對相連';
  if (mode === 'none') dom.lineDescription.textContent = '星線已隱藏';
  applyFilters();
  if (mode !== 'scholar') refreshSelectedDetail();
  if (mode !== 'scholar') syncDeepLink();
}

function createLineLayers() {
  const sequence = createPolyline(state.data.hexagrams, .38);
  const relationPairs = createRelationPairs();
  const relations = createLineSegments(relationPairs, .16);
  const scholar = new THREE.Group();
  state.lineLayers = { sequence, scholar, relations };
  const allNumbers = new Set(state.data.hexagrams.map((hexagram) => hexagram.number));
  state.lineParticipants.sequence = allNumbers;
  state.lineParticipants.none = allNumbers;
  state.lineParticipants.relations = new Set(relationPairs.flatMap((pair) => pair.map((hexagram) => hexagram.number)));
  universe.add(sequence, scholar, relations);

  const scholarOptions = state.data.scholars
    .map((item) => ({ ...item, hexagramCount: state.data.hexagrams.filter((hexagram) => getHexScholars(hexagram).has(item.name)).length }))
    .filter((item) => item.hexagramCount > 1);
  scholarOptions.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.name;
    option.textContent = `${item.name} · ${item.hexagramCount}卦`;
    dom.scholarSelect.append(option);
  });
  state.activeScholar = scholarOptions.find((item) => item.name === '虞翻')?.name ?? scholarOptions[0]?.name;
  dom.scholarSelect.value = state.activeScholar;
  updateScholarLine(state.activeScholar);
  setLineMode('sequence');
}

function createHexagramStars() {
  const sphere = new THREE.SphereGeometry(.48, 18, 14);
  const glowTexture = makeGlowTexture('#ffffff');

  state.data.hexagrams.forEach((hexagram) => {
    const position = getHexPosition(hexagram);
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.originalPosition = position.clone();

    const size = 1;
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .96 });
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.setScalar(size);
    mesh.userData = {
      hexagram,
      baseScale: size,
      group,
      hoverColor: STAR_COLOR,
    };

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, transparent: true, opacity: .68, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.setScalar(3.9);
    mesh.userData.glow = glow;

    group.add(glow, mesh);
    universe.add(group);
    state.meshes.push(mesh);
  });
  createLineLayers();
}

function setupHexagramLabels() {
  state.data.hexagrams.forEach((hexagram) => {
    const label = document.createElement('span');
    label.className = 'hex-star-label';
    label.dataset.number = hexagram.number;
    label.innerHTML = `<span class="glyph">${hexagram.symbol}</span><span class="label-name">${hexagram.name}</span>`;
    dom.labels.append(label);
  });
}

function updateHexagramLabels() {
  dom.labels.querySelectorAll('.hex-star-label').forEach((label) => {
    const mesh = state.meshes[Number(label.dataset.number) - 1];
    const anchor = mesh.userData.group.position.clone().applyMatrix4(universe.matrixWorld);
    const depth = anchor.z;
    anchor.project(camera);
    const focused = state.selected?.number === mesh.userData.hexagram.number;
    const visible = mesh.userData.group.visible && anchor.z > -1 && anchor.z < 1 && !focused;
    label.style.display = visible ? 'block' : 'none';
    label.style.left = `${(anchor.x * .5 + .5) * innerWidth}px`;
    label.style.top = `${(-anchor.y * .5 + .5) * innerHeight}px`;
    label.style.opacity = `${THREE.MathUtils.clamp(.42 + depth * .016, .12, .95)}`;
    label.classList.toggle('hovered', state.hoveredMesh === mesh);
  });
}

function buildIndex() {
  Object.entries(TRIGRAM_INFO).forEach(([name, info]) => {
    const button = document.createElement('button');
    button.className = 'trigram-filter';
    button.style.setProperty('--filter-color', info.color);
    button.textContent = name;
    button.addEventListener('click', () => {
      state.activeTrigram = state.activeTrigram === name ? null : name;
      applyFilters();
    });
    dom.filters.append(button);
  });

  state.data.hexagrams.forEach((hexagram) => {
    const button = document.createElement('button');
    button.className = 'hex-button';
    button.dataset.number = hexagram.number;
    button.style.setProperty('--hex-color', HEXAGRAM_COLOR);
    button.innerHTML = `<span class="number">${String(hexagram.number).padStart(2, '0')}</span><span class="symbol">${hexagram.symbol}</span><span class="name">${hexagram.name}</span>`;
    button.addEventListener('click', () => selectHexagram(hexagram));
    dom.grid.append(button);
  });
}

function searchableText(hexagram) {
  if (!hexagram._searchText) {
    hexagram._searchText = [
      hexagram.name, hexagram.statement, hexagram.statementTranslation, hexagram.upperTrigram, hexagram.lowerTrigram,
      ...hexagram.topScholars.map((s) => s.name),
      ...hexagram.sections.flatMap((s) => [s.title, s.canonicalText, s.translation, ...s.annotations.flatMap((c) => [c.work, c.scholar, c.text]), ...s.variants.flatMap((v) => [v.work, v.text])]),
      ...hexagram.hexagramOnlyRecords.flatMap((r) => [r.作品, r.作者, r.文本]),
    ].join('');
  }
  return hexagram._searchText;
}

function applyFilters() {
  const query = state.query.trim();
  let visible = 0;
  state.meshes.forEach((mesh) => {
    const hexagram = mesh.userData.hexagram;
    const matchTrigram = !state.activeTrigram || hexagram.upperTrigram === state.activeTrigram;
    const matchQuery = !query || searchableText(hexagram).includes(query);
    const participants = state.lineParticipants[state.activeLineMode] ?? state.lineParticipants.sequence;
    const matchConnection = participants.has(hexagram.number);
    const match = matchTrigram && matchQuery && matchConnection;
    mesh.userData.group.visible = match;
    const button = dom.grid.querySelector(`[data-number="${hexagram.number}"]`);
    button?.classList.toggle('filtered', !match);
    if (match) visible++;
  });
  dom.filters.querySelectorAll('button').forEach((button) => button.classList.toggle('active', button.textContent === state.activeTrigram));
  dom.filterStatus.textContent = `顯示 ${visible} / 64 卦`;
}

function getPrimaryLines(hexagram) {
  return hexagram.primaryLineSectionIds
    .map((id) => hexagram.sections.find((section) => section.id === id))
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function cleanDisplayText(value) {
  return String(value ?? '').replace(/\[\^[^\]]+\]/g, '').trim();
}

function renderAnnotations(section) {
  if (!section?.annotations?.length) return '';
  const items = section.annotations.map((item) => `
    <li>
      <div class="commentary-meta"><strong>${escapeHtml(item.work)}</strong><span>${escapeHtml(item.scholar)}</span></div>
      <p>${escapeHtml(item.text)}</p>
    </li>`).join('');
  return `<details class="commentary-list"><summary>注文 ${section.annotations.length} 条</summary><ol>${items}</ol></details>`;
}

function renderVariantText(variant) {
  const body = variant.diffSegments?.length
    ? variant.diffSegments.map((part) => part.changed ? `<mark>${escapeHtml(part.text)}</mark>` : escapeHtml(part.text)).join('')
    : escapeHtml(variant.text);
  return `<li><strong>${escapeHtml(variant.work)}</strong><p>${body}</p></li>`;
}

function renderVariants(section) {
  if (!section?.variants?.length) return '';
  return `<div class="variant-block"><span>异文</span><ul>${section.variants.map(renderVariantText).join('')}</ul></div>`;
}

function renderSmallImage(section) {
  if (!section) return '';
  return `<section class="small-image-block">
    <h4>${escapeHtml(section.title)}</h4>
    <div class="canonical-block"><span>原文</span><p>${escapeHtml(section.canonicalText)}</p></div>
    ${renderVariants(section)}
    <div class="translation-block"><span>译文</span><p>${escapeHtml(section.translation)}</p></div>
    ${renderAnnotations(section)}
  </section>`;
}

function renderTextSection(section, lineIndex = null, isLine = false) {
  const yaoMark = lineIndex === null ? '' : `<span class="yao-mark ${state.selected.lines[lineIndex] ? '' : 'yin'}"></span>`;
  const source = isLine
    ? `<header class="line-source">${yaoMark}<h3><span class="line-position">${escapeHtml(section.title)}</span><span class="line-canonical">${escapeHtml(section.canonicalText)}</span></h3></header>`
    : `<header>${yaoMark}<h3>${escapeHtml(section.title)}</h3></header><div class="canonical-block"><span>原文</span><p>${escapeHtml(section.canonicalText)}</p></div>`;
  return `<article class="line-card text-section-card">
    ${source}
    ${renderVariants(section)}
    <div class="translation-block"><span>译文</span><p>${escapeHtml(section.translation)}</p></div>
    ${renderAnnotations(section)}
    ${isLine ? renderSmallImage(section.smallImage) : ''}
  </article>`;
}

function renderUnresolved(hexagram) {
  const only = hexagram.hexagramOnlyRecords ?? [];
  const candidates = hexagram.reviewCandidates ?? [];
  if (!only.length && !candidates.length) return '';
  const rows = [
    ...candidates.map((item) => ({ work: item.work, line: item.sourceLine, text: item.text, status: '候选待复核' })),
    ...only.map((item) => ({ work: item.作品, line: item.原始行号, text: item.文本, status: '仅定位到本卦' })),
  ].map((item) => `<li><div class="commentary-meta"><strong>${escapeHtml(item.work)}</strong><span>${item.status} · 原始第${escapeHtml(item.line)}行</span></div><p>${escapeHtml(item.text)}</p></li>`).join('');
  return `<details class="commentary-list unresolved-list"><summary>本卦尚未定位到具体经传节点 ${only.length + candidates.length} 条</summary><ol>${rows}</ol></details>`;
}

function renderFocusHexagram(hexagram) {
  const primaryLines = getPrimaryLines(hexagram);
  const scholarMode = state.activeLineMode === 'scholar';
  dom.focusKicker.textContent = scholarMode
    ? `${state.activeScholar}星象 · 第 ${hexagram.number} 卦`
    : `第 ${hexagram.number} 卦 · ${hexagram.lowerTrigram}下 ${hexagram.upperTrigram}上`;
  dom.focusTitle.textContent = hexagram.name;
  dom.focusStarLabel.textContent = `${hexagram.symbol} ${hexagram.name}`;
  const hint = dom.focusStage.querySelector('.focus-hint');
  if (hint) hint.textContent = scholarMode ? `亮起的爻位收有${state.activeScholar}材料` : '點擊一爻 · 查看爻辭、小象與注文';
  dom.focusHexagram.style.setProperty('--focus-accent', HEXAGRAM_COLOR);
  dom.focusHexagram.innerHTML = [...primaryLines].reverse().map((section) => {
    const index = primaryLines.findIndex((line) => line.id === section.id);
    const isYang = Boolean(hexagram.lines[index]);
    const scholarMaterials = scholarMode ? scholarMaterialsForSection(section, state.activeScholar) : null;
    const covered = !scholarMode || scholarMaterials.annotations.length || scholarMaterials.variants.length;
    return `<button class="focus-yao ${isYang ? 'yang' : 'yin'} ${covered ? 'scholar-covered' : 'scholar-uncovered'}" type="button" data-section-id="${escapeHtml(section.id)}" aria-label="${escapeHtml(section.title)} ${escapeHtml(section.canonicalText)}" title="${covered ? `${escapeHtml(section.title)} ${escapeHtml(section.canonicalText)}` : `${escapeHtml(state.activeScholar)}未注此爻`}" ${covered ? '' : 'disabled'}>
      <span class="focus-yao-number">${escapeHtml(section.title)}</span>
      <span class="focus-yao-bar" aria-hidden="true"><i></i><i></i></span>
    </button>`;
  }).join('');
  dom.focusStage.classList.add('open');
  dom.focusStage.setAttribute('aria-hidden', 'false');
}

function updateFocusedStarTarget() {
  if (!state.focusedMesh) return;
  universe.updateMatrixWorld(true);
  const panelWidth = Math.min(470, innerWidth - 48);
  const panelLeft = innerWidth - panelWidth - 24;
  const focusOrb = dom.focusStar.querySelector('.focus-star-orb')?.getBoundingClientRect();
  const clientX = focusOrb?.width ? focusOrb.left + focusOrb.width * .5 : Math.max(180, panelLeft * .5);
  const clientY = focusOrb?.height ? focusOrb.top + focusOrb.height * .5 : innerHeight * .72;
  const projected = new THREE.Vector3((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1, .1).unproject(camera);
  const direction = projected.sub(camera.position).normalize();
  const distance = (8 - camera.position.z) / direction.z;
  const worldTarget = camera.position.clone().addScaledVector(direction, distance);
  state.focusedMesh.userData.focusTarget = universe.worldToLocal(worldTarget.clone());
}

function focusStarFor(hexagram) {
  state.focusedMesh = state.meshes.find((mesh) => mesh.userData.hexagram.number === hexagram.number) ?? null;
  updateFocusedStarTarget();
}

function renderFeaturedSection(title, section, extraClass = '') {
  if (!section) return '';
  return `<section class="featured-section ${extraClass}">
    <h3 class="section-heading">${escapeHtml(title)}</h3>
    <div class="featured-text">
      <div class="canonical-block"><span>原文</span><p>${escapeHtml(section.canonicalText)}</p></div>
      ${renderVariants(section)}
      <div class="translation-block"><span>今译</span><p>${escapeHtml(section.translation)}</p></div>
      ${renderAnnotations(section)}
    </div>
  </section>`;
}

function renderTuanDrawer(hexagram) {
  if (!hexagram.tuanSegments?.length) return '';
  const cards = hexagram.tuanSegments.map((section, index) => `<article class="transmission-segment">
    ${hexagram.tuanSegments.length > 1 ? `<span class="segment-index">${index + 1}</span>` : ''}
    <div class="canonical-block"><span>原文</span><p>${escapeHtml(section.canonicalText)}</p></div>
    ${renderVariants(section)}
    <div class="translation-block"><span>今译</span><p>${escapeHtml(section.translation)}</p></div>
    ${renderAnnotations(section)}
  </article>`).join('');
  return `<details class="material-drawer tuan-drawer"><summary><span>彖传</span><small>${hexagram.tuanSegments.length} 个文本片段</small></summary><div class="drawer-body">${cards}</div></details>`;
}

function renderOtherDrawer(hexagram) {
  const sections = hexagram.otherTexts ?? [];
  if (!sections.length) return '';
  const cards = sections.map((section, index) => `<article class="transmission-segment">
    ${sections.length > 1 ? `<span class="segment-index">${index + 1}</span>` : ''}
    <div class="canonical-block"><span>原文</span><p>${escapeHtml(section.canonicalText)}</p></div>
    ${renderVariants(section)}
    <div class="translation-block"><span>今译</span><p>${escapeHtml(section.translation)}</p></div>
    ${renderAnnotations(section)}
  </article>`).join('');
  return `<details class="material-drawer"><summary><span>其他传文</span><small>${sections.length} 条</small></summary><div class="drawer-body">${cards}</div></details>`;
}

function renderDetailHeading(hexagram, line = null) {
  const scholarEntry = state.activeLineMode === 'scholar' ? state.scholarLayout?.entries.get(hexagram.number) : null;
  const meta = state.activeLineMode === 'scholar'
    ? `${escapeHtml(state.activeScholar)} · ${scholarEntry?.annotationCount ?? 0}条注文`
    : `${escapeHtml(hexagram.lowerTrigram)}下 ${escapeHtml(hexagram.upperTrigram)}上 · ${hexagram.commentaryCount}条已挂接记录`;
  return `<div class="detail-heading ${line ? 'line-detail-heading' : ''}">
    <div class="detail-glyph">${escapeHtml(hexagram.symbol)}</div>
    <div><p class="detail-kicker">第 ${hexagram.number} 卦${line ? ' · 爻位詳情' : ''}</p><h2 class="detail-title">${escapeHtml(hexagram.name)}${line ? ` · ${escapeHtml(line.title)}` : ''}</h2><p class="detail-meta">${meta}</p></div>
  </div>`;
}

function renderHexagramDetail(hexagram) {
  state.selectedLineId = null;
  dom.focusHexagram.querySelectorAll('.focus-yao').forEach((button) => button.classList.remove('active'));
  const accent = HEXAGRAM_COLOR;
  const judgment = hexagram.judgment;
  const correction = hexagram.symbolCorrected ? `<p class="correction">資料校正：來源卦象 ${escapeHtml(hexagram.originalSymbol)} 已按第${hexagram.number}卦校正為 ${escapeHtml(hexagram.symbol)}</p>` : '';
  dom.detailContent.innerHTML = `<div class="detail-view hexagram-detail-view" data-detail-view="hexagram" style="--accent:${accent}">
    ${renderDetailHeading(hexagram)}
    ${renderFeaturedSection('卦辞', judgment, 'judgment-section')}
    ${renderFeaturedSection('大象', hexagram.greatImage, 'great-image-section')}
    ${renderTuanDrawer(hexagram)}
    ${renderOtherDrawer(hexagram)}
    ${renderUnresolved(hexagram)}
    ${correction}
  </div>`;
  dom.detailContent.scrollTop = 0;
  syncDeepLink();
}

function renderLineDetail(sectionId) {
  if (state.activeLineMode === 'scholar') {
    renderScholarLineDetail(sectionId);
    return;
  }
  const hexagram = state.selected;
  if (!hexagram) return;
  const line = getPrimaryLines(hexagram).find((section) => section.id === sectionId);
  if (!line) return;
  state.selectedLineId = line.id;
  dom.focusHexagram.querySelectorAll('.focus-yao').forEach((button) => button.classList.toggle('active', button.dataset.sectionId === line.id));
  const accent = HEXAGRAM_COLOR;
  const smallImage = line.smallImage;
  dom.detailContent.innerHTML = `<div class="detail-view line-detail-view" data-detail-view="line" style="--accent:${accent}">
    <button class="back-to-hexagram" type="button">← 返回卦辞与大象</button>
    ${renderDetailHeading(hexagram, line)}
    <section class="selected-line-section">
      <h3><span>${escapeHtml(line.title)}</span>${escapeHtml(line.canonicalText)}</h3>
      ${renderVariants(line)}
      <div class="translation-block"><span>今译</span><p>${escapeHtml(line.translation)}</p></div>
      ${renderAnnotations(line)}
    </section>
    ${smallImage ? renderFeaturedSection('小象', smallImage, 'selected-small-image') : ''}
  </div>`;
  dom.detailContent.querySelector('.back-to-hexagram')?.addEventListener('click', () => renderHexagramDetail(hexagram));
  dom.detailContent.scrollTop = 0;
  syncDeepLink();
}

function renderScholarNotes(annotations) {
  if (!annotations.length) return '';
  return `<section class="scholar-notes"><h4>注文</h4><ol>${annotations.map((item) => `<li><p>${escapeHtml(item.text)}</p></li>`).join('')}</ol></section>`;
}

function renderScholarVariants(variants) {
  if (!variants.length) return '';
  return `<section class="scholar-variants"><h4>异文</h4><ul>${variants.map(renderVariantText).join('')}</ul></section>`;
}

function renderScholarSection(section, scholar, title) {
  const materials = scholarMaterialsForSection(section, scholar);
  if (!materials.annotations.length && !materials.variants.length) return '';
  const isLine = section.type === 'line';
  return `<article class="scholar-section ${isLine ? 'scholar-line-section' : 'scholar-judgment-section'}">
    <p class="scholar-section-label">${escapeHtml(title)}</p>
    <h3>${isLine ? `<span>${escapeHtml(section.title)}</span>` : ''}${escapeHtml(cleanDisplayText(section.canonicalText))}</h3>
    ${renderScholarVariants(materials.variants)}
    ${renderScholarNotes(materials.annotations)}
  </article>`;
}

function renderScholarDetail(hexagram) {
  state.selectedLineId = null;
  dom.focusHexagram.querySelectorAll('.focus-yao').forEach((button) => button.classList.remove('active'));
  const scholar = state.activeScholar;
  const accent = HEXAGRAM_COLOR;
  const entry = state.scholarLayout?.entries.get(hexagram.number);
  const judgmentCard = renderScholarSection(hexagram.judgment, scholar, '卦辞');
  const lineCards = getPrimaryLines(hexagram).map((line) => renderScholarSection(line, scholar, '爻辞')).filter(Boolean).join('');
  dom.detailContent.innerHTML = `<div class="detail-view scholar-detail-view" data-detail-view="scholar" style="--accent:${accent}">
    ${renderDetailHeading(hexagram)}
    <div class="scholar-view-heading"><p>${escapeHtml(scholar)}星象</p><span>${entry?.annotationCount ?? 0} 条注文 · ${entry?.textLength ?? 0} 字参与星象定位</span></div>
    ${scholarHistoryLink(scholar)}
    ${judgmentCard}
    ${lineCards}
  </div>`;
  dom.detailContent.scrollTop = 0;
  syncDeepLink();
}

function renderScholarLineDetail(sectionId) {
  const hexagram = state.selected;
  if (!hexagram) return;
  const line = getPrimaryLines(hexagram).find((section) => section.id === sectionId);
  if (!line) return;
  const scholar = state.activeScholar;
  const card = renderScholarSection(line, scholar, '爻辞');
  if (!card) return;
  state.selectedLineId = line.id;
  dom.focusHexagram.querySelectorAll('.focus-yao').forEach((button) => button.classList.toggle('active', button.dataset.sectionId === line.id));
  const accent = HEXAGRAM_COLOR;
  dom.detailContent.innerHTML = `<div class="detail-view scholar-detail-view scholar-line-detail-view" data-detail-view="scholar-line" style="--accent:${accent}">
    <button class="back-to-hexagram" type="button">← 返回${escapeHtml(scholar)}本卦材料</button>
    ${renderDetailHeading(hexagram, line)}
    <div class="scholar-view-heading"><p>${escapeHtml(scholar)}星象</p></div>
    ${scholarHistoryLink(scholar)}
    ${card}
  </div>`;
  dom.detailContent.querySelector('.back-to-hexagram')?.addEventListener('click', () => renderScholarDetail(hexagram));
  dom.detailContent.scrollTop = 0;
  syncDeepLink();
}

function refreshSelectedDetail() {
  if (!state.selected) return;
  if (state.activeLineMode === 'scholar' && !state.scholarLayout?.entries.has(state.selected.number)) {
    closeDetailView();
    return;
  }
  renderFocusHexagram(state.selected);
  focusStarFor(state.selected);
  if (state.activeLineMode === 'scholar') renderScholarDetail(state.selected);
  else renderHexagramDetail(state.selected);
}

function selectHexagram(hexagram) {
  setHoveredMesh(null);
  state.selected = hexagram;
  state.selectedLineId = null;
  document.body.classList.add('reading-mode');
  dom.index.classList.add('collapsed');
  dom.detail.classList.add('open');
  dom.grid.querySelectorAll('.hex-button').forEach((button) => button.classList.toggle('active', Number(button.dataset.number) === hexagram.number));
  renderFocusHexagram(hexagram);
  focusStarFor(hexagram);
  if (state.activeLineMode === 'scholar') renderScholarDetail(hexagram);
  else renderHexagramDetail(hexagram);
}

function pickAt(clientX, clientY) {
  pointer.x = (clientX / innerWidth) * 2 - 1;
  pointer.y = -(clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObjects(state.meshes, false)[0]?.object ?? null;
}

function setHoveredMesh(mesh) {
  state.hoveredMesh = mesh;
  dom.canvas.classList.toggle('star-hover', Boolean(mesh));
  if (!mesh) dom.hover.hidden = true;
}

function closeDetailView() {
  setHoveredMesh(null);
  state.selected = null;
  state.selectedLineId = null;
  state.focusedMesh = null;
  dom.detail.classList.remove('open');
  dom.focusStage.classList.remove('open');
  dom.focusStage.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('reading-mode');
  dom.grid.querySelectorAll('.hex-button').forEach((button) => button.classList.remove('active'));
  syncDeepLink();
}

function applyDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const scholar = params.get('scholar')?.trim();
  const scholarOption = scholar && [...dom.scholarSelect.options].some((option) => option.value === scholar);
  if (scholarOption) {
    state.activeScholar = scholar;
    dom.scholarSelect.value = scholar;
    setLineMode('scholar');
  }

  const hexValue = params.get('hex')?.trim();
  const hexNumber = Number(hexValue);
  const hexagram = state.data.hexagrams.find((item) => (
    (Number.isInteger(hexNumber) && item.number === hexNumber)
    || item.name === hexValue
    || item.symbol === hexValue
  ));
  if (!hexagram) {
    state.urlSyncReady = true;
    syncDeepLink();
    return;
  }
  selectHexagram(hexagram);

  const linePosition = Number(params.get('line'));
  if (Number.isInteger(linePosition) && linePosition >= 1 && linePosition <= 6) {
    const line = getPrimaryLines(hexagram).find((item) => item.linePosition === linePosition)
      || getPrimaryLines(hexagram)[linePosition - 1];
    if (line) renderLineDetail(line.id);
  }
  state.urlSyncReady = true;
  syncDeepLink();
}

function setupInteraction() {
  dom.canvas.addEventListener('pointerdown', (event) => {
    setHoveredMesh(null);
    state.pointerDown = { x: event.clientX, y: event.clientY, rx: cosmos.rotation.x, ry: cosmos.rotation.y };
    state.dragging = false;
    dom.canvas.setPointerCapture(event.pointerId);
  });
  dom.canvas.addEventListener('pointermove', (event) => {
    if (state.pointerDown) {
      const dx = event.clientX - state.pointerDown.x;
      const dy = event.clientY - state.pointerDown.y;
      if (Math.hypot(dx, dy) > 3) state.dragging = true;
      if (!state.selected) {
        cosmos.rotation.y = state.pointerDown.ry + dx * .005;
        cosmos.rotation.x = THREE.MathUtils.clamp(state.pointerDown.rx + dy * .003, -.72, .72);
      }
      dom.canvas.classList.toggle('dragging', state.dragging);
      setHoveredMesh(null);
      return;
    }
    if (state.selected) {
      setHoveredMesh(null);
      return;
    }
    const hit = pickAt(event.clientX, event.clientY);
    if (hit) {
      setHoveredMesh(hit);
      const h = hit.userData.hexagram;
      const scholarEntry = state.activeLineMode === 'scholar' ? state.scholarLayout?.entries.get(h.number) : null;
      const detail = scholarEntry
        ? `${state.activeScholar} · ${scholarEntry.annotationCount}條注文 · ${scholarEntry.textLength}字`
        : `${h.lowerTrigram}下${h.upperTrigram}上 · ${h.textLength.toLocaleString()}字 · ${h.commentaryCount}條注文`;
      dom.hover.innerHTML = `<div class="hover-title"><span class="hover-symbol">${escapeHtml(h.symbol)}</span><strong>${escapeHtml(h.name)}</strong></div><small>${escapeHtml(detail)}</small><em>点击进入详览</em>`;
      dom.hover.style.left = `${event.clientX + 14}px`;
      dom.hover.style.top = `${event.clientY + 14}px`;
      dom.hover.hidden = false;
    } else {
      setHoveredMesh(null);
    }
  });
  dom.canvas.addEventListener('pointerup', (event) => {
    if (!state.dragging) {
      const hit = pickAt(event.clientX, event.clientY);
      if (hit) selectHexagram(hit.userData.hexagram);
    }
    state.pointerDown = null;
    state.dragging = false;
    dom.canvas.classList.remove('dragging');
  });
  dom.canvas.addEventListener('pointerleave', () => { setHoveredMesh(null); });
  dom.canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    camera.position.z = THREE.MathUtils.clamp(camera.position.z + event.deltaY * .055, 48, 160);
    updateFocusedStarTarget();
  }, { passive: false });

  dom.search.addEventListener('input', () => { state.query = dom.search.value; applyFilters(); });
  dom.lineControls.querySelectorAll('.line-mode').forEach((button) => {
    button.addEventListener('click', () => setLineMode(button.dataset.lineMode));
  });
  dom.scholarSelect.addEventListener('change', () => updateScholarLine(dom.scholarSelect.value));
  dom.focusHexagram.addEventListener('click', (event) => {
    const button = event.target.closest('.focus-yao');
    if (button) renderLineDetail(button.dataset.sectionId);
  });
  dom.focusStar.addEventListener('click', () => {
    if (!state.selected) return;
    if (state.activeLineMode === 'scholar') renderScholarDetail(state.selected);
    else renderHexagramDetail(state.selected);
  });
  dom.closeDetail.addEventListener('click', closeDetailView);
  dom.toggleIndex.addEventListener('click', () => dom.index.classList.toggle('collapsed'));
  dom.reset.addEventListener('click', () => {
    closeDetailView();
    cosmos.rotation.copy(DEFAULT_ROTATION);
    camera.position.set(0, 4, 124);
    camera.lookAt(0, 0, 0);
    state.activeTrigram = null;
    state.query = '';
    dom.search.value = '';
    applyFilters();
  });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight, false);
    updateFocusedStarTarget();
  });
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  starLayer.rotation.y = t * .003;
  updateShootingStars(t);
  state.meshes.forEach((mesh, index) => {
    const group = mesh.userData.group;
    const scholarPosition = state.activeLineMode === 'scholar'
      ? state.scholarLayout?.entries.get(mesh.userData.hexagram.number)?.position
      : null;
    const desiredPosition = mesh === state.focusedMesh && mesh.userData.focusTarget
      ? mesh.userData.focusTarget
      : scholarPosition ?? group.userData.originalPosition;
    group.position.lerp(desiredPosition, mesh === state.focusedMesh ? .12 : .08);
    const selected = mesh.userData.hexagram === state.selected;
    const hovered = mesh === state.hoveredMesh && !state.selected;
    const pulse = 1 + Math.sin(t * 1.15 + index * .7) * .045;
    const targetScale = selected ? 2.6 : hovered ? mesh.userData.baseScale * 1.72 : mesh.userData.baseScale * pulse;
    mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, targetScale, selected || hovered ? .16 : .1));
    mesh.material.color.lerp(hovered ? mesh.userData.hoverColor : STAR_COLOR, .16);
    const glow = mesh.userData.glow;
    const glowScale = selected ? 5.2 : hovered ? 5.8 : 3.9;
    const glowOpacity = selected ? .9 : hovered ? .98 : .68;
    glow.scale.setScalar(THREE.MathUtils.lerp(glow.scale.x, glowScale, .16));
    glow.material.opacity = THREE.MathUtils.lerp(glow.material.opacity, glowOpacity, .16);
  });
  universe.updateMatrixWorld();
  updateHexagramLabels();
  renderer.render(scene, camera);
}

async function init() {
  try {
    const [response, semanticResponse] = await Promise.all([
      fetch(`./data/zhouyi-integrated-v2.json?v=${DATA_VERSION}`),
      fetch(`./data/semantic-layout.json?v=${DATA_VERSION}`),
    ]);
    if (!response.ok || !semanticResponse.ok) throw new Error(`HTTP ${response.status}/${semanticResponse.status}`);
    state.data = await response.json();
    const semanticLayout = await semanticResponse.json();
    state.semanticByNumber = new Map(semanticLayout.positions.map((item) => [item.number, item]));
    prepareTextLengthScale();
    createBackground();
    createHexagramStars();
    setupHexagramLabels();
    buildIndex();
    setupInteraction();
    applyFilters();
    applyDeepLink();
    const stats = state.data.metadata.stats;
    const sectionCount = state.data.metadata.v2Stats?.sections ?? stats.canonicalNodes;
    dom.dataStatus.textContent = `${stats.hexagrams} 卦 · ${sectionCount} 个细分文本节点 · ${stats.commentaries.toLocaleString()} 条已挂接注文`;
    animate();
  } catch (error) {
    console.error(error);
    dom.dataStatus.textContent = '資料載入失敗，請使用本地伺服器開啟。';
  }
}

init();
