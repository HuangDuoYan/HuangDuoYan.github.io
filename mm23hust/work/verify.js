/* verify.js — 无浏览器环境下的静态校验
 * 1) 用 Vue 自带编译器编译所有组件模板，捕获模板语法错误
 * 2) 交叉检查模板里用到的自定义组件是否已注册
 * 3) 交叉检查模板里的标识符是否在 props / data / computed / methods / 白名单中
 * 4) 检查 figure-card 引用的图片文件是否存在
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname.replace(/\/work$/, '');
const files = [
  'vendor/vue.global.prod.js',
  'assets/js/data.js',
  'assets/js/characters.js',
  'assets/js/charts.js',
  'assets/js/sims.js',
  'assets/js/sections.js'
];

const sandbox = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, Promise, Object, Array, String, Number, Boolean, RegExp, Error, Map, Set, Symbol,
  navigator: { userAgent: 'node' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
/* Vue 的浏览器构建用 document 做 HTML 实体解码，这里提供最小可用桩 */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', times: '\u00d7', minus: '\u2212' };
function decodeEntities(str) {
  return String(str).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, g) => {
    if (g[0] === '#') {
      const n = g[1] === 'x' || g[1] === 'X' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENT[g] !== undefined ? ENT[g] : m;
  });
}
function makeStubEl() {
  const el = {
    _html: '', _attrs: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) {
      this._html = v;
      const m = /^<div foo="([\s\S]*)">$/.exec(v);
      if (m) { this._attrs.foo = decodeEntities(m[1]); this.children = [{ getAttribute: (k) => el._attrs[k] }]; }
      else { this.textContent = decodeEntities(v); this.children = []; }
    },
    textContent: '', children: [],
    getAttribute(k) { return this._attrs[k]; },
    setAttribute(k, v) { this._attrs[k] = v; }
  };
  return el;
}
sandbox.document = {
  createElement: () => makeStubEl(),
  createTextNode: () => ({}), createComment: () => ({}),
  documentElement: { scrollHeight: 2000, clientHeight: 800, scrollTop: 0 },
  getElementById: () => null, querySelectorAll: () => [],
  addEventListener() {}, removeEventListener() {}
};

const ctx = vm.createContext(sandbox);

for (const f of files) {
  const p = path.join(ROOT, f);
  const code = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: f });
  } catch (e) {
    console.error('LOAD FAIL', f, '->', e.message);
    process.exit(1);
  }
}

const Vue = sandbox.Vue;
if (!Vue || typeof Vue.compile !== 'function') {
  console.error('FATAL: Vue.compile 不可用（vendor 里可能是 runtime-only 构建）');
  process.exit(1);
}
console.log('Vue version:', Vue.version, '| compile():', typeof Vue.compile);

/* --- 把 app.js 的根组件模板也拿进来（app.js 会 mount，需先桩化 DOM） --- */
const appSrc = fs.readFileSync(path.join(ROOT, 'assets/js/app.js'), 'utf8');
const mounted = [];
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
let rootTemplate = null;
let rootOpts = null;
let registered = null;
const realCreateApp = Vue.createApp;
Vue.createApp = function (opts) {
  rootTemplate = opts.template;
  rootOpts = opts;
  const comps = {};
  return {
    component(name, def) { comps[name] = def; return this; },
    mount() { registered = comps; mounted.push(1); return {}; }
  };
};
try {
  vm.runInContext(appSrc, ctx, { filename: 'assets/js/app.js' });
} catch (e) {
  console.error('LOAD FAIL app.js ->', e.message);
  process.exit(1);
}
Vue.createApp = realCreateApp;

const comps = sandbox.APP.components;
const names = Object.keys(comps);
console.log('registered components:', names.length, '->', names.join(', '));
if (!registered || Object.keys(registered).length !== names.length) {
  console.error('FATAL: app.js 未注册全部组件');
  process.exit(1);
}

