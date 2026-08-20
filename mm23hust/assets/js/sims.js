/* =============================================================================
 * sims.js — 三个可交互模拟器，把论文的三个模块"跑"起来
 *  - <keyframe-sim>  Algorithm 1：两步关键帧提取（置信度过滤 → 帧差 top-C）
 *  - <trigger-sim>   Trigger Controller：μ_{i<j} − σ_{i<j} > a_j 的控制图
 *  - <retrain-sim>   Retraining Manager：U = A − ηT，含 Algorithm 2 模拟退火搜索
 * ========================================================================== */
(function () {
  'use strict';
  var NS = (window.APP = window.APP || {});
  NS.components = NS.components || {};

  function rnd(seed) {           // 可复现的伪随机
    var s = seed || 1;
    return function () { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  }
  function fmt(v, d) { var p = Math.pow(10, d || 0); return Math.round(v * p) / p; }

  /* ==================================================== 1. Key Frame Extractor */
  NS.components['keyframe-sim'] = {
    name: 'KeyframeSim',
    data: function () {
      return {
        beta: 0.4,
        bw: 4,            // Mbps（演示区间）
        seed: 7,
        step: 2,          // 1=只看第一步  2=两步都看
        order: 'right'    // right = 先过滤后算差； wrong = 先算差后过滤
      };
    },
    computed: {
      K: function () { return window.PAPER_DATA.simConst; },
      frames: function () {
        var r = rnd(this.seed), out = [];
        for (var i = 0; i < 24; i++) {
          /* 前 8 帧环境正常（低置信占比低），第 9 帧起环境恶化 */
          var base = i < 8 ? 0.10 : (i < 12 ? 0.30 : 0.52);
          var L = Math.min(0.97, Math.max(0.02, base + r() * 0.42));
          var diff = Math.max(0.03, Math.min(1, (i < 8 ? 0.18 : 0.34) + r() * 0.62));
          out.push({ i: i, t: fmt(i * 10 / 24, 2), L: fmt(L, 2), diff: fmt(diff, 2) });
        }
        return out;
      },
      C: function () {   /* 带宽允许传输的最大帧数 */
        return Math.max(1, Math.floor(this.bw * 10 / this.K.d0Mb));
      },
      lowConf: function () {
        var b = this.beta;
        return this.frames.filter(function (f) { return f.L > b; });
      },
      selected: function () {
        if (this.step === 1) return this.lowConf;
        var pool = this.order === 'right' ? this.lowConf.slice() : this.frames.slice();
        if (this.order === 'wrong') {
          pool.sort(function (a, b) { return b.diff - a.diff; });
          pool = pool.slice(0, this.C);
          var b2 = this.beta;
          return pool.filter(function (f) { return f.L > b2; });
        }
        if (pool.length <= this.C) return pool;
        pool.sort(function (a, b) { return b.diff - a.diff; });
        return pool.slice(0, this.C);
      },
      selectedIds: function () {
        var m = {}; this.selected.forEach(function (f) { m[f.i] = true; }); return m;
      },
      lowConfIds: function () {
        var m = {}; this.lowConf.forEach(function (f) { m[f.i] = true; }); return m;
      },
      /* 计算成本：帧差需要真算像素，置信度是免费的 */
      cost: function () {
        var diffCalls = this.order === 'right' ? this.lowConf.length : this.frames.length;
        return {
          confCalls: 0,
          diffCalls: diffCalls,
          saved: this.frames.length - diffCalls,
          savedPct: fmt((1 - diffCalls / this.frames.length) * 100, 0)
        };
      },
      urgency: function () { return fmt(this.lowConf.length / this.frames.length, 3); },
      bwUsed: function () { return fmt(this.selected.length * this.K.d0Mb, 1); },
      bwCap: function () { return fmt(this.bw * 10, 1); }
    },
    methods: {
      cls: function (f) {
        if (this.selectedIds[f.i]) return 'is-sent';
        if (this.lowConfIds[f.i]) return 'is-low';
        return 'is-skip';
      },
      reroll: function () { this.seed = Math.floor(Math.random() * 9000) + 11; }
    },
    template: [
      '<div class="sim sim--kf">',
      '  <div class="sim__head">',
      '    <h4>模拟器 ① · Key Frame Extractor（Algorithm 1）</h4>',
      '    <p>一个 10 秒窗口（此处抽样为 24 帧）。<b>Step 1</b> 按低置信目标占比 L<sub>i</sub> &gt; β 过滤；',
      '       <b>Step 2</b> 在过滤后的子集上算帧差，取 top-C，C 由当前上行带宽决定。</p>',
      '  </div>',
      '  <div class="sim__ctrls">',
      '    <label class="ctl">',
      '      <span class="ctl__k">β 过滤阈值 = <b>{{ beta.toFixed(2) }}</b><em>（论文取 0.4）</em></span>',
      '      <input type="range" min="0.05" max="0.9" step="0.05" v-model.number="beta">',
      '    </label>',
      '    <label class="ctl">',
      '      <span class="ctl__k">上行带宽 B<sub>up</sub> = <b>{{ bw }} Mbps</b> → C = <b>{{ C }}</b> 帧</span>',
      '      <input type="range" min="1" max="9" step="0.5" v-model.number="bw">',
      '    </label>',
      '    <div class="sim__btns">',
      '      <div class="seg">',
      '        <button :class="[\'seg__b\', step===1?\'is-on\':\'\']" @click="step=1">只看 Step 1</button>',
      '        <button :class="[\'seg__b\', step===2?\'is-on\':\'\']" @click="step=2">Step 1 + 2</button>',
      '      </div>',
      '      <button class="btn btn--sm" @click="reroll">↻ 换一段视频</button>',
      '    </div>',
      '  </div>',
      '  <div class="kf__strip">',
      '    <div v-for="f in frames" :key="f.i" :class="[\'kf__frame\', cls(f)]" :title="\'第\'+(f.i+1)+\'帧\'">',
      '      <span class="kf__bar" :style="{ height: (f.L*100) + \'%\' }"></span>',
      '      <span class="kf__diff" :style="{ height: (f.diff*46) + \'%\' }"></span>',
      '      <em class="kf__idx">{{ f.i+1 }}</em>',
      '      <span class="kf__tip">L={{ f.L }} · 帧差={{ f.diff }}</span>',
      '    </div>',
      '    <div class="kf__beta" :style="{ bottom: (beta*100) + \'%\' }"><span>β = {{ beta.toFixed(2) }}</span></div>',
      '  </div>',
      '  <div class="kf__axis">',
      '    <span><i class="sw sw--low"></i>低置信占比 L<sub>i</sub>（免费，推理副产品）</span>',
      '    <span><i class="sw sw--diff"></i>帧差（要真算像素）</span>',
      '    <span><i class="sw sw--sent"></i>最终上传</span>',
      '  </div>',
      '  <div class="kf__stats">',
      '    <div class="stat"><span>Step 1 命中</span><b>{{ lowConf.length }}</b><em>/ {{ frames.length }} 帧</em></div>',
      '    <div class="stat"><span>最终上传</span><b>{{ selected.length }}</b><em>≤ C = {{ C }}</em></div>',
      '    <div class="stat"><span>带宽占用</span><b>{{ bwUsed }}</b><em>/ {{ bwCap }} Mb</em></div>',
      '    <div class="stat stat--hl"><span>紧急度 η = |S̃|/|F|</span><b>{{ urgency }}</b><em>直接喂给效用函数</em></div>',
      '  </div>',
      '  <div class="kf__order">',
      '    <div class="seg seg--wide">',
      '      <button :class="[\'seg__b\', order===\'right\'?\'is-on\':\'\']" @click="order=\'right\'">先过滤 → 再算帧差（论文做法）</button>',
      '      <button :class="[\'seg__b\', order===\'wrong\'?\'is-on\':\'\']" @click="order=\'wrong\'">先算帧差 → 再过滤（反过来）</button>',
      '    </div>',
      '    <div class="kf__cost" :class="{ bad: order===\'wrong\' }">',
      '      <p>本窗需要执行帧差计算的帧数：<b>{{ cost.diffCalls }}</b> / {{ frames.length }}',
      '        <span v-if="cost.savedPct > 0">（省掉 {{ cost.savedPct }}% 的像素级计算）</span></p>',
      '      <p class="kf__why">',
      '        <template v-if="order===\'right\'">',
      '          置信度是推理已经算出来的赠品，所以先用它把候选集从 |F| 缩到 |S|，',
      '          再让"要花钱"的帧差只在 S 上跑 —— 论文原话是"计算量可以大幅削减"。',
      '        </template>',
      '        <template v-else>',
      '          反过来就必须对整窗每一帧都算帧差，端侧算力预算直接被吃掉；',
      '          而且按帧差选出的 top-C 里可能大量是"模型本来就预测得很好"的帧，对重训毫无梯度贡献。',
      '        </template>',
      '      </p>',
      '    </div>',
      '  </div>',
      '  <p class="src">参数形式取自 Algorithm 1；β=0.4、窗口 10s 为论文取值，单帧数据量与 24 帧抽样为演示取值。</p>',
      '</div>'
    ].join('\n')
  };

  /* ====================================================== 2. Trigger Controller */
  NS.components['trigger-sim'] = {
    name: 'TriggerSim',
    data: function () {
      return {
        acc: [0.82, 0.80, 0.83, 0.81, 0.84, 0.79, 0.82, 0.71],
        gamma: 0.62,
        jitThr: 0.75,
        ekyaPeriod: 4,
        compare: true
      };
    },
    computed: {
      j: function () { return this.acc.length - 1; },
      prev: function () { return this.acc.slice(0, this.acc.length - 1); },
      aj: function () { return this.acc[this.acc.length - 1]; },
      weights: function () {
        var n = this.prev.length, g = this.gamma, w = [], sum = 0, i;
        for (i = 0; i < n; i++) { var v = Math.pow(g, n - 1 - i); w.push(v); sum += v; }
        for (i = 0; i < n; i++) w[i] = w[i] / sum;
        return w;
      },
      mu: function () {
        var w = this.weights, p = this.prev, s = 0;
        for (var i = 0; i < p.length; i++) s += w[i] * p[i];
        return s;
      },
      sigma: function () {
        var p = this.prev, n = p.length;
        if (n < 2) return 0;
        var m = p.reduce(function (a, b) { return a + b; }, 0) / n, s = 0;
        for (var i = 0; i < n; i++) s += (p[i] - m) * (p[i] - m);
        return Math.sqrt(s / n);
      },
      band: function () { return this.mu - this.sigma; },
      fire: function () { return this.band > this.aj; },
      jitFire: function () { return this.aj < this.jitThr; },
      ekyaFire: function () { return (this.acc.length % this.ekyaPeriod) === 0; },
      /* 定量指标：本方案 vs 固定阈值 */
      margin: function () { return fmt((this.band - this.aj) * 1000, 1); }
    },
    methods: {
      y: function (v) { return 150 - (v - 0.55) / 0.40 * 120; },
      x: function (i) { return 46 + i * (300 / Math.max(1, this.acc.length - 1)); },
      addWindow: function () {
        if (this.acc.length >= 12) this.acc.shift();
        this.acc.push(this.aj);
      },
      scenario: function (kind) {
        /* 四个场景都已校核：在 γ ∈ [0.2, 0.98] 全区间内结论稳定 */
        if (kind === 'stable') this.acc = [0.82, 0.80, 0.83, 0.81, 0.84, 0.79, 0.82, 0.81];
        if (kind === 'noisy') this.acc = [0.73, 0.86, 0.72, 0.87, 0.71, 0.88, 0.72, 0.74];
        if (kind === 'drop') this.acc = [0.82, 0.80, 0.83, 0.81, 0.84, 0.79, 0.82, 0.65];
        if (kind === 'slow') this.acc = [0.90, 0.89, 0.88, 0.86, 0.85, 0.83, 0.82, 0.79];
      },
      pathOf: function () {
        var self = this;
        return 'M' + this.acc.map(function (v, i) { return self.x(i) + ',' + self.y(v); }).join(' L');
      }
    },
    template: [
      '<div class="sim sim--tg">',
      '  <div class="sim__head">',
      '    <h4>模拟器 ② · Trigger Controller（自适应触发）</h4>',
      '    <p>把"环境变了吗"翻译成"这条精度序列越界了吗"。',
      '       历史窗口按指数衰减加权得到 μ<sub>i&lt;j</sub>，历史标准差 σ<sub>i&lt;j</sub> 划出正常波动带；',
      '       仅当 <code>μ − σ &gt; a_j</code> 时触发重训。</p>',
      '  </div>',
      '  <svg viewBox="0 0 400 180" class="tg__svg" role="img" aria-label="触发控制图">',
      '    <g class="ax">',
      '      <line x1="46" y1="150" x2="360" y2="150"/><line x1="46" y1="150" x2="46" y2="24"/>',
      '      <text x="203" y="172">窗口序号（每窗 10 秒）</text>',
      '    </g>',
      '    <g class="tg__grid">',
      '      <line v-for="g in [0.6,0.7,0.8,0.9]" :key="g" x1="46" :y1="y(g)" x2="360" :y2="y(g)"/>',
      '      <text v-for="g in [0.6,0.7,0.8,0.9]" :key="\'t\'+g" x="40" :y="y(g)+4">{{ g.toFixed(1) }}</text>',
      '    </g>',
      /* 正常波动带 */
      '    <rect x="46" :y="y(mu + sigma)" width="314" :height="Math.max(2, y(mu - sigma) - y(mu + sigma))"',
      '          class="tg__band"/>',
      '    <line x1="46" :y1="y(mu)" x2="360" :y2="y(mu)" class="tg__mu"/>',
      '    <line x1="46" :y1="y(band)" x2="360" :y2="y(band)" class="tg__thr"/>',
      '    <text x="364" :y="y(mu)+4" class="tg__lbl tg__lbl--mu">μ</text>',
      '    <text x="364" :y="y(band)+4" class="tg__lbl tg__lbl--thr">μ−σ</text>',
      '    <path :d="pathOf()" class="tg__line"/>',
      '    <g v-for="(v,i) in acc" :key="i">',
      '      <circle :cx="x(i)" :cy="y(v)" :r="i===j ? 7 : 4.5"',
      '              :class="[\'tg__pt\', i===j ? (fire ? \'is-fire\' : \'is-ok\') : \'\']"/>',
      '      <text v-if="i===j" :x="x(i)" :y="y(v)-13" class="tg__cur">a_j = {{ v.toFixed(2) }}</text>',
      '    </g>',
      '    <g v-for="(w,i) in weights" :key="\'w\'+i" class="tg__wbar">',
      '      <rect :x="x(i)-5" :y="158" width="10" :height="Math.max(1, w*26)" />',
      '    </g>',
      '  </svg>',
      '  <div class="tg__verdict" :class="fire ? \'is-fire\' : \'is-hold\'">',
      '    <b>{{ fire ? \'⚡ 触发重训\' : \'⏸ 不触发，数据进 Buffer\' }}</b>',
      '    <span>μ − σ = {{ band.toFixed(4) }} <i>{{ fire ? \'>\' : \'≤\' }}</i> a_j = {{ aj.toFixed(4) }}</span>',
      '    <em>{{ fire ? (\'越界幅度 \' + margin + \'‰\') : \'仍在自身正常波动范围内\' }}</em>',
      '  </div>',
      '  <div class="tg__ctrls">',
      '    <label class="ctl">',
      '      <span class="ctl__k">指数衰减系数 γ = <b>{{ gamma.toFixed(2) }}</b><em>（越小 = 越只看最近）</em></span>',
      '      <input type="range" min="0.2" max="0.98" step="0.02" v-model.number="gamma">',
      '    </label>',
      '    <label class="ctl">',
      '      <span class="ctl__k">当前窗口精度 a_j = <b>{{ aj.toFixed(2) }}</b></span>',
      '      <input type="range" min="0.56" max="0.94" step="0.01"',
      '             :value="aj" @input="acc.splice(acc.length-1,1,parseFloat($event.target.value))">',
      '    </label>',
      '    <div class="sim__btns">',
      '      <button class="btn btn--sm" @click="scenario(\'stable\')">平稳</button>',
      '      <button class="btn btn--sm" @click="scenario(\'noisy\')">高抖动</button>',
      '      <button class="btn btn--sm" @click="scenario(\'drop\')">突降（大雪）</button>',
      '      <button class="btn btn--sm" @click="scenario(\'slow\')">缓降（暗光）</button>',
      '      <button class="btn btn--ghost btn--sm" @click="addWindow">+ 推进一个窗口</button>',
      '    </div>',
      '  </div>',
      '  <div class="tg__cmp" v-if="compare">',
      '    <div class="tg__cmpcard" :class="fire ? \'ok\' : \'\'">',
      '      <h6>本文：自适应阈值 μ−σ</h6>',
      '      <p class="tg__state">{{ fire ? \'触发\' : \'不触发\' }}</p>',
      '      <p>阈值随这台摄像头自身的历史水平与抖动幅度移动，因此在"高抖动"场景里不会误报，',
      '         在"突降"场景里又能立刻响应。</p>',
      '    </div>',
      '    <div class="tg__cmpcard">',
      '      <h6>JIT：固定阈值 {{ jitThr.toFixed(2) }}</h6>',
      '      <p class="tg__state">{{ jitFire ? \'触发\' : \'不触发\' }}</p>',
      '      <p>切到「高抖动」：精度在 0.72–0.88 之间正常摆动，本文判定"仍在自身波动带内"而不动，固定阈值却被击穿 → 无谓重训。',
      '         再切到「缓降」：本文已经触发，而固定阈值因为 a_j 还在 0.75 以上仍在等待 → 响应迟到。',
      '        <label class="ctl ctl--inline"><input type="range" min="0.6" max="0.9" step="0.01" v-model.number="jitThr"></label>',
      '      </p>',
      '    </div>',
      '    <div class="tg__cmpcard">',
      '      <h6>Ekya：固定周期（每 {{ ekyaPeriod }} 窗）</h6>',
      '      <p class="tg__state">{{ ekyaFire ? \'触发\' : \'不触发\' }}</p>',
      '      <p>完全不看内容。周期长 → 突变响应慢；周期短 → 无谓重训，浪费共享的边缘 GPU。',
      '         论文实测：Low Light 下 Ekya 的重训次数接近本文的两倍。</p>',
      '    </div>',
      '  </div>',
      '  <p class="src">触发判据 μ−σ&gt;a_j 与指数衰减加权来自论文 §3.3；γ、JIT 阈值、Ekya 周期为演示取值。</p>',
      '</div>'
    ].join('\n')
  };

  /* ===================================================== 3. Retraining Manager */
  NS.components['retrain-sim'] = {
    name: 'RetrainSim',
    data: function () {
      return {
        e: 40, n: 180, teacher: 'm',
        eta: 0.42, bwUp: 50, bwDown: 50, sTrig: 60,
        trail: [], best: null, bf: null, running: false, iter: 0, fails: 0,
        timer: null, log: []
      };
    },
    computed: {
      K: function () { return window.PAPER_DATA.simConst; },
      teachers: function () { return this.K.teachers; },
      tObj: function () {
        var k = this.teacher, l = this.teachers;
        for (var i = 0; i < l.length; i++) if (l[i].key === k) return l[i];
        return l[1];
      },
      acc: function () { return this.accOf(this.e, this.n, this.teacher); },
      parts: function () { return this.partsOf(this.e, this.n, this.teacher); },
      T: function () { return this.parts.total; },
      U: function () { return this.acc - this.eta * this.T / 100; },
      feasible: function () { return this.T <= this.K.tau0; },
      pctOf: function () {
        var p = this.parts, t = p.total || 1;
        return {
          transmit: fmt(p.transmit / t * 100, 1), label: fmt(p.label / t * 100, 1),
          train: fmt(p.train / t * 100, 1), update: fmt(p.update / t * 100, 1)
        };
      }
    },
    methods: {
      accOf: function (e, n, tk) {
        var f = this.K.accFit, x = (e * n) / (this.K.eMax * this.K.nMax);
        var t = null, l = this.teachers;
        for (var i = 0; i < l.length; i++) if (l[i].key === tk) t = l[i];
        return f.a - f.b * Math.exp(-f.c * x) + (t ? t.cap : 0);
      },
      partsOf: function (e, n, tk) {
        var K = this.K, t = null, l = this.teachers, i;
        for (i = 0; i < l.length; i++) if (l[i].key === tk) t = l[i];
        var x = (e * n) / (K.eMax * K.nMax);
        var transmit = this.sTrig * K.d0Mb / Math.max(1, this.bwUp);
        var label = this.sTrig * K.t0Sec;
        var train = x * (t ? t.slope : 72);
        var update = K.M0Mb / Math.max(1, this.bwDown);
        return {
          transmit: transmit, label: label, train: train, update: update,
          total: transmit + label + train + update
        };
      },
      utilOf: function (e, n, tk) {
        var T = this.partsOf(e, n, tk).total;
        if (T > this.K.tau0) return -1e9;
        return this.accOf(e, n, tk) - this.eta * T / 100;
      },
      /* --- Algorithm 2：Metropolis 扰动搜索 --- */
      runSA: function () {
        var self = this;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        var K = this.K;
        this.trail = []; this.log = []; this.iter = 0; this.fails = 0; this.running = true;
        var cur = { e: K.eMin, n: K.nMin, m: 's' };
        var curU = this.utilOf(cur.e, cur.n, cur.m);
        this.best = { e: cur.e, n: cur.n, m: cur.m, U: curU };
        var maxIter = 90, maxFail = 22;
        this.timer = setInterval(function () {
          if (self.iter >= maxIter || self.fails >= maxFail) {
            clearInterval(self.timer); self.timer = null; self.running = false;
            self.e = self.best.e; self.n = self.best.n; self.teacher = self.best.m;
            self.log.push({ i: self.iter, txt: '早停：连续 ' + self.fails + ' 次未接受新解，返回当前最优。' });
            return;
          }
          self.iter += 1;
          /* Eq.(9)(10)(11)：在约束内做有界随机扰动 */
          var de = Math.round((Math.random() * 2 - 1) * 26);
          var dn = Math.round((Math.random() * 2 - 1) * 90);
          var cand = {
            e: Math.max(K.eMin, Math.min(K.eMax, self.best.e + de)),
            n: Math.max(K.nMin, Math.min(K.nMax, self.best.n + dn)),
            m: self.teachers[Math.floor(Math.random() * self.teachers.length)].key
          };
          var cU = self.utilOf(cand.e, cand.n, cand.m);
          var T = self.partsOf(cand.e, cand.n, cand.m).total;
          self.trail.push({ T: T, A: self.accOf(cand.e, cand.n, cand.m), ok: T <= K.tau0 });
          if (self.trail.length > 60) self.trail.shift();
          var df = cU - self.best.U;
          var accept = df > 0 || (cU > -1e8 && Math.exp(df / Math.abs(cU || 1)) > Math.random());
          if (accept) {
            self.best = { e: cand.e, n: cand.n, m: cand.m, U: cU };
            self.fails = 0;
            self.log.push({ i: self.iter, txt: '接受 (e=' + cand.e + ', n=' + cand.n + ', m=' + cand.m + ') → U=' + fmt(cU, 4) + (df > 0 ? '  ↑更优' : '  ~Metropolis 允许暂时变差') });
          } else {
            self.fails += 1;
          }
          if (self.log.length > 7) self.log.shift();
        }, 55);
      },
      bruteForce: function () {
        var K = this.K, bestU = -1e9, best = null, l = this.teachers;
        for (var ti = 0; ti < l.length; ti++) {
          for (var e = K.eMin; e <= K.eMax; e += 5) {
            for (var n = K.nMin; n <= K.nMax; n += 10) {
              var u = this.utilOf(e, n, l[ti].key);
              if (u > bestU) { bestU = u; best = { e: e, n: n, m: l[ti].key, U: u }; }
            }
          }
        }
        this.bf = best;
        this.e = best.e; this.n = best.n; this.teacher = best.m;
        return best;
      },
      stop: function () { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.running = false; },
      px: function (T) { return 46 + Math.min(1, T / 90) * 300; },
      py: function (A) { return 148 - (A - 0.55) / 0.40 * 118; }
    },
    beforeUnmount: function () { this.stop(); },
    template: [
      '<div class="sim sim--rt">',
      '  <div class="sim__head">',
      '    <h4>模拟器 ③ · Retraining Manager（U = A − η·T，Algorithm 2）</h4>',
      '    <p>配置 <code>c = (e, n, m)</code>。精度用 Fig.7 的饱和指数式预测，延迟按论文四段建模，',
      '       再用带 Metropolis 准则的扰动搜索求次优解 —— 论文实测约 20ms。</p>',
      '  </div>',
      '  <div class="rt__grid">',
      '    <div class="rt__left">',
      '      <label class="ctl">',
      '        <span class="ctl__k">epoch 数 e = <b>{{ e }}</b><em>（5–100）</em></span>',
      '        <input type="range" min="5" max="100" step="1" v-model.number="e">',
      '      </label>',
      '      <label class="ctl">',
      '        <span class="ctl__k">帧数 n = <b>{{ n }}</b><em>（50–320）</em></span>',
      '        <input type="range" min="50" max="320" step="5" v-model.number="n">',
      '      </label>',
      '      <div class="ctl">',
      '        <span class="ctl__k">教师模型 m<em>（同时改变精度上限与延迟斜率）</em></span>',
      '        <div class="seg">',
      '          <button v-for="t in teachers" :key="t.key" :class="[\'seg__b\', teacher===t.key?\'is-on\':\'\']"',
      '                  @click="teacher=t.key" :title="t.desc">{{ t.name }}</button>',
      '        </div>',
      '      </div>',
      '      <label class="ctl">',
      '        <span class="ctl__k">紧急度 η = <b>{{ eta.toFixed(2) }}</b><em>（来自模拟器①的低置信帧比例）</em></span>',
      '        <input type="range" min="0.02" max="0.95" step="0.01" v-model.number="eta">',
      '      </label>',
      '      <div class="rt__row2">',
      '        <label class="ctl">',
      '          <span class="ctl__k">B<sub>up</sub> <b>{{ bwUp }}</b> Mbps</span>',
      '          <input type="range" min="10" max="100" step="5" v-model.number="bwUp">',
      '        </label>',
      '        <label class="ctl">',
      '          <span class="ctl__k">B<sub>down</sub> <b>{{ bwDown }}</b> Mbps</span>',
      '          <input type="range" min="10" max="100" step="5" v-model.number="bwDown">',
      '        </label>',
      '      </div>',
      '      <div class="sim__btns">',
      '        <button class="btn btn--primary btn--sm" @click="runSA" :disabled="running">',
      '          {{ running ? \'搜索中… iter \' + iter : \'▶ 运行 Algorithm 2\' }}</button>',
      '        <button class="btn btn--sm" @click="stop" v-if="running">停止</button>',
      '        <button class="btn btn--ghost btn--sm" @click="bruteForce">穷举最优（对照）</button>',
      '      </div>',
      '      <ul class="rt__log">',
      '        <li v-for="(l,i) in log" :key="i"><em>#{{ l.i }}</em>{{ l.txt }}</li>',
      '      </ul>',
      '      <p class="rt__bf" v-if="bf">穷举最优（步长 e:5 / n:10）：e={{ bf.e }}, n={{ bf.n }}, m={{ bf.m }}，U={{ bf.U.toFixed(4) }}',
      '        —— Algorithm 2 用约 20ms 拿到的次优解与它的差距通常在千分位；而一个迟到的最优解，对应的模型已经过期了。</p>',
      '    </div>',
      '    <div class="rt__right">',
      '      <svg viewBox="0 0 400 176" class="rt__svg" role="img" aria-label="精度-延迟权衡平面">',
      '        <g class="ax">',
      '          <line x1="46" y1="148" x2="366" y2="148"/><line x1="46" y1="148" x2="46" y2="20"/>',
      '          <text x="206" y="170">总延迟 T（秒）</text>',
      '        </g>',
      '        <rect :x="px(K.tau0)" y="20" :width="Math.max(0, 366-px(K.tau0))" height="128" class="rt__forbid"/>',
      '        <line :x1="px(K.tau0)" y1="20" :x2="px(K.tau0)" y2="148" class="rt__tau"/>',
      '        <text :x="px(K.tau0)+4" y="32" class="rt__taulbl">τ₀ = {{ K.tau0 }}s 以外：模型已过期</text>',
      '        <circle v-for="(p,i) in trail" :key="\'tr\'+i" :cx="px(p.T)" :cy="py(p.A)" r="3"',
      '                :class="[\'rt__trail\', p.ok ? \'\' : \'is-bad\']" :opacity="0.15 + i/trail.length*0.6"/>',
      '        <circle :cx="px(T)" :cy="py(acc)" r="7" :class="[\'rt__cur\', feasible ? \'\' : \'is-bad\']"/>',
      '        <text :x="px(T)" :y="py(acc)-13" class="rt__curlbl">当前配置</text>',
      '        <text x="52" y="34" class="rt__hint">↖ 越靠左上越好</text>',
      '      </svg>',
      '      <div class="rt__cards">',
      '        <div class="rt__card"><span>预测精度 A</span><b>{{ acc.toFixed(4) }}</b></div>',
      '        <div class="rt__card" :class="{ bad: !feasible }"><span>总延迟 T</span><b>{{ T.toFixed(1) }}s</b>',
      '          <em>{{ feasible ? \'满足 τ₀\' : \'违反 τ₀！\' }}</em></div>',
      '        <div class="rt__card rt__card--u"><span>效用 U = A − ηT</span><b>{{ U.toFixed(4) }}</b></div>',
      '      </div>',
      '      <div class="rt__bars">',
      '        <div class="rt__bar" :style="{ width: pctOf.transmit + \'%\', background: \'#7cc4ff\' }" :title="\'传输 \'+parts.transmit.toFixed(1)+\'s\'"><span v-if="pctOf.transmit>7">① {{ pctOf.transmit }}%</span></div>',
      '        <div class="rt__bar" :style="{ width: pctOf.label + \'%\', background: \'#4dd4c4\' }" :title="\'标注 \'+parts.label.toFixed(1)+\'s\'"><span v-if="pctOf.label>7">② {{ pctOf.label }}%</span></div>',
      '        <div class="rt__bar" :style="{ width: pctOf.train + \'%\', background: \'#ffb454\' }" :title="\'训练 \'+parts.train.toFixed(1)+\'s\'"><span v-if="pctOf.train>7">③ 训练 {{ pctOf.train }}%</span></div>',
      '        <div class="rt__bar" :style="{ width: pctOf.update + \'%\', background: \'#ff8fa3\' }" :title="\'回传 \'+parts.update.toFixed(1)+\'s\'"><span v-if="pctOf.update>7">④ {{ pctOf.update }}%</span></div>',
      '      </div>',
      '      <p class="rt__legend">① 传输 {{ parts.transmit.toFixed(1) }}s · ② 标注 {{ parts.label.toFixed(1) }}s ·',
      '        ③ 训练 {{ parts.train.toFixed(1) }}s · ④ 回传 {{ parts.update.toFixed(1) }}s</p>',
      '    </div>',
      '  </div>',
      '  <div class="callout callout--try">',
      '    <b>试一试：把 η 拉到 0.9</b>',
      '    <p>你会看到最优解自动向"更少 epoch、更快的老师"移动 —— 因为环境越糟，紧急度越高，',
      '       系统就越不愿意为那一点点边际精度去赌时效。这就是 η 的全部意义：',
      '       它让"精度/延迟的兑换率"本身随环境自适应，而它的取值完全来自模拟器①里那个免费的中间量。</p>',
      '  </div>',
      '  <p class="src">A(e·n) 公式与四段延迟结构、τ₀=60s、e/n 取值范围来自论文；t(m) 斜率、单帧数据量、模型大小为演示取值。</p>',
      '</div>'
    ].join('\n')
  };
})();
