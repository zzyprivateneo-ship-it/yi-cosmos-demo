import { lifeHistoryUrl, starMapUrl } from '../data/scholar-life-map.js';

/* 问卦 · 周易 —— 一卦，历代之眼
 * 三钱成卦 → 依古法定所读之爻 → 结合所问作情境化说明 → 历代注家原文
 * 今文、今译与注文全部读取主星图 zhouyi-integrated-v2.json。
 */

const dom = {
  app: document.querySelector('#gua-app'),
  sky: document.querySelector('#ritual-sky'),
  stage: document.querySelector('.stage'),
  phases: [...document.querySelectorAll('[data-phase]')],
  status: document.querySelector('#status'),
  stages: {
    ask: document.querySelector('[data-stage="ask"]'),
    cast: document.querySelector('[data-stage="cast"]'),
    reveal: document.querySelector('[data-stage="reveal"]'),
  },
  question: document.querySelector('#question'),
  begin: document.querySelector('#begin'),
  askHexagram: document.querySelector('#ask-hexagram'),
  cycleNumber: document.querySelector('#cycle-number'),
  cycleName: document.querySelector('#cycle-name'),
  castProgress: document.querySelector('#cast-progress'),
  coins: document.querySelector('#coins'),
  coinRead: document.querySelector('#coin-read'),
  castHexagram: document.querySelector('#cast-hexagram'),
  toss: document.querySelector('#toss'),
  tossAll: document.querySelector('#toss-all'),
  revealHexagram: document.querySelector('#reveal-hexagram'),
  hexSymbol: document.querySelector('#hex-symbol'),
  hexName: document.querySelector('#hex-name'),
  hexTrigrams: document.querySelector('#hex-trigrams'),
  hexChange: document.querySelector('#hex-change'),
  oracleBadge: document.querySelector('#oracle-badge'),
  oracleText: document.querySelector('#oracle-text'),
  readingRule: document.querySelector('#reading-rule'),
  revealSource: document.querySelector('#reveal-source'),
  revealVernacular: document.querySelector('#reveal-vernacular'),
  revealSecondary: document.querySelector('#reveal-secondary'),
  questionEcho: document.querySelector('#question-echo'),
  masters: document.querySelector('#masters'),
  mastersToggle: document.querySelector('#masters-toggle'),
  mastersBody: document.querySelector('#masters-body'),
  masterTabs: document.querySelector('#master-tabs'),
  masterCard: document.querySelector('#master-card'),
  again: document.querySelector('#again'),
  linkStarmap: document.querySelector('#link-starmap'),
  linkHistory: document.querySelector('#link-history'),
};

