/* =============================================================================
 * app.js — 根应用：导航、滚动进度、章节装配
 * ========================================================================== */
(function () {
  'use strict';
  var NS = window.APP;
  var D = window.PAPER_DATA;

  var SECTIONS = [
    { id: 'hero', nav: '封面', icon: '◆', title: '', comp: null },
    { id: 's1', nav: '问题抽象', icon: '①', kicker: 'Problem Abstraction',
      title: '作者真正识别出的核心系统矛盾是什么', comp: 'sec-problem' },
    { id: 's2', nav: '技术推导链', icon: '②', kicker: 'Technique Derivation Chain',
      title: '作者是如何一步步被问题"逼"出技术设计的', comp: 'sec-chain' },
    { id: 's3', nav: '结构映射', icon: '③', kicker: 'Structure Mapping',
      title: '这些技术本质上属于哪一类经典技术结构', comp: 'sec-mapping' },
    { id: 's4', nav: '隐藏约束', icon: '④', kicker: 'Hidden Constraints',
      title: '这篇论文体现"顶会深度"的地方在哪里', comp: 'sec-hidden' },
    { id: 's5', nav: '设计模式', icon: '⑤', kicker: 'Design Patterns',
      title: '它体现了哪些可迁移的顶会设计模式', comp: 'sec-pattern' },
    { id: 's6', nav: '我该学什么', icon: '⑥', kicker: 'What To Learn',
      title: '最值得学习的"技术设计思维"是什么', comp: 'sec-lesson' },
    { id: 's7', nav: '反向审阅', icon: '⑦', kicker: 'Critical Reading',
      title: '沿着它的逻辑往前走，下一个问题是什么', comp: 'sec-critique' },
    { id: 's8', nav: '论文图库', icon: '▦', kicker: 'Figure Gallery',
      title: '13 张原图 + 方法论读法', comp: 'sec-gallery' }
  ];

  var GUIDE_TIPS = [
    { who: 'huo', mood: 'puzzle', text: '往下滚吧！我会一路提问，老衍负责推导，阿悟负责总结。' },
    { who: 'yan', mood: 'think', text: '看推导链的时候别只看"用了什么"，要看"新问题"怎么变成下一层的"问题"。' },
    { who: 'wu', mood: 'insight', text: '三个模拟器都能拖动 —— 亲手把参数拉到极端，比读十遍公式都快。' },
    { who: 'huo', mood: 'think', text: '卡片能翻面，图能点开放大，别放过它们。' },
    { who: 'yan', mood: 'insight', text: '记住那句话：技术是被约束逼出来的，不是被想出来的。' }
  ];

  var App = {
    data: function () {
      return {
        sections: SECTIONS,
        active: 'hero',
        progress: 0,
        navOpen: false,
        tipIdx: 0,
        tipTimer: null,
        meta: D.meta,
        params: D.params,
        dialogues: D.dialogues,
        showParams: false
      };
    },
    computed: {
      tip: function () { return GUIDE_TIPS[this.tipIdx % GUIDE_TIPS.length]; },
      chars: function () { return D.characters; },
      charList: function () { return [D.characters.huo, D.characters.yan, D.characters.wu]; }
    },
    mounted: function () {
      var self = this;
      this.onScroll();
      window.addEventListener('scroll', this.onScroll, { passive: true });
      this.tipTimer = setInterval(function () { self.tipIdx += 1; }, 12000);
      this.observe();
    },
    beforeUnmount: function () {
      window.removeEventListener('scroll', this.onScroll);
      if (this.tipTimer) clearInterval(this.tipTimer);
    },
    methods: {
      onScroll: function () {
        var doc = document.documentElement;
        var h = doc.scrollHeight - doc.clientHeight;
        this.progress = h > 0 ? Math.min(100, Math.max(0, (doc.scrollTop / h) * 100)) : 0;
        var best = this.active, bestD = Infinity;
        for (var i = 0; i < this.sections.length; i++) {
          var el = document.getElementById(this.sections[i].id);
          if (!el) continue;
          var d = Math.abs(el.getBoundingClientRect().top - 96);
          if (d < bestD) { bestD = d; best = this.sections[i].id; }
        }
        this.active = best;
      },
      go: function (id) {
        var el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        this.navOpen = false;
      },
      observe: function () {
        if (!('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('revealed'); io.unobserve(e.target); }
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
        this.$nextTick(function () {
          document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
        });
      }
    },
    template: [
      '<div class="app">',
      '  <div class="progress"><i :style="{ width: progress + \'%\' }"></i></div>',

      /* ---------------------------------------------------------- 顶栏 */
      '  <header class="topbar">',
      '    <button class="topbar__menu" @click="navOpen = !navOpen" aria-label="目录">☰</button>',
      '    <div class="topbar__brand">',
      '      <span class="topbar__logo">⚙</span>',
      '      <div>',
      '        <b>顶会论文方法论解剖室</b>',
      '        <em>ACM MM ’23 · Edge-Assisted On-Device Model Update</em>',
      '      </div>',
      '    </div>',
      '    <nav class="topbar__nav">',
      '      <button v-for="s in sections" :key="s.id" :class="{ \'is-on\': active === s.id }"',
      '              @click="go(s.id)">{{ s.icon }} {{ s.nav }}</button>',
      '    </nav>',
      '  </header>',

      /* ---------------------------------------------------------- 侧边抽屉 */
      '  <transition name="slide">',
      '    <aside class="drawer" v-if="navOpen">',
      '      <h4>目录</h4>',
      '      <button v-for="s in sections" :key="s.id" :class="{ \'is-on\': active === s.id }" @click="go(s.id)">',
      '        <span>{{ s.icon }}</span>{{ s.nav }}',
      '      </button>',
      '      <div class="drawer__foot">按 figure_out_needed.md 的六个维度组织</div>',
      '    </aside>',
      '  </transition>',
      '  <div class="scrim" v-if="navOpen" @click="navOpen=false"></div>',

      /* ---------------------------------------------------------- 封面 */
      '  <section id="hero" class="hero">',
      '    <div class="hero__bg"></div>',
      '    <div class="hero__inner">',
      '      <div class="hero__left">',
      '        <span class="hero__kicker">系统研究方法论分析 · 不是论文复述</span>',
      '        <h1>{{ meta.titleCn }}</h1>',
      '        <p class="hero__en">{{ meta.title }}</p>',
      '        <p class="hero__by">{{ meta.authors.join(" · ") }} — {{ meta.affiliation }}',
      '          <span class="badge">{{ meta.venue }}</span><span class="badge badge--dim">{{ meta.pages }}</span></p>',
      '        <blockquote class="hero__quote">{{ meta.oneLine }}</blockquote>',
      '        <div class="hero__core">',
      '          <span>全文主矛盾</span>',
      '          <p>{{ meta.contradiction }}</p>',
      '        </div>',
      '        <div class="hero__mods">',
      '          <div v-for="m in meta.modules" :key="m.name" class="hero__mod">',
      '            <b>{{ m.name }}</b><em>{{ m.where }}</em><p>{{ m.job }}</p>',
      '          </div>',
      '        </div>',
      '        <div class="hero__btns">',
      '          <button class="btn btn--primary" @click="go(\'s1\')">▸ 从「问题抽象」开始</button>',
      '          <button class="btn" @click="go(\'s2\')">直达「技术推导链」</button>',
      '          <button class="btn btn--ghost" @click="showParams = !showParams">',
      '            {{ showParams ? \'收起实验参数\' : \'查看实验参数\' }}</button>',
      '          <a href="paper.pdf" target="_blank" class="btn">下载原论文</a>',
      '        </div>',
      '        <transition name="expand">',
      '          <ul class="hero__params" v-if="showParams">',
      '            <li v-for="p in params" :key="p.k"><span>{{ p.k }}</span><b>{{ p.v }}</b></li>',
      '          </ul>',
      '        </transition>',
      '      </div>',
      '      <div class="hero__right">',
      '        <figure-card id="fig03_system_overview" :show-role="false"/>',
      '        <div class="hero__cast">',
      '          <div v-for="c in charList" :key="c.key" class="hero__castone">',
      '            <cartoon-figure :who="c.key" :mood="c.key===\'huo\' ? \'puzzle\' : (c.key===\'yan\' ? \'think\' : \'insight\')" :size="104"/>',
      '            <p><b>{{ c.name }}</b><em>{{ c.role }}</em>「{{ c.motto }}」</p>',
      '          </div>',
      '        </div>',
      '      </div>',
      '    </div>',
      '    <div class="hero__dlg reveal">',
      '      <dialogue-strip :lines="dialogues.hero" title="开场：三个角色的第一轮交锋"/>',
      '    </div>',
      '    <div class="hero__scroll">向下滚动 ↓</div>',
      '  </section>',

      /* ---------------------------------------------------------- 各分析章节 */
      '  <main>',
      '    <section v-for="s in sections.slice(1)" :key="s.id" :id="s.id" class="sec reveal">',
      '      <div class="sec__head">',
      '        <span class="sec__icon">{{ s.icon }}</span>',
      '        <div>',
      '          <span class="sec__kicker">{{ s.kicker }}</span>',
      '          <h2>{{ s.title }}</h2>',
      '        </div>',
      '      </div>',
      '      <component :is="s.comp"/>',
      '      <div class="sec__dlg" v-if="dialogues[s.id]">',
      '        <dialogue-strip :lines="dialogues[s.id]" :title="\'角色旁白 · \' + s.nav"/>',
      '      </div>',
      '    </section>',
      '  </main>',

      /* ---------------------------------------------------------- 页脚 */
      '  <footer class="foot">',
      '    <div class="foot__cols">',
      '      <div>',
      '        <h5>关于这份分析</h5>',
      '        <p>按 <code>figure_out_needed.md</code> 提出的六个维度组织：问题抽象、技术推导链、',
      '           技术结构映射、隐藏约束、设计模式、该学到什么，并额外补了一节反向审阅。',
      '           所有图片直接从 <code>paper.pdf</code> 裁切。</p>',
      '      </div>',
      '      <div>',
      '        <h5>数字的出处</h5>',
      '        <p>标注 <b>论文原文</b> 的数值来自正文或图内标注；标注 <b>反推示意</b> 的由论文给出的百分比换算；',
      '           标注 <b>演示取值</b> 的仅用于交互模拟（公式形式取自论文，数值非原文）。</p>',
      '      </div>',
      '      <div>',
      '        <h5>原文</h5>',
      '        <p>{{ meta.authors.join(", ") }}. <i>{{ meta.title }}</i>. {{ meta.venue }}, {{ meta.pages }}.',
      '           DOI {{ meta.doi }}</p>',
      '      </div>',
      '    </div>',
      '    <p class="foot__end">技术是被约束逼出来的，不是被想出来的。</p>',
      '  </footer>',

      '  <mini-guide :tip="tip"/>',
      '  <button class="totop" v-if="progress > 6" @click="go(\'hero\')" aria-label="回到顶部">↑</button>',
      '</div>'
    ].join('\n')
  };

  var app = Vue.createApp(App);
  Object.keys(NS.components).forEach(function (name) {
    app.component(name, NS.components[name]);
  });
  app.mount('#app');
  window.__APP_MOUNTED__ = true;
})();
