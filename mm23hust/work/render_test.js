/* render_test.js — 用 jsdom 真正挂载 Vue 应用，验证渲染结果与交互 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('/home/huang/Documents/creative/work/domcheck/node_modules/jsdom');

const ROOT = '/home/huang/Documents/creative';
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const errors = [];
const warns = [];

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  resources: undefined
});
const w = dom.window;

/* 收集运行期错误 */
w.addEventListener('error', (e) => errors.push('window error: ' + (e.message || e)));
const origErr = console.error;
w.console = {
  log: (...a) => {},
  info: () => {}, debug: () => {}, trace: () => {},
  warn: (...a) => warns.push(a.join(' ')),
  error: (...a) => errors.push(a.map(String).join(' '))
};

/* IntersectionObserver / matchMedia 桩 */
w.IntersectionObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { this.cb([{ isIntersecting: true, target: el }], this); }
  unobserve() {} disconnect() {}
};
w.requestAnimationFrame = (cb) => w.setTimeout(cb, 0);
w.cancelAnimationFrame = (id) => w.clearTimeout(id);
if (!w.Element.prototype.scrollIntoView) w.Element.prototype.scrollIntoView = function () {};

const scripts = [
  'vendor/vue.global.prod.js',
  'assets/js/data.js',
  'assets/js/characters.js',
  'assets/js/charts.js',
  'assets/js/sims.js',
  'assets/js/sections.js',
  'assets/js/app.js'
];
for (const s of scripts) {
  try {
    w.eval(fs.readFileSync(path.join(ROOT, s), 'utf8'));
  } catch (e) {
    errors.push('SCRIPT ' + s + ' threw: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n'));
  }
}

function run() {
  const $ = (sel) => w.document.querySelector(sel);
  const $$ = (sel) => Array.from(w.document.querySelectorAll(sel));
  const checks = [];
  const chk = (name, cond, extra) => {
    checks.push({ name, ok: !!cond, extra: extra || '' });
  };

  chk('Vue 已挂载', w.__APP_MOUNTED__ === true);
  chk('根容器已渲染 .app', !!$('.app'));
  chk('顶栏导航按钮 = 9 个', $$('.topbar__nav button').length === 9, $$('.topbar__nav button').length);
  chk('封面标题渲染', ($('.hero h1') || {}).textContent && $('.hero h1').textContent.indexOf('边缘辅助') === 0,
      ($('.hero h1') || {}).textContent);
  chk('章节数 = 8（s1..s8）', $$('main > section.sec').length === 8, $$('main > section.sec').length);

  /* 卡通角色 */
  const figs = $$('.cartoon');
  chk('卡通角色 SVG 存在（≥5）', figs.length >= 5, figs.length);
  const svgPaths = $$('.cartoon__svg path, .cartoon__svg circle, .cartoon__svg rect');
  chk('角色由 SVG 图元绘制（≥40 个图元）', svgPaths.length >= 40, svgPaths.length);
  const tags = $$('.cartoon__tag b').map(e => e.textContent);
  chk('三个角色都出现（小惑/老衍/阿悟）',
      tags.includes('小惑') && tags.includes('老衍') && tags.includes('阿悟'), tags.join(','));

  /* 气泡 */
  const bubbles = $$('.bubble');
  chk('气泡已渲染', bubbles.length >= 1, bubbles.length);
  chk('气泡带 SVG 尾巴', $$('.bubble__tail path').length >= 1, $$('.bubble__tail').length);
  const moods = $$('.bubble__mood').map(e => e.textContent.trim());
  chk('气泡标注了情绪（疑惑/思考/感悟）', moods.length > 0, moods.slice(0, 3).join(' | '));

  /* 各分析板块的核心内容 */
  chk('§1 张力图 5 个节点', $$('.tmap__node').length === 5, $$('.tmap__node').length);
  chk('§1 已有方法对比表有行', $$('.tbl tbody tr').length >= 6, $$('.tbl tbody tr').length);
  chk('§1 恶劣环境演示存在', !!$('.advdemo__svg'));
  chk('§2 推导链 10 层', $$('.chain__node').length === 10, $$('.chain__node').length);
  chk('§2 推导链默认展开一层', $$('.chain__node.is-open').length === 1, $$('.chain__node.is-open').length);
  chk('§2 展开层含 5 段推导', $$('.chain__node.is-open .derive__step').length === 5,
      $$('.chain__node.is-open .derive__step').length);
  chk('§3 结构映射卡 11 张', $$('.mapcard').length === 11, $$('.mapcard').length);
  chk('§3 拟合曲线有路径数据', ($('.fitc__line--acc') || {}).getAttribute &&
      $('.fitc__line--acc').getAttribute('d').length > 200);
  chk('§4 隐藏约束卡 13 张', $$('.hidcard').length === 13, $$('.hidcard').length);
  chk('§4 延迟分解 4 段', $$('.decomp__key li').length === 4, $$('.decomp__key li').length);
  chk('§4 量化结论 6 张', $$('.claims__card').length === 6, $$('.claims__card').length);
  chk('§4 首次更新 5 行', $$('.fuc__row').length === 5, $$('.fuc__row').length);
  chk('§5 设计模式 12 条', $$('.patlist li').length === 12, $$('.patlist li').length);
  chk('§5 详情面板有迁移列表', $$('.transfer li').length >= 3, $$('.transfer li').length);
  chk('§6 思维动作 8 条', $$('.lessons > li').length === 8, $$('.lessons > li').length);
  chk('§7 反向审阅 6 条', $$('.critcard').length === 6, $$('.critcard').length);

  /* 图片 */
  const imgs = $$('.figcard img');
  chk('论文图片已引用（≥16 处）', imgs.length >= 16, imgs.length);
  const badSrc = imgs.filter(i => !/^assets\/figures\/fig[\w]+\.png$/.test(i.getAttribute('src')));
  chk('所有 img src 合法', badSrc.length === 0, badSrc.map(i => i.getAttribute('src')).join(','));
  const missing = imgs.map(i => i.getAttribute('src'))
    .filter(s => !fs.existsSync(path.join(ROOT, s)));
  chk('所有 img 指向真实文件', missing.length === 0, Array.from(new Set(missing)).join(','));
  chk('§8 图库 14 张（Fig.2 拆成 a/b）', $$('#s8 .figcard').length === 14, $$('#s8 .figcard').length);

  /* 模拟器默认折叠在推导链里，交互测试展开后再验证 */
  chk('悬浮小助手存在', !!$('.guide__avatar'));

  return checks;
}