/* ── 极简星尘背景 ─────────────────────── */
function initRitualSky() {
  const canvas = dom.sky;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let meteors = [];
  let lastTime = 0;
  let nextMeteorAt = 1800 + Math.random() * 2200;

  function makeStars() {
    const count = Math.max(70, Math.min(190, Math.round((width * height) / 7200)));
    stars = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: i % 19 === 0 ? .95 + Math.random() * .55 : .28 + Math.random() * .58,
      a: .16 + Math.random() * .55,
      phase: Math.random() * Math.PI * 2,
      speed: .00018 + Math.random() * .00038,
      vx: -.0012 - Math.random() * .0022,
      vy: .00035 + Math.random() * .0011,
    }));
  }

  function spawnMeteor(time) {
    const speed = .22 + Math.random() * .13;
    meteors.push({
      x: width * (.12 + Math.random() * .64),
      y: height * (.03 + Math.random() * .28),
      vx: speed,
      vy: speed * (.46 + Math.random() * .18),
      born: time,
      life: 900 + Math.random() * 550,
      length: 75 + Math.random() * 95,
    });
    nextMeteorAt = time + 6500 + Math.random() * 7000;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    makeStars();
    if (reduceMotion) draw(0);
  }

  function draw(time) {
    const dt = lastTime ? Math.min(time - lastTime, 40) : 16;
    lastTime = time;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    stars.forEach((star) => {
      if (!reduceMotion) {
        star.x += star.vx * dt;
        star.y += star.vy * dt;
        if (star.x < -2) star.x = width + 2;
        if (star.y > height + 2) star.y = -2;
      }
      const shimmer = reduceMotion ? 1 : .72 + Math.sin(time * star.speed + star.phase) * .28;
      ctx.beginPath();
      ctx.fillStyle = `rgba(244, 246, 243, ${star.a * shimmer})`;
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (!reduceMotion && time >= nextMeteorAt) spawnMeteor(time);
    meteors = meteors.filter((meteor) => {
      const age = time - meteor.born;
      if (age > meteor.life) return false;
      meteor.x += meteor.vx * dt;
      meteor.y += meteor.vy * dt;
      const alpha = Math.sin(Math.PI * age / meteor.life) * .58;
      const mag = Math.hypot(meteor.vx, meteor.vy);
      const tailX = meteor.x - (meteor.vx / mag) * meteor.length;
      const tailY = meteor.y - (meteor.vy / mag) * meteor.length;
      const gradient = ctx.createLinearGradient(tailX, tailY, meteor.x, meteor.y);
      gradient.addColorStop(0, 'rgba(245,247,244,0)');
      gradient.addColorStop(1, `rgba(245,247,244,${alpha})`);
      ctx.beginPath();
      ctx.strokeStyle = gradient;
      ctx.lineWidth = .7;
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(meteor.x, meteor.y);
      ctx.stroke();
      return true;
    });
    if (!reduceMotion) window.requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  resize();
  if (!reduceMotion) window.requestAnimationFrame(draw);
}

// 解读席位只从星图 v2 的二十一家注文中取材。简明判读是面向所问事项的编辑性说明，
// 原注始终单列并标明作品与注家，避免把现代转述误作古人原话。
const PERSONAS = [
  {
    id: 'han', klass: 'han', label: '汉儒 · 象数', era: '两汉 — 三国', avatar: '象',
    stance: '先看时位、条件和卦象是否相合。',
    scholars: ['虞翻', '荀爽', '郑康成', '九家', '马融', '京房', '孟喜', '宋衷', '蜀才', '姚信'],
  },
  {
    id: 'wei', klass: 'wei', label: '魏晋 · 人事义理', era: '汉末 — 魏晋', avatar: '理',
    stance: '把卦意落在人怎么做、边界怎么守。',
    scholars: ['王肃', '刘表', '刘瓛', '王廙', '向秀', '董遇'],
  },
  {
    id: 'shi', klass: 'shi', label: '干宝 · 史事', era: '东 晋', avatar: '史',
    stance: '把这一爻放进局势的起伏与转折里看。',
    scholars: ['干宝'],
  },
];
// 白话席位单独处理。

// 六十四卦主题词（初稿，供卦变走向叙述用；待行家审校）
const THEMES = {
  1: '刚健进取', 2: '柔顺承载', 3: '屯难初生', 4: '蒙昧待启', 5: '等待', 6: '争讼', 7: '兴众用师', 8: '亲附',
  9: '小有蓄止', 10: '履践循礼', 11: '通泰', 12: '闭塞', 13: '和同于人', 14: '盛大富有', 15: '谦逊', 16: '和乐豫备',
  17: '随顺', 18: '整治积弊', 19: '临督', 20: '观省', 21: '明断去梗', 22: '文饰', 23: '剥落', 24: '回复',
  25: '无妄守真', 26: '大有蓄养', 27: '颐养', 28: '大为过甚', 29: '重险', 30: '附丽光明', 31: '交感', 32: '恒久',
  33: '退避', 34: '刚健壮盛', 35: '晋升', 36: '明伤韬晦', 37: '齐家', 38: '乖睽', 39: '险阻', 40: '舒解',
  41: '减损', 42: '增益', 43: '决断', 44: '不期而遇', 45: '荟聚', 46: '上升', 47: '困顿', 48: '养民如井',
  49: '变革', 50: '鼎新', 51: '震动', 52: '止静', 53: '渐进', 54: '归妹', 55: '丰盛', 56: '行旅',
  57: '巽顺而入', 58: '和悦', 59: '涣散', 60: '节制', 61: '中孚诚信', 62: '小有过越', 63: '事已成', 64: '事将成',
};

// 爻位大义（初稿）
const POSITION_SHORT = {
  1: '事情刚起步，先准备，不必急着证明结果',
  2: '条件开始成形，适合找准位置、稳步推进',
  3: '正处在容易反复的阶段，行动前要多核对一步',
  4: '已经接近转折点，进退都要留有余地',
  5: '资源和主动权较充足，可以承担关键责任',
  6: '事情已走到高处，要防止用力过头，懂得收束',
};

// 断语用词 → 分值（复合词在前，命中后即从文本剔除，避免重复计数）。初稿，待审校。
const VERDICT_RULES = [
  { pats: ['无不利', '無不利'], tag: '无不利', s: 2 },
  { pats: ['元吉'], tag: '元吉', s: 3 },
  { pats: ['大吉'], tag: '大吉', s: 3 },
  { pats: ['終吉', '终吉'], tag: '终吉', s: 1.6 },
  { pats: ['貞吉', '贞吉'], tag: '贞吉', s: 1.6 },
  { pats: ['悔亡'], tag: '悔亡·悔咎消解', s: 1 },
  { pats: ['無悔', '无悔'], tag: '无悔', s: 1 },
  { pats: ['無咎', '无咎'], tag: '无咎', s: 0.6 },
  { pats: ['元亨'], tag: '元亨·大通', s: 1.2 },
  { pats: ['貞凶', '贞凶'], tag: '贞凶', s: -2.2 },
  { pats: ['吉'], tag: '吉', s: 1.6 },
  { pats: ['凶'], tag: '凶', s: -2.6 },
  { pats: ['無攸利', '无攸利'], tag: '无攸利', s: -1.6 },
  { pats: ['不利'], tag: '不利', s: -1.6 },
  { pats: ['勿用'], tag: '勿用', s: -1, hold: true },
  { pats: ['厲', '厉'], tag: '厉·有危', s: -1 },
  { pats: ['吝'], tag: '吝·憾', s: -0.8 },
  { pats: ['悔'], tag: '悔', s: -0.8 },
  { pats: ['利'], tag: '利', s: 0.8 },
  { pats: ['亨'], tag: '亨·通', s: 0.8 },
  { pats: ['孚'], tag: '孚·诚信', s: 0.4 },
];

// 细分问题场景。时间、时区/已授权位置与情绪只参与措辞选择，不在结果中列为分析标签。
const QUESTION_CONTEXTS = [
  {
    id: 'relationship_reconcile', re: /复合|挽回|重新开始|还能回去|前任/, subject: '这段关系', factors: '对方是否愿意回应、旧问题是否真的改变以及新的相处边界',
    go: '可以重新接触，但先从一次坦诚、没有逼迫感的沟通开始', steady: '可以保留联系，不过先看行动，不要只听承诺', hold: '先不要追着要答案，给彼此一点空间', wait: '现在还看不清是否适合重来，再观察一段时间', stop: '此刻强行挽回只会重复原来的消耗，先把自己拉回稳定状态', clear: '先判断你想念的是这个人，还是那段关系带来的熟悉感',
  },
  {
    id: 'relationship_commitment', re: /结婚|订婚|表白|确定关系|在一起|婚姻/, subject: '这段关系', factors: '双方的真实意愿、生活安排、责任分配和长期边界',
    go: '可以把关系往前推进，态度要坦白而具体', steady: '可以继续靠近，但先别用一个承诺代替长期磨合', hold: '先不要催着确定结果，关系里还有需要说清的地方', wait: '时机还不够成熟，先让相处本身给出答案', stop: '现在作出长期绑定的风险偏高，先保留选择', clear: '先确认双方想要的是不是同一种生活，而不只是同一个名分',
  },
  {
    id: 'relationship', re: /感情|恋爱|分手|对象|伴侣|关系|相处|和他|和她|他会|她会|喜欢|爱/, subject: '这段关系', factors: '双方真实意愿、沟通方式和边界',
    go: '可以主动一点，把真实想法说清楚', steady: '可以继续相处，但别急着替对方下结论', hold: '先收一收力，不要靠反复确认换安全感', wait: '再给这段关系一点时间，观察对方是否有稳定行动', stop: '继续勉强只会增加消耗，先把自己的边界守住', clear: '先看这段关系是否让双方都更坦然，而不是只问最后能不能在一起',
  },
  {
    id: 'career_change', re: /离职|辞职|跳槽|换工作|转行|裸辞/, subject: '这次职业变动', factors: '下一步去向、收入缓冲、试用期风险和退出条件',
    go: '可以动，但先把下一站落稳再离开', steady: '可以继续谈新机会，不过还不到完全押注的时候', hold: '先别急着交辞呈，眼前还有信息没有核实', wait: '再等一个更清楚的窗口，同时把简历、作品和现金缓冲准备好', stop: '现在不适合做没有退路的跳转，先保住基本盘', clear: '先分清你是在逃离眼前的不适，还是确实看见了更合适的方向',
  },
  {
    id: 'career_opportunity', re: /机会|项目|合作|创业|入职|offer|录用|面试|升职/, subject: '这个机会', factors: '职责、回报、合作边界、决策权和时间安排',
    go: '这个机会值得接住，可以往前走', steady: '可以试，但先从可控的一小步开始', hold: '先不要急着答应，模糊的条件比机会本身更值得警惕', wait: '再等一轮信息，尤其看对方能不能给出明确承诺', stop: '现在投入过多并不划算，先保留现有退路', clear: '先别只问能不能成，先看它是否真的符合你的长期方向',
  },
  {
    id: 'career', re: /工作|求职|职业|公司|领导|同事|职场/, subject: '眼前的工作', factors: '职责、资源、协作关系和可控的时间节点',
    go: '可以主动推进，不必一直等别人表态', steady: '方向可以继续，但每一步都要留下反馈', hold: '暂时别硬碰，先把位置和资源稳住', wait: '先补齐信息和能力，再等更合适的落点', stop: '继续硬撑的收益不高，先停止无效投入', clear: '先确认什么是你真正要解决的问题，再决定去留',
  },
  {
    id: 'study_exam', re: /考试|考研|成绩|录取|申请|复试/, subject: '这次考试或申请', factors: '薄弱项、复习节奏、材料节点和真实反馈',
    go: '有继续冲刺的空间，接下来要把力气放到最能提分的部分', steady: '机会还在，但不能靠临场运气', hold: '先别盲目加量，当前方法需要调整', wait: '结果未定，先把能补的材料和薄弱项补齐', stop: '按现在的方式硬冲风险较高，先改计划再投入', clear: '不要反复猜结果，把注意力收回到下一次练习和反馈上',
  },
  {
    id: 'study_thesis', re: /论文|答辩|开题|毕业|导师|博士|硕士/, subject: '论文或学业安排', factors: '核心问题、材料证据、导师反馈和截止时间',
    go: '可以继续推进，先把最核心的一章做扎实', steady: '方向基本可行，但需要用一轮具体成果换取反馈', hold: '先别继续铺开，论点和材料之间还有缝隙', wait: '先整理已有材料，等关键反馈回来再改方向', stop: '继续沿用当前结构会越写越散，最好停下来重排问题', clear: '先用一句话说清你究竟要证明什么，后面的取舍会容易很多',
  },
  {
    id: 'finance', re: /投资|股票|基金|钱|财务|收入|生意|买房|卖房|贷款|借钱|回报/, subject: '这项财务决定', factors: '现金流、最坏损失、退出条件和独立数据',
    go: '可以考虑参与，但只能用承受得起损失的额度', steady: '可以小额验证，不要一次性压满', hold: '先不要追加投入，账面之外还有风险没有算清', wait: '再等更多数据，宁可错过也不要在信息不足时下注', stop: '现在不适合投入，先保住现金流和退出能力', clear: '先算最坏会损失多少，再谈可能赚多少', riskNote: '涉及大额资金时，请独立核对数据并咨询合格专业人士。',
  },
  {
    id: 'health', re: /健康|身体|疾病|病情|治疗|手术|吃药|康复|症状|医院|医生/, subject: '这项健康安排', factors: '症状变化、专业诊断、治疗依从性和复查节点',
    go: '可以积极处理，但每一步都应建立在明确诊断上', steady: '按计划治疗和观察，不要因为短期变化自行加减方案', hold: '先暂停自行判断，尽快把异常情况告诉医生', wait: '在结果出来前先稳定作息并记录症状，不要反复猜测', stop: '不要用占断替代就医，也不要自行停止已经确定的治疗', clear: '把症状、持续时间和检查结果整理清楚，交给专业人员判断', riskNote: '卦意不能代替诊断和治疗，请以医生意见为准。',
  },
  {
    id: 'travel', re: /出行|旅行|搬家|迁居|留学|移民|远行|出国|签证/, subject: '这次出行或迁移', factors: '证件、时间、预算、同行者和备用方案',
    go: '可以动身，但准备要走在行动前面', steady: '可以继续办理，先锁定最关键的手续和时间点', hold: '先别仓促出发，行程里还有容易出错的环节', wait: '再等条件完整一些，同时准备替代路线', stop: '现在强行成行的代价偏高，先改期或换方案', clear: '先把必须满足的条件列出来，再看这趟路是否值得走',
  },
  {
    id: 'family', re: /家庭|父母|孩子|子女|家人|亲人|家里/, subject: '这件家庭事务', factors: '各方真正需要、沟通顺序和责任边界',
    go: '可以主动把话题提出来，但先从共同目标说起', steady: '可以处理，不过不要指望一次谈话解决全部问题', hold: '先停下指责，让情绪降下来再谈', wait: '现在不是逼出结论的时候，先观察谁愿意承担什么', stop: '继续硬推会让关系更僵，先守住基本边界', clear: '先分清哪些是你的责任，哪些需要由家人自己承担',
  },
  {
    id: 'legal', re: /法律|诉讼|官司|合同|仲裁|赔偿|纠纷/, subject: '这项法律事务', factors: '证据、时限、合同条款和专业意见',
    go: '可以采取行动，但必须让证据和程序走在情绪前面', steady: '可以继续交涉，同时把每次沟通都留痕', hold: '先不要口头承诺或签署新文件', wait: '在专业意见明确前，不要做不可撤回的表态', stop: '现在贸然行动可能损害权利，先保全证据', clear: '先把事实、证据和诉求分开整理，再决定策略', riskNote: '涉及法律权利时，请同时咨询合格法律专业人士。',
  },
];

function dayPhaseFromHour(hour) {
  if (hour < 5) return 'late-night';
  if (hour < 9) return 'morning';
  if (hour < 12) return 'forenoon';
  if (hour < 14) return 'noon';
  if (hour < 18) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'late-night';
}

function makeMomentContext() {
  const now = new Date();
  const resolved = Intl.DateTimeFormat().resolvedOptions();
  return {
    askedAt: now,
    timezone: resolved.timeZone || 'local',
    locale: resolved.locale || navigator.language || 'zh-CN',
    dayPhase: dayPhaseFromHour(now.getHours()),
    month: now.getMonth() + 1,
    weekend: now.getDay() === 0 || now.getDay() === 6,
    locationSource: 'timezone',
  };
}

function enrichPermittedLocation(moment) {
  if (!navigator.permissions || !navigator.geolocation) return;
  navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
    if (permission.state !== 'granted') return;
    navigator.geolocation.getCurrentPosition((position) => {
      moment.latitude = position.coords.latitude;
      moment.longitude = position.coords.longitude;
      moment.locationSource = 'granted-geolocation';
      const utcHour = moment.askedAt.getUTCHours() + moment.askedAt.getUTCMinutes() / 60;
      const solarHour = (utcHour + moment.longitude / 15 + 24) % 24;
      moment.dayPhase = dayPhaseFromHour(solarHour);
    }, () => {}, { maximumAge: 900000, timeout: 1200 });
  }).catch(() => {});
}