/* --------------------------------------------------- 1) 模板编译 */
let errors = 0;
const ALLOWED_GLOBALS = new Set(['Math', 'Date', 'JSON', 'Number', 'String', 'Boolean', 'Array',
  'Object', 'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'undefined', 'null', 'true', 'false',
  'NaN', 'Infinity', 'console', '$event', '$refs', '$nextTick', '$emit', '$slots', '$props', '$attrs',
  'in', 'of', 'typeof', 'new', 'delete', 'void', 'instanceof']);

function optionKeys(def) {
  const keys = new Set();
  const add = (o) => { if (o) Object.keys(o).forEach(k => keys.add(k)); };
  add(def.computed); add(def.methods);
  if (Array.isArray(def.props)) def.props.forEach(p => keys.add(p));
  else add(def.props);
  if (typeof def.data === 'function') {
    try { add(def.data.call({})); } catch (e) { /* ignore */ }
  }
  return keys;
}

const allTemplates = names.map(n => ({ name: n, def: comps[n], template: comps[n].template }));
allTemplates.push({ name: '__root__', def: rootOpts, template: rootTemplate });

for (const t of allTemplates) {
  if (!t.template) { console.error('MISSING template:', t.name); errors++; continue; }
  try {
    Vue.compile(t.template, { onError(e) { throw e; } });
  } catch (e) {
    console.error('TEMPLATE ERROR in <' + t.name + '>:', e.message);
    errors++;
  }
}
console.log(errors === 0 ? '✔ 所有模板编译通过' : '✘ 模板编译错误 ' + errors + ' 处');

/* ------------------------------------- 2) 模板里用到的自定义组件必须已注册 */
const known = new Set(names.concat(['component', 'transition', 'transition-group', 'teleport',
  'template', 'keep-alive', 'slot', 'suspense']));
const HTML = new Set(('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas ' +
  'caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset ' +
  'figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd ' +
  'label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p ' +
  'param picture pre progress q rp rt ruby s samp script section select slot small source span strong style ' +
  'sub summary sup table tbody td textarea tfoot th thead time title tr track u ul var video wbr ' +
  'svg g path circle ellipse rect line polyline polygon text tspan defs lineargradient radialgradient stop ' +
  'clippath mask use symbol marker filter feoffset fegaussianblur femerge femergenode image foreignobject ' +
  'animate animatetransform desc pattern textpath').split(' '));
let unknown = 0;
for (const t of allTemplates) {
  if (!t.template) continue;
  const tags = new Set();
  t.template.replace(/<([a-zA-Z][a-zA-Z0-9-]*)/g, (m, tag) => { tags.add(tag.toLowerCase()); return m; });
  for (const tag of tags) {
    if (HTML.has(tag) || known.has(tag)) continue;
    console.error('UNKNOWN TAG <' + tag + '> used inside <' + t.name + '>');
    unknown++;
  }
}
console.log(unknown === 0 ? '✔ 所有自定义标签均已注册' : '✘ 未注册标签 ' + unknown + ' 个');