/* --------------------------------------------- 交互测试（触发响应式更新） */
const $ = (sel) => w.document.querySelector(sel);
const $$ = (sel) => Array.from(w.document.querySelectorAll(sel));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function click(el) { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); }
function setRange(el, val) { el.value = String(val); el.dispatchEvent(new w.Event('input', { bubbles: true })); }
function btnByText(sel, txt) { return $$(sel).find((b) => b.textContent.indexOf(txt) >= 0); }

async function interact() {
  const out = [];
  const t = (name, ok, extra) => out.push({ name, ok: !!ok, extra: extra === undefined ? '' : extra });

  /* 1) 对白推进 */
  const before = $$('.hero__dlg .dlg__row').length;
  click($$('.hero__dlg .dlg__head button')[0]);
  await sleep(40);
  t('点击"下一句" → 气泡增加一条', $$('.hero__dlg .dlg__row').length === before + 1,
    before + '→' + $$('.hero__dlg .dlg__row').length);

  /* 2) 推导链：单层展开 */
  click($$('.chain__head')[4]);
  await sleep(40);
  let openIds = $$('.chain__node.is-open .chain__badge').map((e) => e.textContent);
  t('点击第 5 层 → 只有该层展开', openIds.length === 1 && openIds[0] === 'L5', openIds.join(','));

  /* 3) 推导链：全部展开（让三个模拟器都挂载） */
  click(btnByText('.chain__ctrl button', '全部展开'));
  await sleep(60);
  t('"全部展开" → 10 层全开', $$('.chain__node.is-open').length === 10, $$('.chain__node.is-open').length);
  t('三个模拟器全部挂载', !!$('.sim--kf') && !!$('.sim--tg') && !!$('.sim--rt'),
    [!!$('.sim--kf'), !!$('.sim--tg'), !!$('.sim--rt')].join(','));
  t('模拟器①渲染 24 帧', $$('.kf__frame').length === 24, $$('.kf__frame').length);
  t('模拟器①存在被选中的帧', $$('.kf__frame.is-sent').length > 0, $$('.kf__frame.is-sent').length);

  /* 4) 结构映射卡翻面 */
  click($$('.mapcard')[0]);
  await sleep(40);
  t('点击映射卡 → 翻面', $$('.mapcard.is-flipped').length === 1, $$('.mapcard.is-flipped').length);

  /* 5) 恶劣环境滑块 → F1 下降、漏检出现 */
  const f1a = parseFloat($('.advdemo__f1 b').textContent);
  setRange($$('.advdemo__ctrl input[type=range]')[0], 95);
  await sleep(40);
  const f1b = parseFloat($('.advdemo__f1 b').textContent);
  t('拉高恶化程度 → F1 明显下降', f1b < f1a - 0.05, f1a + '→' + f1b);
  t('出现漏检提示', !!$('.advdemo__miss'), ($('.advdemo__miss') || {}).textContent);
  const boxA = $$('.advdemo__box').length;
  click(btnByText('.advdemo__presets button', '正常'));
  await sleep(40);
  t('切回"正常" → 检测框全部恢复', $$('.advdemo__box').length === 6, boxA + '→' + $$('.advdemo__box').length);

  /* 6) 触发器：高抖动场景下自适应阈值不误报，固定阈值误报 */
  click(btnByText('.sim--tg .sim__btns button', '高抖动'));
  await sleep(50);
  let verdict = $('.sim--tg .tg__verdict');
  let states = $$('.sim--tg .tg__state').map((e) => e.textContent.trim());
  t('高抖动：本文不触发 而 JIT 固定阈值误报',
    verdict.classList.contains('is-hold') && states[1] === '触发',
    'ours=' + (verdict.classList.contains('is-hold') ? '不触发' : '触发') + ' jit=' + states[1]);

  /* 7) 触发器：突降场景下应触发 */
  click(btnByText('.sim--tg .sim__btns button', '突降'));
  await sleep(50);
  verdict = $('.sim--tg .tg__verdict');
  t('突降（大雪）：本文立即触发', verdict.classList.contains('is-fire'),
    verdict.textContent.trim().slice(0, 24));

  /* 7b) 触发器：缓降场景下本文先触发、JIT 迟到 */
  click(btnByText('.sim--tg .sim__btns button', '缓降'));
  await sleep(50);
  verdict = $('.sim--tg .tg__verdict');
  states = $$('.sim--tg .tg__state').map((e) => e.textContent.trim());
  t('缓降（暗光）：本文已触发 而 JIT 仍在等待',
    verdict.classList.contains('is-fire') && states[1] === '不触发',
    'ours=' + (verdict.classList.contains('is-fire') ? '触发' : '不触发') + ' jit=' + states[1]);

  /* 8) 关键帧：把两步顺序反过来，帧差计算次数上升到全窗 */
  const costBefore = $('.sim--kf .kf__cost b').textContent;
  click($$('.sim--kf .kf__order .seg__b')[1]);
  await sleep(50);
  const costAfter = $('.sim--kf .kf__cost b').textContent;
  t('顺序反过来 → 帧差计算从子集扩到全窗 24 帧',
    costAfter === '24' && costBefore !== '24', costBefore + '→' + costAfter);
  click($$('.sim--kf .kf__order .seg__b')[0]);
  await sleep(30);

  /* 9) 关键帧：降低带宽 → 上传帧数减少 */
  const sent1 = $$('.kf__frame.is-sent').length;
  const bwRange = $$('.sim--kf .sim__ctrls input[type=range]')[1];
  setRange(bwRange, 1);
  await sleep(40);
  const sent2 = $$('.kf__frame.is-sent').length;
  t('带宽降到 1Mbps → 上传帧数被裁剪', sent2 < sent1 && sent2 > 0, sent1 + '→' + sent2);
  setRange(bwRange, 4);
  await sleep(30);

  /* 10) 重训：η 拉满 → 效用下降 */
  const etaRange = $$('.sim--rt .rt__left input[type=range]').find((el) => el.getAttribute('max') === '0.95');
  const uBefore = parseFloat($('.rt__card--u b').textContent);
  setRange(etaRange, 0.95);
  await sleep(40);
  const uAfter = parseFloat($('.rt__card--u b').textContent);
  t('拉高紧急度 η → 效用 U 下降', uAfter < uBefore, uBefore + '→' + uAfter);

  /* 11) 重训：epoch 拉满 → 违反 τ0 */
  const eRange = $$('.sim--rt .rt__left input[type=range]')[0];
  setRange(eRange, 100);
  const nRange = $$('.sim--rt .rt__left input[type=range]')[1];
  setRange(nRange, 320);
  await sleep(50);
  t('e/n 拉满 → 触发 τ₀=60s 违规提示', $('.rt__card.bad') !== null,
    ($('.rt__card.bad em') || {}).textContent);

  /* 12) 重训：穷举最优可运行 */
  click(btnByText('.sim--rt .sim__btns button', '穷举'));
  await sleep(80);
  t('穷举最优可运行并给出配置', !!$('.rt__bf'),
    ($('.rt__bf') || { textContent: 'none' }).textContent.replace(/\s+/g, ' ').slice(0, 70));

  /* 13) 重训：Algorithm 2 模拟退火可运行 */
  click(btnByText('.sim--rt .sim__btns button', 'Algorithm 2'));
  await sleep(700);
  t('Algorithm 2 搜索留下轨迹点', $$('.rt__trail').length > 3, $$('.rt__trail').length);
  const stopBtn = btnByText('.sim--rt .sim__btns button', '停止');
  if (stopBtn) click(stopBtn);
  await sleep(30);

  /* 14) 隐藏约束视角切换 */
  click($$('#s4 .seg--big .seg__b')[0]);
  await sleep(40);
  t('切到"普通论文视角" → 只显示普通做法',
    $$('#s4 .hidcard .c-ord').length === 13 && $$('#s4 .hidcard .c-paper').length === 0,
    'ord=' + $$('#s4 .hidcard .c-ord').length + ' paper=' + $$('#s4 .hidcard .c-paper').length);
  click($$('#s4 .seg--big .seg__b')[2]);
  await sleep(40);
  t('切到"并排对比" → 两栏同时出现',
    $$('#s4 .hidcard .c-ord').length === 13 && $$('#s4 .hidcard .c-paper').length === 13,
    'ord=' + $$('#s4 .hidcard .c-ord').length + ' paper=' + $$('#s4 .hidcard .c-paper').length);

  /* 15) 延迟分解切换到秒数 */
  click(btnByText('.decomp__tabs .tab', '秒数'));
  await sleep(40);
  t('分解图切到秒数视图', $('.decomp__row .decomp__tot').textContent.indexOf('s') > 0,
    $('.decomp__row .decomp__tot').textContent);

  /* 16) 设计模式列表切换 */
  click($$('.patlist li')[3]);
  await sleep(40);
  t('点击第 4 条模式 → 详情联动', $('.patdetail h4').textContent.indexOf(sandboxPatterns[3].name) >= 0,
    $('.patdetail h4').textContent.trim().slice(0, 22));

  /* 17) 图片放大 lightbox（teleport 到 body） */
  click($('.figcard__imgbox'));
  await sleep(50);
  t('点击图片 → lightbox 通过 teleport 挂到 body', !!$('body > .lightbox'),
    $('body > .lightbox') ? 'ok' : 'none');
  if ($('.lightbox')) { click($('.lightbox')); await sleep(40); }
  t('点击后关闭 lightbox', !$('.lightbox'));

  /* 18) §6 八问推导器 */
  const inp = $$('.tool__inputs input')[0];
  inp.value = '多路摄像头共享边缘 GPU 的调度';
  inp.dispatchEvent(new w.Event('input', { bubbles: true }));
  await sleep(50);
  const items = $$('.tool__out li');
  t('八问推导器生成 8 条并回填问题',
    items.length === 8 && items.some((li) => li.textContent.indexOf('多路摄像头共享边缘 GPU 的调度') >= 0),
    items.length + ' 条');

  /* 19) 张力图节点切换 */
  const nodes = $$('.tmap__node');
  click(nodes[0]);
  await sleep(40);
  t('点击张力图 T1 → 面板切换', $('.tmap__panelhead .chip').textContent.trim() === 'T1',
    $('.tmap__panelhead .chip').textContent.trim());

  /* 20) 已有方法对比表按张力筛选 */
  const rowsAll = $$('.tbl tbody tr').length;
  click($$('#s1 .chipbtn')[1]);
  await sleep(40);
  const rowsF = $$('.tbl tbody tr').length;
  t('按张力筛选对比表', rowsF < rowsAll && rowsF > 0, rowsAll + '→' + rowsF);

  /* 21) 顶栏导航滚动（scrollIntoView 被调用不报错） */
  click($$('.topbar__nav button')[3]);
  await sleep(40);
  t('顶栏导航点击不报错', true);

  return out;
}

const sandboxPatterns = w.PAPER_DATA.patterns;

setTimeout(async () => {
  const staticChecks = run();
  let dyn = [];
  try { dyn = await interact(); }
  catch (e) { errors.push('INTERACT THREW: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0,5).join('\n')); }
  const all = staticChecks.concat(dyn);
  let fail = 0;
  console.log('===== 渲染与交互校验 =====');
  for (const c of all) {
    if (!c.ok) fail++;
    console.log((c.ok ? '  ✔ ' : '  ✘ ') + c.name + (c.extra !== '' && c.extra !== undefined ? '   [' + c.extra + ']' : ''));
  }
  if (warns.length) {
    console.log('\n--- console.warn (' + warns.length + ') ---');
    warns.slice(0, 10).forEach(x => console.log('  ! ' + x.slice(0, 300)));
  }
  if (errors.length) {
    console.log('\n--- console.error / 异常 (' + errors.length + ') ---');
    errors.slice(0, 10).forEach(x => console.log('  X ' + x.slice(0, 600)));
  }
  console.log('\n结果: ' + (all.length - fail) + '/' + all.length + ' 通过, 运行期错误 ' + errors.length + ' 条');
  process.exit(fail === 0 && errors.length === 0 ? 0 : 1);
}, 260);