function inferMood(value) {
  if (/难过|失望|受伤|背叛|不理我|离开我|分手/.test(value)) return 'hurt';
  if (/纠结|犹豫|该不该|要不要|选哪个|还是/.test(value)) return 'conflicted';
  if (/焦虑|害怕|担心|怎么办|会不会|能不能|是否|\?\?|？？/.test(value)) return 'anxious';
  if (/马上|赶紧|尽快|急|什么时候|多久|来得及/.test(value)) return 'eager';
  if (/希望|期待|想要|有机会|可以吗/.test(value)) return 'hopeful';
  return 'calm';
}

function analyzeQuestion(question) {
  const value = String(question || '').trim();
  const matched = QUESTION_CONTEXTS.find((item) => item.re.test(value)) || {
    id: 'general', subject: '这件事', factors: '现实条件、下一步反馈和你能承受的边界',
    go: '可以往前走，先做一个能验证方向的小动作', steady: '可以继续，但不要一下投入全部', hold: '先稳住，不必急着证明结果', wait: '条件还没齐，再多看一步', stop: '现在先不要做不可逆的决定', clear: '先把真正要解决的问题说清楚，再决定进退',
  };
  const compact = value.replace(/\s+/g, ' ').replace(/[？?]+$/, '');
  return {
    ...matched,
    question: value,
    short: compact.length > 24 ? `${compact.slice(0, 24)}…` : compact,
    mood: inferMood(value),
    moment: state.queryContext || makeMomentContext(),
  };
}