/* --------------------------- 3) 模板标识符必须在组件选项里存在（启发式） */
let missing = 0;
for (const t of allTemplates) {
  if (!t.template) continue;
  const keys = optionKeys(t.def);
  const exprs = [];
  // {{ ... }} 插值
  t.template.replace(/\{\{([\s\S]*?)\}\}/g, (m, e) => { exprs.push(e); return m; });
  // 指令 / 绑定属性值
  t.template.replace(/(?::|@|v-[a-z]+[:.\w-]*)\s*=\s*\\?['"]([^'"]*)\\?['"]/g, (m, e) => { exprs.push(e); return m; });
  const seen = new Set();
  for (const ex of exprs) {
    // 提取根标识符：忽略字符串字面量、属性访问的后半段
    const cleaned = ex.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
    let m2; const re = /(^|[^.\w$'"])([A-Za-z_$][\w$]*)/g;
    while ((m2 = re.exec(cleaned))) {
      const id = m2[2];
      if (seen.has(id)) continue;
      seen.add(id);
      if (ALLOWED_GLOBALS.has(id) || keys.has(id)) continue;
      // v-for 局部变量：粗略地从模板中收集
      if (new RegExp('v-for="\\(?\\s*[\\w$,\\s]*\\b' + id + '\\b').test(t.template)) continue;
      if (new RegExp('\\bin\\s+[\\w.$]*\\b').test(cleaned) && /^(i|k|idx|index)$/.test(id)) continue;
      console.error('MAYBE-UNDEFINED "' + id + '" in <' + t.name + '>  expr: ' + ex.trim().slice(0, 70));
      missing++;
    }
  }
}
console.log(missing === 0 ? '✔ 模板标识符检查通过' : '⚠ 疑似未定义标识符 ' + missing + ' 处（需人工确认）');

/* ------------------------------------------------- 4) 图片文件存在性 */
let figMissing = 0;
for (const f of sandbox.PAPER_DATA.figures) {
  const p = path.join(ROOT, 'assets/figures', f.id + '.png');
  if (!fs.existsSync(p)) { console.error('MISSING FIGURE:', f.id + '.png'); figMissing++; }
}
// 章节里硬编码引用的图
const srcAll = ['assets/js/sections.js', 'assets/js/app.js', 'assets/js/data.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const refIds = new Set();
srcAll.replace(/id="(fig[\w]+)"/g, (m, id) => { refIds.add(id); return m; });
srcAll.replace(/:id="c\.figure2?"/g, m => m);
for (const id of refIds) {
  if (!fs.existsSync(path.join(ROOT, 'assets/figures', id + '.png'))) {
    console.error('MISSING REFERENCED FIGURE:', id); figMissing++;
  }
}
// data.js chain 里的 figure / figure2
for (const c of sandbox.PAPER_DATA.chain) {
  for (const k of ['figure', 'figure2']) {
    if (c[k] && !fs.existsSync(path.join(ROOT, 'assets/figures', c[k] + '.png'))) {
      console.error('MISSING CHAIN FIGURE:', c[k]); figMissing++;
    }
    if (c[k] && !sandbox.PAPER_DATA.figures.some(f => f.id === c[k])) {
      console.error('CHAIN FIGURE NOT IN GALLERY DATA:', c[k]); figMissing++;
    }
  }
}
console.log(figMissing === 0 ? '✔ 所有图片引用均存在' : '✘ 图片缺失 ' + figMissing + ' 处');

/* ---------------------------------------------- 5) 对白角色 key 合法性 */
let dlgBad = 0;
for (const [sec, lines] of Object.entries(sandbox.PAPER_DATA.dialogues)) {
  for (const l of lines) {
    if (!sandbox.PAPER_DATA.characters[l.who]) { console.error('BAD character key', l.who, 'in', sec); dlgBad++; }
    if (!['puzzle', 'think', 'insight'].includes(l.mood)) { console.error('BAD mood', l.mood, 'in', sec); dlgBad++; }
  }
}
const secIds = ['s1', 's2', 's3', 's4', 's5', 's6', 's7'];
for (const s of secIds) if (!sandbox.PAPER_DATA.dialogues[s]) { console.error('MISSING dialogue for', s); dlgBad++; }
console.log(dlgBad === 0 ? '✔ 对白数据检查通过' : '✘ 对白数据问题 ' + dlgBad + ' 处');

/* ---------------------------------------------- 6) 关键计算函数自测 */
const K = sandbox.PAPER_DATA.simConst;
const A = (x) => K.accFit.a - K.accFit.b * Math.exp(-K.accFit.c * x);
console.log('自测 A(e·n): A(0.1)=' + A(0.1).toFixed(4) + '  A(0.3)=' + A(0.3).toFixed(4) +
  '  A(0.8)=' + A(0.8).toFixed(4) + '  （应单调递增并饱和于 ' + K.accFit.a + '）');
const pct = sandbox.PAPER_DATA.decomposition.parts.reduce((a, p) => a + p.pct, 0);
console.log('自测 延迟四段占比之和 = ' + pct.toFixed(1) + '%');
if (Math.abs(pct - 100) > 0.05) { console.error('占比之和不等于 100%'); errors++; }

const total = errors + unknown + figMissing + dlgBad;
console.log('\n=== ' + (total === 0 ? 'PASS' : 'FAIL(' + total + ')') + ' === (MAYBE-UNDEFINED 需人工判断: ' + missing + ')');
process.exit(total === 0 ? 0 : 1);
