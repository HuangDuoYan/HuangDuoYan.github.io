/* =============================================================================
 * sections.js — 六大分析板块 + 论文图库 + 反向审阅 + 推导器工具
 * ========================================================================== */
(function () {
  'use strict';
  var NS = (window.APP = window.APP || {});
  NS.components = NS.components || {};

  /* -------------------------------------------------------- 论文图片查看器 */
  NS.components['figure-card'] = {
    name: 'FigureCard',
    props: {
      id: { type: String, required: true },
      showRole: { type: Boolean, default: true },
      compact: { type: Boolean, default: false }
    },
    data: function () { return { zoom: false }; },
    computed: {
      f: function () {
        var list = window.PAPER_DATA.figures;
        for (var i = 0; i < list.length; i++) if (list[i].id === this.id) return list[i];
        return null;
      },
      src: function () { return 'assets/figures/' + this.id + '.png'; }
    },
    template: [
      '<figure v-if="f" :class="[\'figcard\', f.wide ? \'figcard--wide\' : \'\', compact ? \'figcard--compact\' : \'\']">',
      '  <div class="figcard__imgbox" @click="zoom = true" :title="\'点击放大 \' + f.num">',
      '    <img :src="src" :alt="f.num + \' \' + f.title" loading="lazy">',
      '    <span class="figcard__zoom">⤢ 放大</span>',
      '  </div>',
      '  <figcaption>',
      '    <p class="figcard__num"><b>{{ f.num }}</b>{{ f.title }}</p>',
      '    <p class="figcard__cap">{{ f.caption }}</p>',
      '    <p class="figcard__role" v-if="showRole"><i>方法论读法 ▸</i> {{ f.role }}</p>',
      '  </figcaption>',
      '  <teleport to="body">',
      '    <div class="lightbox" v-if="zoom" @click="zoom = false">',
      '      <img :src="src" :alt="f.title">',
      '      <p>{{ f.num }} · {{ f.title }} <em>（点击任意处关闭）</em></p>',
      '    </div>',
      '  </teleport>',
      '</figure>'
    ].join('\n')
  };

  /* ============================================== §1 问题抽象 */
  NS.components['sec-problem'] = {
    name: 'SecProblem',
    data: function () { return { axisFilter: null }; },
    computed: {
      priorWork: function () { return window.PAPER_DATA.priorWork; },
      shown: function () {
        var a = this.axisFilter;
        if (!a) return this.priorWork;
        return this.priorWork.filter(function (p) { return p.axis === a; });
      },
      axes: function () { return window.PAPER_DATA.tensions; }
    },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    作者没有把问题写成"轻量模型精度不够"。他写成的是一组<strong>系统层面的张力</strong>：',
      '    每一条张力都堵死一条捷径，五条叠起来只剩下一条极窄的可行路径 —— 而那条路径就是这篇论文。',
      '  </p>',
      '  <tension-map/>',
      '  <h3 class="sub">为什么已有方法不够：每一类方法都倒在某一条张力上</h3>',
      '  <div class="chips">',
      '    <button :class="[\'chipbtn\', axisFilter===null?\'is-on\':\'\']" @click="axisFilter=null">全部</button>',
      '    <button v-for="a in axes" :key="a.id" :class="[\'chipbtn\', axisFilter===a.id?\'is-on\':\'\']"',
      '            @click="axisFilter=a.id" :style="{ \'--c\': a.color }">{{ a.id }} {{ a.cn }}</button>',
      '  </div>',
      '  <table class="tbl">',
      '    <thead><tr><th>方法类别</th><th>代表工作</th><th>它的隐含假设</th><th>失效点</th><th>倒在</th></tr></thead>',
      '    <tbody>',
      '      <tr v-for="p in shown" :key="p.name">',
      '        <td><b>{{ p.name }}</b></td><td class="dim">{{ p.rep }}</td>',
      '        <td>{{ p.assume }}</td><td>{{ p.fail }}</td>',
      '        <td><span class="chip chip--xs">{{ p.axis }}</span></td>',
      '      </tr>',
      '    </tbody>',
      '  </table>',
      '  <h3 class="sub">动机实验：把矛盾"钉死"，并量出天花板</h3>',
      '  <div class="figrow">',
      '    <figure-card id="fig01_normal_vs_adverse"/>',
      '    <figure-card id="fig02a_accuracy_curve"/>',
      '    <figure-card id="fig02b_latency_accuracy"/>',
      '  </div>',
      '  <h3 class="sub">亲手感受一下"分布漂移"</h3>',
      '  <adverse-demo/>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §2 技术推导链 */
  NS.components['sec-chain'] = {
    name: 'SecChain',
    data: function () { return { open: 1, autoTimer: null }; },
    computed: {
      chain: function () { return window.PAPER_DATA.chain; }
    },
    methods: {
      toggle: function (i) { this.open = this.open === i ? -1 : i; },
      step: function (d) {
        var n = this.chain.length;
        this.open = ((this.open + d) % n + n) % n;
        this.scrollTo(this.open);
      },
      scrollTo: function (i) {
        var el = this.$refs['node' + i];
        if (el && el[0]) el[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        else if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
      autoplay: function () {
        var self = this;
        if (this.autoTimer) { clearInterval(this.autoTimer); this.autoTimer = null; return; }
        this.open = 0;
        this.autoTimer = setInterval(function () {
          if (self.open >= self.chain.length - 1) { clearInterval(self.autoTimer); self.autoTimer = null; return; }
          self.open += 1; self.scrollTo(self.open);
        }, 3600);
      },
      expandAll: function () { this.open = -2; }   // -2 = 全开
    },
    beforeUnmount: function () { if (this.autoTimer) clearInterval(this.autoTimer); },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    这是全篇最重要的一节。下面每一格都不是"作者提出了 XXX"，而是',
      '    <strong>问题 → naive 方法 → 它为什么失败 → 由此引入的新约束 → 为满足约束而生的新技术 → 新技术带来的新问题</strong>',
      '    这样一条递归链。请重点看每一格的<em>"新问题"</em>如何变成下一格的<em>"问题"</em>。',
      '  </p>',
      '  <div class="chain__ctrl">',
      '    <button class="btn btn--sm" @click="step(-1)">← 上一层</button>',
      '    <button class="btn btn--sm" @click="step(1)">下一层 →</button>',
      '    <button class="btn btn--primary btn--sm" @click="autoplay">{{ autoTimer ? \'⏸ 暂停自动播放\' : \'▶ 自动推导\' }}</button>',
      '    <button class="btn btn--ghost btn--sm" @click="expandAll">全部展开</button>',
      '    <span class="chain__pos" v-if="open >= 0">{{ open + 1 }} / {{ chain.length }}</span>',
      '  </div>',
      '  <ol class="chain">',
      '    <li v-for="(c, i) in chain" :key="c.id" :ref="\'node\'+i"',
      '        :class="[\'chain__node\', \'tag-\'+c.tag, (open===i || open===-2) ? \'is-open\' : \'\']">',
      '      <button class="chain__head" @click="toggle(i)">',
      '        <span class="chain__badge">{{ c.id }}</span>',
      '        <span class="chain__layer">{{ c.layer }}</span>',
      '        <span class="chain__q">{{ c.question }}</span>',
      '        <span class="chain__caret">{{ (open===i || open===-2) ? \'▾\' : \'▸\' }}</span>',
      '      </button>',
      '      <transition name="expand">',
      '        <div class="chain__body" v-if="open===i || open===-2">',
      '          <div class="derive">',
      '            <div class="derive__step derive__step--naive">',
      '              <h6>① naive 方法</h6><p>{{ c.naive }}</p>',
      '            </div>',
      '            <div class="derive__arrow">失败</div>',
      '            <div class="derive__step derive__step--fail">',
      '              <h6>② 为什么失败</h6><p>{{ c.fail }}</p>',
      '            </div>',
      '            <div class="derive__arrow">于是被逼出</div>',
      '            <div class="derive__step derive__step--cons">',
      '              <h6>③ 新引入的约束</h6><p>{{ c.constraint }}</p>',
      '            </div>',
      '            <div class="derive__arrow">为满足它</div>',
      '            <div class="derive__step derive__step--tech">',
      '              <h6>④ 新技术（自然推导的结果）</h6><p>{{ c.tech }}</p>',
      '            </div>',
      '            <div class="derive__arrow derive__arrow--loop">又带来</div>',
      '            <div class="derive__step derive__step--next">',
      '              <h6>⑤ 新的问题 → 进入下一层</h6><p>{{ c.newProblem }}</p>',
      '            </div>',
      '          </div>',
      '          <div class="callout callout--insight" v-if="c.insight">',
      '            <b>💡 这一层的方法论要点</b><p>{{ c.insight }}</p>',
      '          </div>',
      '          <div class="figrow figrow--tight" v-if="c.figure">',
      '            <figure-card :id="c.figure" :compact="true"/>',
      '            <figure-card v-if="c.figure2" :id="c.figure2" :compact="true"/>',
      '          </div>',
      '          <div class="chain__sim" v-if="c.sim">',
      '            <keyframe-sim v-if="c.sim===\'keyframe\'"/>',
      '            <trigger-sim v-else-if="c.sim===\'trigger\'"/>',
      '            <retrain-sim v-else-if="c.sim===\'retrain\'"/>',
      '          </div>',
      '        </div>',
      '      </transition>',
      '    </li>',
      '  </ol>',
      '  <div class="callout callout--key">',
      '    <h4>回头看这条链，你会发现一个规律</h4>',
      '    <p>每一层的"新技术"都不是凭空冒出来的灵感，而是上一层的"新开销"逼出来的必然选择。',
      '       所以判断一篇系统论文是否扎实，可以用一个很简单的测试：',
      '       <strong>把它的任意一个模块删掉，你能不能立刻说出哪条约束被违反了？</strong>',
      '       在这篇论文里，每个模块都能通过这个测试。</p>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §3 技术结构映射 */
  NS.components['sec-mapping'] = {
    name: 'SecMapping',
    data: function () { return { flipped: {} }; },
    computed: { mappings: function () { return window.PAPER_DATA.mappings; } },
    methods: {
      flip: function (i) { this.flipped[i] = !this.flipped[i]; }
    },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    重点不是"作者用了什么技术"，而是<strong>作者把问题抽象成了什么，因此那个经典结构才恰好适配</strong>。',
      '    下面每张卡片正面是本文的机制，点击翻到背面看它对应的经典技术结构，以及"为什么适配"。',
      '  </p>',
      '  <div class="mapgrid">',
      '    <div v-for="(m,i) in mappings" :key="i" :class="[\'mapcard\', flipped[i] ? \'is-flipped\' : \'\']"',
      '         @click="flip(i)" tabindex="0" @keyup.enter="flip(i)">',
      '      <div class="mapcard__inner">',
      '        <div class="mapcard__front">',
      '          <span class="mapcard__icon" :data-i="m.icon"></span>',
      '          <h5>{{ m.module }}</h5>',
      '          <p class="mapcard__abs">{{ m.abstraction }}</p>',
      '          <span class="mapcard__more">点击看它属于哪类经典结构 →</span>',
      '        </div>',
      '        <div class="mapcard__back">',
      '          <h6>{{ m.structure }}</h6>',
      '          <p>{{ m.why }}</p>',
      '          <div class="mapcard__tags">',
      '            <span v-for="(t,k) in m.classic" :key="k" class="tagx">{{ t }}</span>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '  </div>',
      '  <h3 class="sub">两条离线拟合曲线：把"不可观测"变成"可优化"</h3>',
      '  <fit-curve/>',
      '  <div class="figrow figrow--tight">',
      '    <figure-card id="fig05_linear_latency" :compact="true"/>',
      '    <figure-card id="fig07_accuracy_fit" :compact="true"/>',
      '    <figure-card id="fig04_config_tradeoff" :compact="true"/>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §4 隐藏约束 */
  NS.components['sec-hidden'] = {
    name: 'SecHidden',
    data: function () { return { view: 'paper' }; },
    computed: {
      hidden: function () { return window.PAPER_DATA.hidden; },
      coreCount: function () { return this.hidden.filter(function (h) { return h.core; }).length; }
    },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    这一节回答：<strong>普通论文容易忽略什么，而这篇进一步考虑了什么系统约束</strong>。',
      '    切换下面的视角开关，对同一份清单看两遍 —— 差距就是"顶会深度"的具体形状。',
      '  </p>',
      '  <div class="seg seg--wide seg--big">',
      '    <button :class="[\'seg__b\', view===\'ordinary\'?\'is-on\':\'\']" @click="view=\'ordinary\'">🙂 普通论文视角</button>',
      '    <button :class="[\'seg__b\', view===\'paper\'?\'is-on\':\'\']" @click="view=\'paper\'">🔬 本文的系统视角</button>',
      '    <button :class="[\'seg__b\', view===\'both\'?\'is-on\':\'\']" @click="view=\'both\'">⇄ 并排对比</button>',
      '  </div>',
      '  <div class="hidgrid">',
      '    <div v-for="h in hidden" :key="h.id" :class="[\'hidcard\', \'lv-\'+h.level, h.core ? \'is-core\':\'\']">',
      '      <div class="hidcard__top">',
      '        <span class="hidcard__tag">{{ h.tag }}</span>',
      '        <span class="hidcard__lv" :title="\'系统意识深度 \'+h.level+\'/4\'">',
      '          <i v-for="k in 4" :key="k" :class="{ on: k <= h.level }"></i>',
      '        </span>',
      '      </div>',
      '      <h5>{{ h.title }}</h5>',
      '      <div class="hidcard__cmp" v-if="view===\'ordinary\' || view===\'both\'">',
      '        <b class="c-ord">普通做法</b><p>{{ h.ordinary }}</p>',
      '      </div>',
      '      <div class="hidcard__cmp" v-if="view===\'paper\' || view===\'both\'">',
      '        <b class="c-paper">本文</b><p>{{ h.paper }}</p>',
      '      </div>',
      '      <span class="hidcard__core" v-if="h.core">最能体现顶会深度</span>',
      '    </div>',
      '  </div>',
      '  <h3 class="sub">端到端记账：延迟的四段分解</h3>',
      '  <decomp-chart/>',
      '  <h3 class="sub">这些约束换来了什么：论文给出的量化结论</h3>',
      '  <claims-board/>',
      '  <div class="figrow">',
      '    <figure-card id="fig13_time_decomposition"/>',
      '    <figure-card id="fig11_bandwidth"/>',
      '    <figure-card id="fig12_retrain_times"/>',
      '  </div>',
      '  <h3 class="sub">首次模型更新：响应速度本身就是精度</h3>',
      '  <first-update-chart/>',
      '  <figure-card id="fig08_first_update_compare"/>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §5 设计模式 */
  NS.components['sec-pattern'] = {
    name: 'SecPattern',
    data: function () { return { sel: 7 }; },
    computed: {
      patterns: function () { return window.PAPER_DATA.patterns; },
      cur: function () { return this.patterns[this.sel] || this.patterns[0]; }
    },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    这些模式不是标签，而是<strong>可迁移的候选动作集</strong>。',
      '    左边点选任一模式，右边给出"本文怎么用"以及"还能迁移到哪些问题"。',
      '    带 ★ 的那一条，是我认为本篇最值得抄走的一招。',
      '  </p>',
      '  <div class="patwrap">',
      '    <ul class="patlist">',
      '      <li v-for="(p,i) in patterns" :key="i" :class="{ \'is-on\': sel===i, \'is-star\': p.star }"',
      '          @click="sel=i" tabindex="0" @keyup.enter="sel=i">',
      '        <span class="patlist__n">{{ p.star ? \'★\' : (i+1) }}</span>',
      '        <span class="patlist__t"><b>{{ p.name }}</b><em>{{ p.en }}</em></span>',
      '        <span class="patlist__s"><i v-for="k in 5" :key="k" :class="{ on: k <= p.strength }"></i></span>',
      '      </li>',
      '    </ul>',
      '    <div class="patdetail">',
      '      <h4>{{ cur.star ? \'★ \' : \'\' }}{{ cur.name }}<code>{{ cur.en }}</code></h4>',
      '      <div class="patdetail__blk">',
      '        <h6>本文如何使用</h6><p>{{ cur.inPaper }}</p>',
      '      </div>',
      '      <div class="patdetail__blk">',
      '        <h6>还能迁移到哪些问题</h6>',
      '        <ul class="transfer"><li v-for="(t,i) in cur.transfer" :key="i">{{ t }}</li></ul>',
      '      </div>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §6 该学到什么 + 推导器 */
  NS.components['sec-lesson'] = {
    name: 'SecLesson',
    data: function () {
      return {
        myProblem: '',
        naive: '',
        generated: false
      };
    },
    computed: {
      lessons: function () { return window.PAPER_DATA.lessons; },
      prompts: function () {
        var p = this.myProblem.trim() || '（你的问题）';
        var n = this.naive.trim() || '（最直觉的做法）';
        return [
          { q: '① 上界在哪里？', a: '设计一个"假装没有成本"的实验：如果 ' + p + ' 里所有资源无限、所有延迟为零，最好能做到多好？先量出这个天花板。天花板太低，方向就该换。' },
          { q: '② naive 为什么失败？', a: '写下 ' + n + ' 失败时被违反的那条物理量：是算力、带宽、内存、延迟，还是标签？把它写成一个不等式。' },
          { q: '③ 新约束是什么？', a: '把上一步的不等式提升为一条硬约束。它应该长成"某个量 ≤ 某个预算"的形式 —— 这才是可优化的形状。' },
          { q: '④ 我需要的量可观测吗？', a: '列出决策所需的全部量。凡是"要等结果才知道"的，都必须换成一个又便宜又相关的代理（本文的四个代理：置信度、低置信比例、帧差、e·n）。' },
          { q: '⑤ 我的配置空间能降维吗？', a: '问自己：真正驱动结果的物理量是什么？把多个旋钮乘/合成一个标量，往往能把黑箱变成一条可拟合的曲线。' },
          { q: '⑥ 我的新模块欠了多少账？', a: '为 ' + n + ' 的替代方案逐项记账：它欠多少延迟、多少带宽、多少算力？然后当场还上，或实测证明可忽略（本文：20ms）。' },
          { q: '⑦ 决策的时效价值是多少？', a: '如果你的解迟到了，它还值钱吗？如果不值，就把延迟写进目标函数（U = A − ηT），并给一条硬 deadline（τ₀）。' },
          { q: '⑧ 我的每个 baseline 各证明什么？', a: '为 ' + p + ' 的每一个设计维度找一个恰好只在该维度不同的对照组。四个 baseline = 四次消融。' }
        ];
      }
    },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    假设你是一个正在学习顶会技术设计的研究生。抛开这篇论文的实验结果，',
      '    真正值得带走的是<strong>作者思考问题的八个动作</strong>。每一条都配了一句可以立刻用在自己论文上的操作建议。',
      '  </p>',
      '  <ol class="lessons">',
      '    <li v-for="l in lessons" :key="l.n">',
      '      <span class="lessons__n">{{ l.n }}</span>',
      '      <div>',
      '        <h5>{{ l.title }}</h5>',
      '        <p>{{ l.body }}</p>',
      '        <p class="lessons__do"><b>怎么用 ▸</b>{{ l.action }}</p>',
      '      </div>',
      '    </li>',
      '  </ol>',
      '  <div class="tool">',
      '    <h3 class="sub">动手：把这套方法论套到你自己的问题上</h3>',
      '    <p class="tool__hint">填两个空，下面会生成一份属于你的"八问推导清单"。这不是自动写论文，而是把作者的思维顺序变成你的检查表。</p>',
      '    <div class="tool__inputs">',
      '      <label><span>你要解决的问题</span>',
      '        <input type="text" v-model="myProblem" placeholder="例：多路摄像头共享一台边缘服务器时的推理调度" maxlength="80">',
      '      </label>',
      '      <label><span>最直觉的 naive 做法</span>',
      '        <input type="text" v-model="naive" placeholder="例：先到先服务，轮转分配 GPU" maxlength="80">',
      '      </label>',
      '      <button class="btn btn--primary" @click="generated = true">生成我的推导清单</button>',
      '    </div>',
      '    <transition name="fade">',
      '      <ol class="tool__out" v-if="generated || myProblem || naive">',
      '        <li v-for="(p,i) in prompts" :key="i"><b>{{ p.q }}</b><p>{{ p.a }}</p></li>',
      '      </ol>',
      '    </transition>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== §7 反向审阅 */
  NS.components['sec-critique'] = {
    name: 'SecCritique',
    computed: { critiques: function () { return window.PAPER_DATA.critiques; } },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">',
      '    读顶会论文的最后一步，是<strong>找到它的边界</strong>。以下不是"这篇论文不好"，',
      '    而是"沿着它的设计逻辑往前走，下一个必须回答的问题是什么" —— 这些缺口往往就是下一篇论文的入口。',
      '  </p>',
      '  <div class="critgrid">',
      '    <div class="critcard" v-for="(c,i) in critiques" :key="i">',
      '      <span class="critcard__n">Q{{ i+1 }}</span>',
      '      <h5>{{ c.title }}</h5>',
      '      <p>{{ c.body }}</p>',
      '      <p class="critcard__open"><b>可能的下一步 ▸</b>{{ c.open }}</p>',
      '    </div>',
      '  </div>',
      '</div>'
    ].join('\n')
  };

  /* ============================================== 图库 */
  NS.components['sec-gallery'] = {
    name: 'SecGallery',
    computed: { figures: function () { return window.PAPER_DATA.figures; } },
    template: [
      '<div class="sec__body">',
      '  <p class="lead">论文全部 13 张图，直接从 PDF 中裁切而来。每张都附一句"方法论读法" —— 这张图究竟在论证什么。</p>',
      '  <div class="gallery">',
      '    <figure-card v-for="f in figures" :key="f.id" :id="f.id"/>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
})();