function contextualAdvice(verdict, context) {
  const lead = {
    宜进: context.go,
    宜稳: context.steady,
    宜守: context.hold,
    宜待: context.wait,
    勿动: context.stop,
    守正: context.clear,
  }[verdict.advice] || context.clear;
  return `${lead}。把${context.factors}逐项确认清楚。${context.riskNote ? ` ${context.riskNote}` : ''}`;
}

function parseVerdict(text) {
  let work = String(text || '');
  const tags = []; let score = 0; let hold = false;
  for (const r of VERDICT_RULES) {
    const pat = r.pats.find((p) => work.includes(p));
    if (!pat) continue;
    tags.push(r.tag); score += r.s; if (r.hold) hold = true;
    r.pats.forEach((p) => { work = work.split(p).join(''); }); // 剔除，防止后续泛词重复命中
  }
  let level, advice, tone;
  if (hold) { level = '时机未至'; advice = '宜待'; tone = 'caution'; }
  else if (score >= 2.5) { level = '大吉'; advice = '宜进'; tone = 'good'; }
  else if (score >= 1.2) { level = '吉'; advice = '宜进'; tone = 'good'; }
  else if (score >= 0.3) { level = '小吉·平顺'; advice = '宜稳'; tone = 'neutral'; }
  else if (score > -0.3) { level = tags.length ? '平' : '未明言吉凶'; advice = tags.length ? '宜稳' : '守正'; tone = 'neutral'; }
  else if (score > -1.2) { level = '宜慎'; advice = '宜守'; tone = 'caution'; }
  else if (score > -2.5) { level = '示警'; advice = '宜守'; tone = 'caution'; }
  else { level = '凶'; advice = '勿动'; tone = 'bad'; }
  return { tags, score, level, advice, tone };
}

const THEME_PACING = {
  opening: new Set([1, 3, 13, 14, 16, 19, 24, 35, 42, 45, 46, 55]),
  patience: new Set([5, 9, 12, 15, 26, 27, 32, 52, 53, 60]),
  correction: new Set([6, 18, 21, 23, 38, 39, 41, 47, 59, 62]),
  transition: new Set([4, 17, 28, 31, 33, 36, 40, 43, 44, 49, 50, 51, 54, 56, 57, 58, 61, 63, 64]),
};

function themePacing(r) {
  const number = r.zhi?.number || r.ben.number;
  if (THEME_PACING.opening.has(number)) return '后面的空间会逐渐打开，先用一个具体行动确认方向。';
  if (THEME_PACING.patience.has(number)) return '这件事更看重耐心和边界，速度反而不是重点。';
  if (THEME_PACING.correction.has(number)) return '眼前最重要的不是加速，而是先修正已经暴露的问题。';
  if (THEME_PACING.transition.has(number)) return '局面还会变化，给下一步留出调整和回头的余地。';
  return '先把能控制的部分做好，再根据真实反馈调整。';
}

function moodPacing(context, verdict) {
  if (context.mood === 'hurt') return '先照顾好自己的边界，再决定还要不要继续投入。';
  if (context.mood === 'conflicted') return '把两个选项最坏的结果分别写下来，答案会比反复猜测更清楚。';
  if (context.mood === 'anxious') return '先核实最让你不安的那一点，不要让想象替代事实。';
  if (context.mood === 'eager' && ['宜守', '宜待', '勿动'].includes(verdict.advice)) return '越想尽快定下来，越要给自己留一次复核的机会。';
  if (context.mood === 'hopeful' && ['宜进', '宜稳'].includes(verdict.advice)) return '期待可以保留，但要让对方或现实条件拿出对应的行动。';
  return '';
}

