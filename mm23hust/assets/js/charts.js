/* =============================================================================
 * charts.js — 纯 SVG 交互图表（无第三方图表库）
 *  - <tension-map>        问题抽象：矛盾张力图
 *  - <adverse-demo>       恶劣环境滑块 → 检测框消失 + F1 下降
 *  - <first-update-chart> Fig.8 首次更新：F1 + 响应时间双轴
 *  - <decomp-chart>       延迟四段分解（Ours vs Ekya）
 *  - <claims-board>       论文明确给出的量化结论
 *  - <fit-curve>          A(e·n) 与 T(e·n) 拟合曲线
 * ========================================================================== */
(function () {
  'use strict';
  var NS = (window.APP = window.APP || {});
  NS.components = NS.components || {};

  function fmt(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }
  NS.fmt = fmt;

  /* ------------------------------------------------------------ 矛盾张力图 */
  NS.components['tension-map'] = {
    name: 'TensionMap',
    data: function () { return { active: 'T3' }; },
    computed: {
      tensions: function () { return window.PAPER_DATA.tensions; },
      cur: function () {
        var a = this.active, list = this.tensions;
        for (var i = 0; i < list.length; i++) if (list[i].id === a) return list[i];
        return list[0];
      },
      bottleneck: function () { return window.PAPER_DATA.bottleneck; }
    },
    methods: {
      x: function (t) { return 60 + t.pos * 680; }
    },
    template: [
      '<div class="tmap">',
      '  <svg class="tmap__svg" viewBox="0 0 800 210" role="img" aria-label="系统矛盾张力图">',
      '    <defs>',
      '      <linearGradient id="tmapBar" x1="0" y1="0" x2="1" y2="0">',
      '        <stop offset="0%" stop-color="#4dd4c4"/><stop offset="35%" stop-color="#7cc4ff"/>',
      '        <stop offset="60%" stop-color="#ffb454"/><stop offset="100%" stop-color="#c79dff"/>',
      '      </linearGradient>',
      '    </defs>',
      '    <text x="60" y="26" class="tmap__cap">端侧算力的硬墙</text>',
      '    <text x="740" y="26" class="tmap__cap tmap__cap--end">边缘资源与时效的硬墙</text>',
      '    <rect x="60" y="96" width="680" height="10" rx="5" fill="url(#tmapBar)" opacity="0.35"/>',
      '    <g v-for="t in tensions" :key="t.id" class="tmap__node"',
      '       :class="{ \'is-active\': t.id === active, \'is-core\': t.core }"',
      '       @click="active = t.id" @mouseenter="active = t.id" tabindex="0" @keyup.enter="active = t.id">',
      '      <line :x1="x(t)" y1="101" :x2="x(t)" :y2="t.core ? 56 : 70" :stroke="t.color" stroke-width="2" opacity="0.7"/>',
      '      <circle :cx="x(t)" cy="101" :r="t.id === active ? 15 : 10" :fill="t.color"',
      '              :opacity="t.id === active ? 1 : 0.55"/>',
      '      <circle v-if="t.core" :cx="x(t)" cy="101" r="21" fill="none" :stroke="t.color"',
      '              stroke-width="1.5" stroke-dasharray="3 4" class="tmap__ring"/>',
      '      <text :x="x(t)" :y="t.core ? 48 : 62" class="tmap__id" :fill="t.color">{{ t.id }}</text>',
      '      <text :x="x(t)" y="132" class="tmap__lbl">{{ t.cn.split(\' ↔ \')[0] }}</text>',
      '      <text :x="x(t)" y="147" class="tmap__lbl tmap__lbl--dim">↔ {{ t.cn.split(\' ↔ \')[1] }}</text>',
      '    </g>',
      '    <text x="400" y="186" class="tmap__hint">点击 / 悬停任一节点，查看这条矛盾的证据与作用</text>',
      '  </svg>',
      '  <div class="tmap__panel" :style="{ borderColor: cur.color }">',
      '    <div class="tmap__panelhead">',
      '      <span class="chip" :style="{ background: cur.color }">{{ cur.id }}</span>',
      '      <code>{{ cur.axis }}</code>',
      '      <span v-if="cur.core" class="chip chip--core">全文主矛盾</span>',
      '    </div>',
      '    <p class="tmap__claim">{{ cur.claim }}</p>',
      '    <dl class="kv">',
      '      <dt>论文证据</dt><dd>{{ cur.evidence }}</dd>',
      '      <dt>它逼出了什么</dt><dd>{{ cur.why }}</dd>',
      '    </dl>',
      '  </div>',
      '  <div class="callout callout--key">',
      '    <h4>{{ bottleneck.headline }}</h4>',
      '    <ul><li v-for="(b,i) in bottleneck.bullets" :key="i">{{ b }}</li></ul>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ------------------------------------------------- 恶劣环境交互演示（Fig.1） */
  NS.components['adverse-demo'] = {
    name: 'AdverseDemo',
    data: function () {
      return {
        sev: 0,
        retrained: false,
        objs: [
          { x: 24, y: 108, w: 52, h: 30, hard: 0.30, label: 'car' },
          { x: 96, y: 100, w: 44, h: 26, hard: 0.55, label: 'car' },
          { x: 158, y: 112, w: 34, h: 22, hard: 0.72, label: 'car' },
          { x: 206, y: 104, w: 28, h: 18, hard: 0.88, label: 'car' },
          { x: 68, y: 148, w: 20, h: 34, hard: 0.46, label: 'person' },
          { x: 178, y: 150, w: 17, h: 30, hard: 0.95, label: 'person' }
        ]
      };
    },
    computed: {
      /* 恶劣程度越高，越多目标掉出检测；重训后把 hard 阈值抬回来 */
      cut: function () { return this.sev / 100 * (this.retrained ? 0.55 : 1.0); },
      detected: function () {
        var c = this.cut, out = [];
        for (var i = 0; i < this.objs.length; i++) if (this.objs[i].hard > c) out.push(this.objs[i]);
        return out;
      },
      f1: function () {
        var base = 0.857, floor = 0.60;
        var lost = 1 - this.detected.length / this.objs.length;
        var v = base - (base - floor) * lost * 1.15;
        if (this.retrained) v = Math.max(v, Math.min(0.845, v + 0.16 * (this.sev / 100)));
        return Math.max(0.52, Math.min(0.86, v));
      },
      snowCount: function () { return Math.round(this.sev / 100 * 70); },
      snow: function () {
        var a = [];
        for (var i = 0; i < 70; i++) {
          a.push({ x: (i * 53 % 260) + (i % 3), y: (i * 37 % 190), r: 0.8 + (i % 4) * 0.5, d: (i % 9) * 0.35 });
        }
        return a;
      }
    },
    methods: {
      conf: function (o) {
        var margin = Math.max(0, o.hard - this.cut);
        return Math.max(0.31, Math.min(0.96, 0.35 + margin * 0.85));
      },
      preset: function (v) { this.sev = v; }
    },
    template: [
      '<div class="advdemo">',
      '  <div class="advdemo__stage">',
      '    <svg viewBox="0 0 260 200" class="advdemo__svg" role="img" aria-label="恶劣环境下的检测结果模拟">',
      '      <defs>',
      '        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">',
      '          <stop offset="0%" stop-color="#4a7ea8"/><stop offset="100%" stop-color="#9dc4dd"/>',
      '        </linearGradient>',
      '      </defs>',
      '      <rect width="260" height="200" fill="url(#sky)"/>',
      '      <rect y="92" width="260" height="108" fill="#4c5560"/>',
      '      <rect y="92" width="260" height="6" fill="#6d7783"/>',
      '      <path d="M0 150 h260" stroke="#e8eef4" stroke-width="2" stroke-dasharray="16 14" opacity="0.7"/>',
      '      <g opacity="0.5">',
      '        <rect x="6" y="46" width="26" height="48" fill="#2f3f52"/>',
      '        <rect x="228" y="38" width="28" height="56" fill="#2f3f52"/>',
      '      </g>',
      /* 车辆 / 行人本体 */
      '      <g v-for="(o,i) in objs" :key="\'o\'+i">',
      '        <rect v-if="o.label===\'car\'" :x="o.x" :y="o.y" :width="o.w" :height="o.h" rx="5" fill="#c9d4de"/>',
      '        <rect v-if="o.label===\'car\'" :x="o.x+6" :y="o.y+3" :width="o.w-12" :height="o.h*0.45" rx="3" fill="#7f8f9e"/>',
      '        <g v-else>',
      '          <circle :cx="o.x+o.w/2" :cy="o.y+5" r="5" fill="#e4d2c2"/>',
      '          <rect :x="o.x+2" :y="o.y+10" :width="o.w-4" :height="o.h-12" rx="4" fill="#d9636f"/>',
      '        </g>',
      '      </g>',
      /* 恶劣天气覆盖层 */
      '      <rect width="260" height="200" fill="#dfe8f2" :opacity="sev/100*0.42"/>',
      '      <rect width="260" height="200" fill="#0b1420" :opacity="sev/100*0.16"/>',
      '      <g class="advdemo__snow">',
      '        <circle v-for="(s,i) in snow.slice(0, snowCount)" :key="\'s\'+i" :cx="s.x" :cy="s.y" :r="s.r"',
      '                fill="#ffffff" :opacity="0.55 + (i%3)*0.15" :style="{ animationDelay: s.d + \'s\' }"/>',
      '      </g>',
      /* 检测框 */
      '      <g v-for="(o,i) in detected" :key="\'d\'+i" class="advdemo__box">',
      '        <rect :x="o.x-3" :y="o.y-3" :width="o.w+6" :height="o.h+6" rx="3" fill="none" stroke="#5cff9d" stroke-width="1.8"/>',
      '        <rect :x="o.x-3" :y="o.y-13" :width="46" height="10" rx="2" fill="#5cff9d" opacity="0.92"/>',
      '        <text :x="o.x-1" :y="o.y-5" class="advdemo__conf">{{ o.label }} {{ conf(o).toFixed(2) }}</text>',
      '      </g>',
      '      <g v-if="sev>10">',
      '        <text x="130" y="22" class="advdemo__miss" v-if="objs.length - detected.length > 0">',
      '          漏检 {{ objs.length - detected.length }} / {{ objs.length }}',
      '        </text>',
      '      </g>',
      '    </svg>',
      '    <div class="advdemo__meter">',
      '      <div class="advdemo__f1" :class="{ good: f1 > 0.8, bad: f1 < 0.68 }">',
      '        <span>F1</span><b>{{ f1.toFixed(3) }}</b>',
      '      </div>',
      '      <div class="advdemo__bar"><i :style="{ width: (f1*100) + \'%\' }"></i></div>',
      '      <p class="advdemo__note">Fig.1 实测：正常 0.857 / 0.800 → 恶劣 0.667 / 0.600</p>',
      '    </div>',
      '  </div>',
      '  <div class="advdemo__ctrl">',
      '    <label class="ctl">',
      '      <span class="ctl__k">环境恶化程度 <b>{{ sev }}%</b></span>',
      '      <input type="range" min="0" max="100" step="1" v-model.number="sev">',
      '    </label>',
      '    <div class="advdemo__presets">',
      '      <button class="btn btn--sm" @click="preset(0)">正常</button>',
      '      <button class="btn btn--sm" @click="preset(45)">暗光（缓变）</button>',
      '      <button class="btn btn--sm" @click="preset(72)">大雪</button>',
      '      <button class="btn btn--sm" @click="preset(95)">暴雨（剧变）</button>',
      '    </div>',
      '    <label class="switch">',
      '      <input type="checkbox" v-model="retrained">',
      '      <span>已在当前场景上重训（边缘补课完成）</span>',
      '    </label>',
      '    <p class="hint">',
      '      注意：目标位置几乎没变，只是成像条件变了 —— 噪声增加、亮度改变、目标模糊，',
      '      三者都直接破坏特征提取。这正是论文 Fig.1 想说的话：不是场景变难了，是模型的输入分布漂移了。',
      '    </p>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* --------------------------------------------- 首次模型更新对比（Fig.8 数据） */
  NS.components['first-update-chart'] = {
    name: 'FirstUpdateChart',
    data: function () { return { hover: -1 }; },
    computed: {
      d: function () { return window.PAPER_DATA.firstUpdate; },
      rows: function () { return this.d.rows; },
      maxT: function () { return 90; }
    },
    methods: {
      barW: function (r) { return (r.f1 / 0.9) * 100; },
      timeW: function (r) { return r.time ? (r.time / this.maxT) * 100 : 0; }
    },
    template: [
      '<div class="fuc">',
      '  <div class="fuc__legend">',
      '    <span><i class="sw sw--f1"></i>F1-Score（同一帧，Fig.8 标注）</span>',
      '    <span><i class="sw sw--t"></i>完成首次模型更新所需时间（§4.2）</span>',
      '  </div>',
      '  <div class="fuc__rows">',
      '    <div v-for="(r,i) in rows" :key="r.name" :class="[\'fuc__row\', \'k-\'+r.kind]"',
      '         @mouseenter="hover=i" @mouseleave="hover=-1">',
      '      <span class="fuc__name">{{ r.name }}</span>',
      '      <div class="fuc__track">',
      '        <div class="fuc__bar" :style="{ width: barW(r) + \'%\' }"><b>{{ r.f1.toFixed(3) }}</b></div>',
      '      </div>',
      '      <div class="fuc__track fuc__track--t">',
      '        <div class="fuc__bar fuc__bar--t" :style="{ width: timeW(r) + \'%\' }">',
      '          <b v-if="r.time">{{ r.time }}s</b>',
      '        </div>',
      '        <span v-if="!r.time" class="fuc__na">未重训</span>',
      '      </div>',
      '      <transition name="fade">',
      '        <p class="fuc__note" v-if="hover===i">{{ r.note }}</p>',
      '      </transition>',
      '    </div>',
      '  </div>',
      '  <p class="src">数据来源：{{ d.note }}</p>',
      '</div>'
    ].join('\n')
  };

  /* ----------------------------------------------- 延迟四段分解（Fig.13 数据） */
  NS.components['decomp-chart'] = {
    name: 'DecompChart',
    data: function () { return { mode: 'pct', focus: null }; },
    computed: {
      d: function () { return window.PAPER_DATA.decomposition; },
      parts: function () {
        var self = this, total = self.d.oursTotalSec;
        return this.d.parts.map(function (p) {
          return {
            key: p.key, label: p.label, color: p.color, pct: p.pct,
            sec: fmt(total * p.pct / 100, 1)
          };
        });
      }
    },
    template: [
      '<div class="decomp">',
      '  <div class="decomp__tabs">',
      '    <button :class="[\'tab\', mode===\'pct\' ? \'is-on\' : \'\']" @click="mode=\'pct\'">按占比（论文原文）</button>',
      '    <button :class="[\'tab\', mode===\'sec\' ? \'is-on\' : \'\']" @click="mode=\'sec\'">按秒数（反推示意）</button>',
      '  </div>',
      '  <div class="decomp__row">',
      '    <span class="decomp__who">Ours</span>',
      '    <div class="decomp__stack">',
      '      <div v-for="p in parts" :key="p.key" class="decomp__seg"',
      '           :style="{ width: p.pct + \'%\', background: p.color }"',
      '           @mouseenter="focus=p.key" @mouseleave="focus=null"',
      '           :class="{ \'is-focus\': focus===p.key }">',
      '        <span v-if="p.pct > 8">{{ mode===\'pct\' ? p.pct + \'%\' : p.sec + \'s\' }}</span>',
      '      </div>',
      '    </div>',
      '    <span class="decomp__tot">{{ mode===\'pct\' ? \'100%\' : d.oursTotalSec + \'s\' }}</span>',
      '  </div>',
      '  <div class="decomp__row decomp__row--cmp">',
      '    <span class="decomp__who">Ekya</span>',
      '    <div class="decomp__stack">',
      '      <div class="decomp__seg decomp__seg--profile" :style="{ width: d.ekyaProfilePct + \'%\' }">',
      '        <span>micro-profiler {{ d.ekyaProfilePct }}%</span>',
      '      </div>',
      '      <div class="decomp__seg decomp__seg--rest" :style="{ width: (100 - d.ekyaProfilePct) + \'%\' }">',
      '        <span>其余流程</span>',
      '      </div>',
      '    </div>',
      '    <span class="decomp__tot">≈{{ d.ekyaTotalSec }}s</span>',
      '  </div>',
      '  <ul class="decomp__key">',
      '    <li v-for="p in parts" :key="p.key" :class="{ \'is-focus\': focus===p.key }"',
      '        @mouseenter="focus=p.key" @mouseleave="focus=null">',
      '      <i :style="{ background: p.color }"></i>{{ p.label }}',
      '      <b>{{ p.pct }}%</b><em>≈{{ p.sec }}s</em>',
      '    </li>',
      '  </ul>',
      '  <div class="callout callout--warn">',
      '    <b>这张表的方法论含义</b>',
      '    <p>三个"非训练"环节合起来只占 13.8%，说明作者把该省的都省了；而 Ekya 的 micro-profiler',
      '       单独吃掉 27%（约 25s）—— 那是<strong>为了做决策而付出的测量成本</strong>。',
      '       普通论文根本不会把这一项算进端到端延迟；本文不但算了，还把它搬到离线消灭掉。</p>',
      '  </div>',
      '  <p class="src">数据来源：{{ d.note }}</p>',
      '</div>'
    ].join('\n')
  };

  /* ------------------------------------------------------------ 量化结论墙 */
  NS.components['claims-board'] = {
    name: 'ClaimsBoard',
    computed: { claims: function () { return window.PAPER_DATA.claims; } },
    template: [
      '<div class="claims">',
      '  <div v-for="(c,i) in claims" :key="i" :class="[\'claims__card\', \'d-\'+c.dir]">',
      '    <div class="claims__v"><b>{{ c.value }}</b><span>{{ c.unit }}</span>',
      '      <i class="claims__arrow">{{ c.dir === \'up\' ? \'▲\' : \'▼\' }}</i>',
      '    </div>',
      '    <p class="claims__l">{{ c.label }}</p>',
      '    <p class="claims__c" v-if="c.cmp">{{ c.cmp }}</p>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* --------------------------------------------------- 拟合曲线（Fig.5 / Fig.7） */
  NS.components['fit-curve'] = {
    name: 'FitCurve',
    data: function () { return { x: 0.35, teacher: 'm' }; },
    computed: {
      K: function () { return window.PAPER_DATA.simConst; },
      teachers: function () { return this.K.teachers; },
      tObj: function () {
        var t = this.teacher, l = this.teachers;
        for (var i = 0; i < l.length; i++) if (l[i].key === t) return l[i];
        return l[0];
      },
      accPath: function () {
        var f = this.K.accFit, pts = [];
        for (var i = 0; i <= 100; i++) {
          var x = i / 100;
          var a = f.a - f.b * Math.exp(-f.c * x);
          pts.push((40 + x * 300).toFixed(1) + ',' + (150 - (a - 0.55) / 0.42 * 110).toFixed(1));
        }
        return 'M' + pts.join(' L');
      },
      latPath: function () {
        var s = this.tObj.slope, pts = [];
        for (var i = 0; i <= 100; i++) {
          var x = i / 100;
          pts.push((40 + x * 300).toFixed(1) + ',' + (150 - Math.min(1, x * s / 110) * 110).toFixed(1));
        }
        return 'M' + pts.join(' L');
      },
      accAt: function () {
        var f = this.K.accFit;
        return f.a - f.b * Math.exp(-f.c * this.x) + (this.tObj.cap || 0);
      },
      latAt: function () { return this.x * this.tObj.slope; },
      markX: function () { return 40 + this.x * 300; }
    },
    template: [
      '<div class="fitc">',
      '  <div class="fitc__grid">',
      '    <div class="fitc__panel">',
      '      <h5>精度 A 对 e·n：饱和指数（Fig.7 原式）</h5>',
      '      <svg viewBox="0 0 360 175" class="fitc__svg">',
      '        <g class="ax">',
      '          <line x1="40" y1="150" x2="345" y2="150"/><line x1="40" y1="150" x2="40" y2="28"/>',
      '          <text x="192" y="170">归一化 e·n（总计算量）</text>',
      '          <text x="12" y="34" class="rot">A</text>',
      '        </g>',
      '        <path :d="accPath" class="fitc__line fitc__line--acc"/>',
      '        <line :x1="markX" y1="150" :x2="markX" y2="28" class="fitc__mark"/>',
      '        <circle :cx="markX" :cy="150 - (accAt - 0.55)/0.42*110" r="5" class="fitc__dot fitc__dot--acc"/>',
      '        <text x="180" y="46" class="fitc__eq">A = 0.9194 − 0.3218·e^(−9.9692·e·n)</text>',
      '      </svg>',
      '      <p class="fitc__val">A ≈ <b>{{ accAt.toFixed(4) }}</b></p>',
      '    </div>',
      '    <div class="fitc__panel">',
      '      <h5>训练延迟对 e·n：线性（Fig.5，R² = 0.979）</h5>',
      '      <svg viewBox="0 0 360 175" class="fitc__svg">',
      '        <g class="ax">',
      '          <line x1="40" y1="150" x2="345" y2="150"/><line x1="40" y1="150" x2="40" y2="28"/>',
      '          <text x="192" y="170">归一化 e·n（总计算量）</text>',
      '          <text x="12" y="34" class="rot">T₃</text>',
      '        </g>',
      '        <path :d="latPath" class="fitc__line fitc__line--lat"/>',
      '        <line :x1="markX" y1="150" :x2="markX" y2="28" class="fitc__mark"/>',
      '        <circle :cx="markX" :cy="150 - Math.min(1, latAt/110)*110" r="5" class="fitc__dot fitc__dot--lat"/>',
      '        <text x="170" y="46" class="fitc__eq">T₃ = e·n · t(m)，斜率随教师变化</text>',
      '      </svg>',
      '      <p class="fitc__val">训练耗时 ≈ <b>{{ latAt.toFixed(1) }}s</b></p>',
      '    </div>',
      '  </div>',
      '  <div class="fitc__ctrl">',
      '    <label class="ctl">',
      '      <span class="ctl__k">归一化计算量 e·n = <b>{{ x.toFixed(2) }}</b></span>',
      '      <input type="range" min="0.02" max="1" step="0.01" v-model.number="x">',
      '    </label>',
      '    <div class="seg">',
      '      <button v-for="t in teachers" :key="t.key" :class="[\'seg__b\', teacher===t.key ? \'is-on\':\'\']"',
      '              @click="teacher=t.key">{{ t.name }}</button>',
      '    </div>',
      '  </div>',
      '  <div class="callout">',
      '    <b>降维为什么是这篇论文最漂亮的一步</b>',
      '    <p>在 (e, n, m) 三维空间里，精度和延迟都是黑箱。而"训练一共做了多少计算"才是真正驱动它们的物理量 ——',
      '       把 e 和 n 乘起来之后，延迟变成一条直线（R²=0.979），精度变成一条饱和指数曲线。',
      '       两个"不可观测"的量，同时变成了"离线拟合一次就够"的一维函数。</p>',
      '    <p class="src">左图公式为论文原文；右图斜率 t(m) 的具体数值为演示取值（论文只给出线性关系与拟合优度）。</p>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