function momentPacing(context, verdict) {
  const irreversible = ['宜守', '宜待', '勿动'].includes(verdict.advice);
  if (context.moment.dayPhase === 'late-night' && irreversible) return '不可逆的决定先隔一晚，等思路稳定后再确认。';
  if (context.moment.dayPhase === 'late-night' && ['宜进', '宜稳'].includes(verdict.advice)) return '先把要确认的条件记下来，最后决定留到精神更清楚的时候。';
  if (context.moment.weekend && verdict.advice === '宜待') return '先记下要核实的事项，等相关的人和信息都到位后再判断。';
  return '';
}

function uniqueSentences(parts) {
  const seen = new Set();
  return parts.filter(Boolean).filter((part) => {
    const key = part.replace(/[，。；、“”]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).join('');
}

// 占断：经文断语决定倾向；问题场景、提问时刻/地点与语气只负责把建议说得自然，不改变卦与取爻。
function composeOracle(r) {
  const { ben, zhi, section } = r;
  const v = parseVerdict(section.canonicalText || ben.statement || '');
  const context = analyzeQuestion(dom.question.value);
  const parts = [contextualAdvice(v, context), themePacing(r)];
  if (section.type === 'line' && section.linePosition >= 1 && section.linePosition <= 6) {
    parts.push(`${POSITION_SHORT[section.linePosition]}。`);
  }
  parts.push(moodPacing(context, v), momentPacing(context, v));
  return {
    badge: v.advice,
    level: v.level,
    tone: v.tone,
    verdict: v,
    context,
    text: uniqueSentences(parts),
  };
}

const YIN_YANG = { yin: '阴', yang: '阳' };
const state = {
  data: null,
  hexByPattern: new Map(),
  hexByNumber: new Map(),
  lines: [],        // 本卦六爻，自下而上：{ yang, changing, sum, coins:[2|3,...] }
  reading: null,
  activePersona: null,
  cycleIndex: 0,
  cycleDirection: 1,
  cyclePattern: null,
  cycleTimer: null,
  queryContext: null,
};

/* ── 加载 ─────────────────────────────── */
async function load() {
  try {
    const response = await fetch('../data/zhouyi-integrated-v2.json?v=20260713-v2');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
  } catch (err) {
    dom.status.textContent = '资料载入失败，请通过本地服务器打开本页。';
    console.error(err);
    return;
  }

  state.data.hexagrams.forEach((h) => {
    const byId = new Map(h.sections.map((s) => [s.id, s]));
    h._judgment = h.judgment || h.sections.find((s) => s.type === 'judgment');
    h._lineSections = (h.primaryLineSectionIds || []).map((id) => byId.get(id)); // 自下而上 6 爻
    h._yong = h.sections.find((s) => s.linePosition === 0 || /^用[九六]/.test((s.title || '').trim()));
    state.hexByPattern.set(h.lines.join(''), h);
    state.hexByNumber.set(h.number, h);
  });

  const st = state.data.metadata.stats;
  const annotationCount = state.data.metadata.v2Stats?.visibleAnnotations ?? st.commentaries;
  dom.status.textContent = `${st.hexagrams} 卦 · ${annotationCount.toLocaleString()} 条星图注文 · ${st.scholars} 家`;
  dom.begin.disabled = false;
  startHexagramCycle();
  bindEvents();
}

function startHexagramCycle() {
  if (!state.data?.hexagrams?.length || !dom.askHexagram) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.clearTimeout(state.cycleTimer);
  state.cycleIndex = Math.floor(Math.random() * 64);
  state.cycleDirection = Math.random() < .5 ? -1 : 1;

  const grayPattern = (index) => {
    const normalized = (index + 64) % 64;
    return (normalized ^ (normalized >> 1)).toString(2).padStart(6, '0');
  };

  const makeLine = (yang) => {
    const row = document.createElement('div');
    row.className = `hx-line ${yang ? 'yang' : 'yin'}`;
    row.innerHTML = '<span class="seg seg-left"></span><span class="seg seg-right"></span>';
    return row;
  };

  const setCaption = (pattern, immediate = false) => {
    const hex = state.hexByPattern.get(pattern);
    if (!hex) return;
    const caption = dom.cycleName.parentElement;
    if (immediate || reduceMotion) {
      dom.cycleNumber.textContent = String(hex.number).padStart(2, '0');
      dom.cycleName.textContent = hex.name;
      return;
    }
    caption.animate([
      { opacity: .3, transform: 'translate(-50%, 3px)' },
      { opacity: 1, transform: 'translate(-50%, 0)' },
    ], { duration: 420, easing: 'ease-out' });
    window.setTimeout(() => {
      dom.cycleNumber.textContent = String(hex.number).padStart(2, '0');
      dom.cycleName.textContent = hex.name;
    }, 150);
  };

  const first = grayPattern(state.cycleIndex);
  dom.askHexagram.innerHTML = '';
  [...first].forEach((bit) => dom.askHexagram.append(makeLine(bit === '1')));
  state.cyclePattern = first;
  setCaption(first, true);
  if (reduceMotion) return;

  const advance = () => {
    state.cycleIndex = (state.cycleIndex + state.cycleDirection + 64) % 64;
    const next = grayPattern(state.cycleIndex);
    const changedIndex = [...next].findIndex((bit, index) => bit !== state.cyclePattern[index]);
    const row = dom.askHexagram.children[changedIndex];
    if (row) {
      row.classList.add('morphing');
      row.classList.toggle('yang', next[changedIndex] === '1');
      row.classList.toggle('yin', next[changedIndex] !== '1');
      window.setTimeout(() => row.classList.remove('morphing'), 620);
    }
    state.cyclePattern = next;
    setCaption(next);
    state.cycleTimer = window.setTimeout(advance, 940 + Math.random() * 560);
  };
  state.cycleTimer = window.setTimeout(advance, 1100);
}

/* ── 阶段切换 ─────────────────────────── */
function showStage(name) {
  Object.entries(dom.stages).forEach(([k, el]) => { el.hidden = k !== name; });
  dom.app.dataset.currentStage = name;
  dom.phases.forEach((phase) => {
    const active = phase.dataset.phase === name;
    phase.classList.toggle('active', active);
    if (active) phase.setAttribute('aria-current', 'step');
    else phase.removeAttribute('aria-current');
  });
  dom.stage.scrollTo({ top: 0, behavior: 'instant' });
}

/* ── 三钱成爻 ─────────────────────────── */
// 每爻掷三钱，字=3 背=2；三枚之和：6 老阴(变)、7 少阳、8 少阴、9 老阳(变)
function tossOnce() {
  const coins = [0, 0, 0].map(() => (Math.random() < 0.5 ? 3 : 2));
  const sum = coins.reduce((a, b) => a + b, 0);
  return { coins, sum, yang: sum % 2 === 1, changing: sum === 6 || sum === 9 };
}

function sumLabel(sum) {
  return { 6: '老阴 · 变', 7: '少阳', 8: '少阴', 9: '老阳 · 变' }[sum];
}

function renderCoins(coins, spin = false) {
  [...dom.coins.children].forEach((el, i) => {
    if (coins[i] !== 2 && coins[i] !== 3) {
      el.className = 'coin';
      el.textContent = '';
      return;
    }
    const zi = coins[i] === 3;
    el.className = `coin ${zi ? 'zi' : 'bei'}${spin ? ' spin' : ''}`;
    el.textContent = zi ? '字' : '背';
  });
}

function lineMark(line) {
  return line.changing ? (line.yang ? '○' : '×') : '';
}

// 卦象 DOM（column-reverse：数组下标 0 为初爻，在最下）
function renderHexagram(container, lines, { showChange = true } = {}) {
  container.innerHTML = '';
  lines.forEach((line) => {
    const row = document.createElement('div');
    row.className = `hx-line ${line.yang ? 'yang' : 'yin'}${showChange && line.changing ? ' change' : ''}`;
    if (showChange && line.changing) row.dataset.mark = lineMark(line);
    if (line.yang) {
      row.innerHTML = '<span class="seg"></span>';
    } else {
      row.innerHTML = '<span class="seg"></span><span class="seg"></span>';
    }
    container.append(row);
  });
}

/* ── 摇卦流程 ─────────────────────────── */
function startCast() {
  state.lines = [];
  state.queryContext = makeMomentContext();
  enrichPermittedLocation(state.queryContext);
  dom.castHexagram.innerHTML = '';
  dom.coinRead.innerHTML = '&nbsp;';
  renderCoins([0, 0, 0]);
  updateCastProgress();
  dom.toss.disabled = false;
  showStage('cast');
}

function updateCastProgress() {
  const n = state.lines.length;
  dom.castProgress.textContent = n < 6 ? `第 ${n + 1} / 6 爻` : '六爻已成';
}

function doToss() {
  if (state.lines.length >= 6) return;
  const line = tossOnce();
  renderCoins(line.coins, true);
  state.lines.push(line);
  renderHexagram(dom.castHexagram, state.lines);
  dom.coinRead.textContent = `${line.coins.map((c) => (c === 3 ? '字' : '背')).join(' ')}　${sumLabel(line.sum)}`;
  updateCastProgress();
  if (state.lines.length >= 6) {
    dom.toss.disabled = true;
    window.setTimeout(reveal, 850);
  }
}

function tossAll() {
  while (state.lines.length < 6) {
    const line = tossOnce();
    state.lines.push(line);
  }
  renderCoins(state.lines[5].coins);
  renderHexagram(dom.castHexagram, state.lines);
  updateCastProgress();
  dom.toss.disabled = true;
  window.setTimeout(reveal, 500);
}

/* ── 之卦与读法（朱熹《易学启蒙》变占之法）──────── */
function benPattern() { return state.lines.map((l) => (l.yang ? '1' : '0')).join(''); }
function zhiPattern() {
  return state.lines.map((l) => {
    const v = l.changing ? !l.yang : l.yang; // 变爻取反
    return v ? '1' : '0';
  }).join('');
}

function computeReading() {
  const ben = state.hexByPattern.get(benPattern());
  const changing = state.lines.map((l, i) => (l.changing ? i : -1)).filter((i) => i >= 0); // 下标，自下而上
  const n = changing.length;
  const zhi = n > 0 ? state.hexByPattern.get(zhiPattern()) : null;

  const posName = ['初', '二', '三', '四', '五', '上'];
  let section, rule, focusHex = ben;
  let secondary = [];

  if (n === 0) {
    section = ben._judgment;
    rule = '本卦无变爻 · 观本卦卦辞';
  } else if (n === 1) {
    section = ben._lineSections[changing[0]];
    rule = `一爻变 · 观本卦${posName[changing[0]]}爻`;
  } else if (n === 2) {
    const upper = Math.max(...changing);
    section = ben._lineSections[upper];
    secondary = changing.filter((i) => i !== upper).map((i) => ({ hex: ben, section: ben._lineSections[i] }));
    rule = `二爻变 · 以上者${posName[upper]}爻为主`;
  } else if (n === 3) {
    section = ben._judgment;
    secondary = [{ hex: zhi, section: zhi._judgment }];
    rule = '三爻变 · 观本卦与之卦卦辞';
  } else if (n === 4 || n === 5) {
    focusHex = zhi;
    const unchanged = [0, 1, 2, 3, 4, 5].filter((i) => !changing.includes(i));
    const idx = n === 4 ? Math.min(...unchanged) : unchanged[0];
    section = zhi._lineSections[idx];
    if (n === 4) secondary = unchanged.filter((i) => i !== idx).map((i) => ({ hex: zhi, section: zhi._lineSections[i] }));
    rule = `${n}爻变 · 观之卦不变之${posName[idx]}爻`;
  } else { // n === 6
    if (ben.number === 1 && ben._yong) { section = ben._yong; rule = '乾之六爻皆变 · 观用九'; }
    else if (ben.number === 2 && ben._yong) { section = ben._yong; rule = '坤之六爻皆变 · 观用六'; }
    else { focusHex = zhi; section = zhi._judgment; rule = '六爻皆变 · 观之卦卦辞'; }
  }

  return { ben, zhi, changing, n, section, secondary, rule, focusHex };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]);
}

function sourceText(section) {
  return [section?.title, section?.canonicalText].filter(Boolean).join('　');
}

/* ── 揭示 ─────────────────────────────── */
function reveal() {
  const r = computeReading();
  state.reading = r;
  const { ben, zhi, section, rule, focusHex } = r;

  renderHexagram(dom.revealHexagram, state.lines);
  dom.hexSymbol.textContent = ben.symbol;
  dom.hexName.textContent = ben.name;
  dom.hexTrigrams.textContent = `上 ${ben.upperTrigram} · 下 ${ben.lowerTrigram}`;
  dom.hexChange.textContent = zhi
    ? `${ben.symbol} ${ben.name} 之 ${zhi.symbol} ${zhi.name}`
    : '六爻皆静 · 无之卦';

  // 占断（头条 · 直接建议）
  const oracle = composeOracle(r);
  r.oracle = oracle;
  dom.oracleBadge.textContent = `${oracle.badge} · ${oracle.level}`;
  dom.oracleBadge.className = `oracle-badge ${oracle.tone}`;
  dom.oracleText.textContent = oracle.text;

  // 依据（下沉 · 爻辞白话）
  dom.readingRule.textContent = rule;
  dom.revealSource.textContent = sourceText(section) || ben.statement;
  dom.revealVernacular.textContent = vernacularFor(focusHex, section);
  const secondary = r.secondary || [];
  dom.revealSecondary.hidden = secondary.length === 0;
  dom.revealSecondary.innerHTML = secondary.length ? `
    <p class="secondary-label">辅助依据 / SUPPORTING TEXT</p>
    ${secondary.map((item) => `<div class="secondary-item">
      <p class="secondary-source">${escapeHtml(item.hex.name)} · ${escapeHtml(sourceText(item.section))}</p>
      <p class="secondary-translation">${escapeHtml(vernacularFor(item.hex, item.section))}</p>
    </div>`).join('')}` : '';

  const q = dom.question.value.trim();
  dom.questionEcho.hidden = !q;
  dom.questionEcho.textContent = q;

  setupMasters(section);
  showStage('reveal');
}

// 白话：line 段取该爻今译，judgment 段取卦辞今译
function vernacularFor(hex, section) {
  return section?.translation || hex?.statementTranslation || '（星图数据暂无今译）';
}

/* ── 历代解卦人 ───────────────────────── */
function commentaryOf(section, scholarNames) {
  for (const name of scholarNames) {
    const hits = (section.annotations || []).filter((c) => c.scholar === name);
    if (hits.length) return {
      scholar: name,
      work: [...new Set(hits.map((c) => c.work).filter(Boolean))].join('、'),
      text: hits.map((c) => c.text).join('\n\n'),
    };
  }
  return null;
}

function translateCommentaryText(text) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '这条注文暂时没有可供转译的正文。';
  const clauses = normalized.match(/[^。！？；]+[。！？；]?/g) || [normalized];
  const selected = clauses.slice(0, 7).join('').slice(0, 760);
  let plain = selected
    .replace(/君子行此四德者/g, '君子践行这四种品德')
    .replace(/纯阳，天之精气/g, '纯阳是天的精气')
    .replace(/四行，君之懿德/g, '这四种行为是君主应有的美德')
    .replace(/乾冠卦首/g, '乾卦排在六十四卦之首')
    .replace(/辞表篇目/g, '卦辞又标示全篇的纲目')
    .replace(/明道义之门在于此/g, '表明理解《易》之道要从这里开始')
    .replace(/如同《春秋》之?備五始也/g, '就像《春秋》以“五始”统摄全篇')
    .replace(/夫子留意于此/g, '孔子因此特别重视这一点')
    .replace(/夫子留意於此/g, '孔子特别重视这一点')
    .replace(/体仁正己/g, '体会仁德、端正自己')
    .replace(/观运知时/g, '观察变化、把握时机')
    .replace(/顺天/g, '顺应天道')
    .replace(/化物/g, '感化万物')
    .replace(/正义作/g, '《正义》解释为')
    .replace(/集解作/g, '《集解》解释为')
    .replace(/是以/g, '因此')
    .replace(/是故/g, '所以')
    .replace(/然则/g, '因而')
    .replace(/故曰/g, '所以说')
    .replace(/故云/g, '所以说')
    .replace(/故(?=[^事旧人国])/g, '所以')
    .replace(/盖/g, '这是因为')
    .replace(/言之/g, '说这件事')
    .replace(/(^|[。；])言/g, '$1这里是说')
    .replace(/谓之/g, '把它称为')
    .replace(/谓/g, '指的是')
    .replace(/犹/g, '如同')
    .replace(/懿德/g, '美德')
    .replace(/庶物/g, '万物')
    .replace(/百物/g, '万物')
    .replace(/万方/g, '天下各处')
    .replace(/皆/g, '都')
    .replace(/宜/g, '适合')
    .replace(/勿/g, '不要')
    .replace(/未/g, '还没有')
    .replace(/不得/g, '不能')
    .replace(/无有/g, '没有')
    .replace(/无咎/g, '没有灾咎')
    .replace(/无悔/g, '没有后悔')
    .replace(/得其所/g, '各自处在合适的位置')
    .replace(/(^|[。；]\s*)夫/g, '$1')
    .replace(/之(?=[性德气道门义理时位功用体象数始终正美善事物人天地君臣民国家身心])/g, '的');

  plain = plain
    .replace(/“?([^”，。；]{1,14})”?者[，,]([^。；]{1,44})也(?=[。；]|$)/g, '所谓“$1”，就是$2')
    .replace(/“?([^”，。；]{1,12})”?[，,]([^。；]{1,34})也(?=[。；]|$)/g, '“$1”，意思是$2')
    .replace(/者也(?=[。；]|$)/g, '的意思')
    .replace(/也(?=[。；]|$)/g, '')
    .replace(/矣(?=[。；]|$)/g, '了')
    .replace(/焉(?=[。；]|$)/g, '于此')
    .replace(/；+/g, '。')
    .replace(/。。+/g, '。');

  return `用今天的话说：${plain}${normalized.length > selected.length ? '……' : ''}`;
}

function personaPlainReading(seat) {
  const r = state.reading;
  const oracle = r.oracle;
  const context = oracle.context;
  const direction = r.zhi
    ? `局面正从“${THEMES[r.ben.number]}”转向“${THEMES[r.zhi.number]}”`
    : `当前局面的核心是“${THEMES[r.ben.number]}”`;
  const riskTail = context.riskNote ? ` ${context.riskNote}` : '';
  const readings = {
    han: `先看${context.factors}是否真的配套。${direction}。条件不合时不要硬推；条件相合，也要按节奏一步步验证。${riskTail}`,
    wei: `重点不只是结果，而是你的做法是否稳当。把${context.factors}说清、做实，再按经文提示决定进退。${riskTail}`,
    shi: `${direction}。先处理眼前最关键的矛盾，并给下一步保留调整空间。${riskTail}`,
    now: `简单说：${contextualAdvice(oracle.verdict, context)}`,
  };
  return readings[seat.id] || readings.now;
}

function setupMasters(section) {
  // 组装席位：星图 v2 实际有注文的注家 + 今译。
  const seats = PERSONAS.map((p) => {
    const found = commentaryOf(section, p.scholars);
    return { ...p, kind: 'classic', found };
  });
  seats.push({
    id: 'now', klass: 'now', label: '今 · 白话', era: '现代', avatar: '今',
    stance: '用今天的话，把经文落到你问的事情上。',
    kind: 'vernacular', found: { text: vernacularFor(state.reading.focusHex, section) },
  });

  dom.masterTabs.innerHTML = '';
  const available = seats.filter((s) => s.kind === 'vernacular' || s.found);
  // 默认从最早的“有说”注家进入；若无则退到白话
  const defaultSeat = seats.find((s) => s.kind === 'classic' && s.found) || available[0];

  seats.forEach((seat) => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'm-tab';
    const enabled = seat.kind === 'vernacular' || !!seat.found;
    tab.disabled = !enabled;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.innerHTML = `<span class="av ${seat.klass}">${escapeHtml(seat.avatar)}</span>${escapeHtml(labelShort(seat))}`;
    tab.title = enabled ? seat.label : '此类注家于本条无已挂接注文';
    if (enabled) tab.addEventListener('click', () => selectMaster(seat, section, tab));
    dom.masterTabs.append(tab);
    seat._tab = tab;
  });

  dom.masters.hidden = false;
  dom.mastersToggle.setAttribute('aria-expanded', 'true');
  dom.mastersBody.hidden = false;
  // 默认展开，并预置最早的有说注家。
  if (defaultSeat) selectMaster(defaultSeat, section, defaultSeat._tab);
}

function labelShort(seat) {
  if (seat.kind === 'classic' && seat.found) return seat.found.scholar;
  if (seat.id === 'now') return '白话';
  return seat.label.split(' · ')[0];
}

function selectMaster(seat, section, tab) {
  state.activePersona = seat.id;
  [...dom.masterTabs.children].forEach((t) => {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  if (tab) {
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
  }

  const simpleReading = personaPlainReading(seat);
  let html = `
    <div class="m-head">
      <span class="big-av av ${seat.klass}">${escapeHtml(seat.avatar)}</span>
      <div class="who"><h3>${escapeHtml(seat.kind === 'classic' && seat.found ? seat.found.scholar : seat.label)}</h3><div class="era">${escapeHtml(seat.era)}</div></div>
    </div>`;

  if (seat.kind === 'vernacular') {
    html += `<p class="m-stance"><span class="q">${escapeHtml(simpleReading)}</span></p>
      <p class="m-empty"><span class="reading-kind">星图今译</span>${escapeHtml(seat.found.text)}</p>`;
  } else if (seat.found) {
    html += `<p class="m-stance"><span class="reading-kind">按${escapeHtml(seat.label)}取向作现代提示 · 非注家原话</span>${escapeHtml(simpleReading)}</p>
      <p class="m-commentary-translation"><span class="reading-kind">注家白话 · 译解初稿</span>${escapeHtml(translateCommentaryText(seat.found.text))}</p>
      <div class="m-original">
        <button class="m-original-toggle" type="button" aria-expanded="false">
          查看注家原文 <span class="cite">《${escapeHtml(seat.found.work)}》 · ${escapeHtml(seat.found.scholar)}</span>
        </button>
        <p class="m-original-text" hidden>${escapeHtml(seat.found.text)}</p>
      </div>`;
  }
  dom.masterCard.innerHTML = html;
  updateResultLinks(seat, section);

  const toggle = dom.masterCard.querySelector('.m-original-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const t = dom.masterCard.querySelector('.m-original-text');
      const open = t.hidden;
      t.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.firstChild.textContent = open ? '收起注家原文 ' : '查看注家原文 ';
    });
  }
}

function updateResultLinks(seat, section) {
  const reading = state.reading;
  if (!reading) return;
  const scholar = seat?.kind === 'classic' ? seat.found?.scholar : null;
  const line = section?.type === 'line' ? section.linePosition : null;
  dom.linkStarmap.href = starMapUrl({ hex: reading.focusHex.number, line, scholar });
  dom.linkStarmap.innerHTML = `在星图中查看${line ? `第${line}爻` : '此卦'} <span>↗</span>`;

  const historyHref = scholar ? lifeHistoryUrl(scholar) : null;
  dom.linkHistory.hidden = !historyHref;
  if (historyHref) {
    dom.linkHistory.href = historyHref;
    dom.linkHistory.innerHTML = `查看${escapeHtml(scholar)}的历史位置 <span>↗</span>`;
  }
}

/* ── 事件 ─────────────────────────────── */
function bindEvents() {
  dom.begin.addEventListener('click', startCast);
  dom.toss.addEventListener('click', doToss);
  dom.tossAll.addEventListener('click', tossAll);
  dom.again.addEventListener('click', () => { showStage('ask'); dom.question.focus(); });
  dom.mastersToggle.addEventListener('click', () => {
    const open = dom.mastersBody.hidden;
    dom.mastersBody.hidden = !open;
    dom.mastersToggle.setAttribute('aria-expanded', String(open));
  });
}

initRitualSky();
load();
if (typeof window !== 'undefined') {
  window.__gua = {
    state,
    // 测试用：强制一副指定爻线（数组，自下而上，值 6/7/8/9）
    force(sums) {
      state.lines = sums.map((s) => ({ coins: [], sum: s, yang: s % 2 === 1, changing: s === 6 || s === 9 }));
      reveal();
    },
    tossOnce, computeReading,
  };
}
