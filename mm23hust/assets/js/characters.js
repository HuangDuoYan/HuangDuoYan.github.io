/* =============================================================================
 * characters.js — 卡通人物形象 + 气泡对白组件
 *  - <cartoon-figure>  纯 SVG 手绘角色（小惑 / 老衍 / 阿悟），支持 puzzle/think/insight 三种情绪
 *  - <speech-bubble>   带尾巴的气泡，打字机效果
 *  - <dialogue-strip>  一整条对白（角色 + 气泡 + 情绪标签 + 逐句推进）
 *  - <mini-guide>      角落里的小助手（悬浮提示）
 * ========================================================================== */
(function () {
  'use strict';
  var NS = (window.APP = window.APP || {});
  NS.components = NS.components || {};

  var MOOD_LABEL = { puzzle: '疑惑', think: '思考', insight: '感悟' };
  var MOOD_ICON = { puzzle: '？', think: '…', insight: '！' };

  /* ------------------------------------------------------------------ 角色 SVG */
  NS.components['cartoon-figure'] = {
    name: 'CartoonFigure',
    props: {
      who: { type: String, required: true },      // huo | yan | wu
      mood: { type: String, default: 'think' },   // puzzle | think | insight
      size: { type: Number, default: 132 },
      talking: { type: Boolean, default: false }
    },
    computed: {
      def: function () {
        return (window.PAPER_DATA.characters[this.who]) || window.PAPER_DATA.characters.huo;
      },
      cls: function () {
        return ['cartoon', 'cartoon--' + this.who, 'mood--' + this.mood, this.talking ? 'is-talking' : ''];
      }
    },
    template: [
      '<div :class="cls" :style="{width: size + \'px\'}">',
      '  <svg :viewBox="\'0 0 120 140\'" class="cartoon__svg" role="img" :aria-label="def.name">',
      '    <defs>',
      '      <radialGradient :id="\'glow-\'+who" cx="50%" cy="50%" r="50%">',
      '        <stop offset="0%" :stop-color="def.color" stop-opacity="0.42"/>',
      '        <stop offset="100%" :stop-color="def.color" stop-opacity="0"/>',
      '      </radialGradient>',
      '      <linearGradient :id="\'body-\'+who" x1="0" y1="0" x2="0" y2="1">',
      '        <stop offset="0%" :stop-color="def.color"/>',
      '        <stop offset="100%" :stop-color="def.accent"/>',
      '      </linearGradient>',
      '    </defs>',
      '    <ellipse cx="60" cy="126" rx="34" ry="7" :fill="\'url(#glow-\'+who+\')\'"/>',

      /* ---------------- 小惑：研究生 ---------------- */
      '    <g v-if="who===\'huo\'" class="cartoon__bob">',
      '      <path d="M42 128 q3 -16 8 -22 h20 q5 6 8 22 z" :fill="\'url(#body-\'+who+\')\'"/>',
      '      <rect x="46" y="96" width="28" height="20" rx="9" :fill="\'url(#body-\'+who+\')\'"/>',
      '      <path d="M56 98 v10 M64 98 v10" stroke="#0d1b24" stroke-width="1.6" stroke-linecap="round" opacity="0.5"/>',
      '      <circle cx="41" cy="106" r="5" :fill="def.accent" class="cartoon__arm-l"/>',
      '      <circle cx="79" cy="106" r="5" :fill="def.accent" class="cartoon__arm-r"/>',
      '      <circle cx="60" cy="70" r="26" fill="#ffe0c4"/>',
      '      <path d="M34 66 q4 -26 26 -26 t26 26 q-6 -12 -26 -12 t-26 12z" fill="#3a2a24"/>',
      '      <path d="M60 42 q3 -12 10 -14 q-4 6 -3 13" fill="none" stroke="#3a2a24" stroke-width="3" stroke-linecap="round" class="cartoon__ahoge"/>',
      '      <g class="cartoon__glasses">',
      '        <circle cx="50" cy="70" r="8.5" fill="#e8f7ff" fill-opacity="0.55" stroke="#274a5a" stroke-width="2"/>',
      '        <circle cx="70" cy="70" r="8.5" fill="#e8f7ff" fill-opacity="0.55" stroke="#274a5a" stroke-width="2"/>',
      '        <path d="M58.5 70 h3" stroke="#274a5a" stroke-width="2"/>',
      '      </g>',
      '      <g class="cartoon__eyes">',
      '        <circle cx="50" cy="70" r="2.7" fill="#16323e"/>',
      '        <circle cx="70" cy="70" r="2.7" fill="#16323e"/>',
      '      </g>',
      '      <path class="cartoon__mouth" :d="mood===\'insight\' ? \'M53 83 q7 8 14 0\' : (mood===\'puzzle\' ? \'M54 84 q6 -5 12 0\' : \'M54 84 h12\')" fill="none" stroke="#a2563f" stroke-width="2.2" stroke-linecap="round"/>',
      '      <ellipse cx="40" cy="79" rx="4" ry="2.6" fill="#ff9d9d" opacity="0.5"/>',
      '      <ellipse cx="80" cy="79" rx="4" ry="2.6" fill="#ff9d9d" opacity="0.5"/>',
      '    </g>',

      /* ---------------- 老衍：导师 ---------------- */
      '    <g v-else-if="who===\'yan\'" class="cartoon__bob">',
      '      <path d="M38 128 q4 -20 10 -26 h24 q6 6 10 26 z" :fill="\'url(#body-\'+who+\')\'"/>',
      '      <path d="M60 102 v26" stroke="#7a4a10" stroke-width="1.6" opacity="0.55"/>',
      '      <rect x="50" y="97" width="20" height="10" rx="4" fill="#fdf3e0"/>',
      '      <circle cx="36" cy="108" r="5.4" :fill="def.accent" class="cartoon__arm-l"/>',
      '      <circle cx="84" cy="108" r="5.4" :fill="def.accent" class="cartoon__arm-r"/>',
      '      <rect x="86" y="100" width="12" height="10" rx="2" fill="#f6f2ea" stroke="#c8b79a" stroke-width="1.4"/>',
      '      <path d="M98 103 q5 2 0 5" fill="none" stroke="#c8b79a" stroke-width="1.4"/>',
      '      <circle cx="60" cy="68" r="26" fill="#ffe3c8"/>',
      '      <path d="M34 66 q0 -14 8 -19 q-2 8 1 14 z" fill="#d9d3cc"/>',
      '      <path d="M86 66 q0 -14 -8 -19 q2 8 -1 14 z" fill="#d9d3cc"/>',
      '      <path d="M40 58 q20 -16 40 0 q-6 -20 -20 -20 t-20 20z" fill="#e4ded6" opacity="0.9"/>',
      '      <path d="M46 84 q14 16 28 0 q-2 14 -14 14 t-14 -14z" fill="#e4ded6"/>',
      '      <g class="cartoon__eyes">',
      '        <circle cx="50" cy="68" r="2.9" fill="#2c2119"/>',
      '        <circle cx="70" cy="68" r="2.9" fill="#2c2119"/>',
      '      </g>',
      '      <path d="M42 60 q8 -4 15 0" fill="none" stroke="#8d7b63" stroke-width="2.2" stroke-linecap="round"/>',
      '      <path d="M63 60 q8 -4 15 0" fill="none" stroke="#8d7b63" stroke-width="2.2" stroke-linecap="round"/>',
      '      <path class="cartoon__mouth" :d="mood===\'insight\' ? \'M54 82 q6 7 12 0\' : \'M55 82 h10\'" fill="none" stroke="#9a5a3a" stroke-width="2.2" stroke-linecap="round"/>',
      '    </g>',

      /* ---------------- 阿悟：端侧摄像头机器人 ---------------- */
      '    <g v-else class="cartoon__bob">',
      '      <path d="M46 128 h28 l-6 -14 h-16 z" :fill="def.accent" opacity="0.85"/>',
      '      <rect x="30" y="52" width="60" height="46" rx="14" :fill="\'url(#body-\'+who+\')\'"/>',
      '      <rect x="34" y="56" width="52" height="30" rx="10" fill="#101a2c" opacity="0.85"/>',
      '      <circle class="cartoon__lens" cx="60" cy="71" r="13" fill="#0b1220" stroke="#e9e4ff" stroke-width="2.5"/>',
      '      <circle class="cartoon__iris" cx="60" cy="71" r="7" :fill="def.color"/>',
      '      <circle cx="56" cy="67" r="2.6" fill="#ffffff" opacity="0.9"/>',
      '      <circle class="cartoon__led" cx="80" cy="60" r="2.6" fill="#7dffb0"/>',
      '      <path d="M60 52 v-10" stroke="#b9a8e6" stroke-width="2.4" stroke-linecap="round"/>',
      '      <circle class="cartoon__antenna" cx="60" cy="38" r="4.4" :fill="def.color"/>',
      '      <rect x="24" y="66" width="8" height="16" rx="3" :fill="def.accent" class="cartoon__arm-l"/>',
      '      <rect x="88" y="66" width="8" height="16" rx="3" :fill="def.accent" class="cartoon__arm-r"/>',
      '      <rect x="44" y="100" width="32" height="8" rx="4" :fill="def.accent" opacity="0.7"/>',
      '      <g class="cartoon__bars">',
      '        <rect x="50" y="90" width="4" height="5" rx="1.4" fill="#7dffb0"/>',
      '        <rect x="58" y="90" width="4" height="5" rx="1.4" fill="#7dffb0" opacity="0.75"/>',
      '        <rect x="66" y="90" width="4" height="5" rx="1.4" fill="#7dffb0" opacity="0.45"/>',
      '      </g>',
      '    </g>',

      /* ---------------- 情绪装饰 ---------------- */
      '    <g v-if="mood===\'puzzle\'" class="mood-deco mood-deco--puzzle">',
      '      <text x="94" y="34" class="mood-mark">?</text>',
      '      <text x="20" y="44" class="mood-mark mood-mark--sm">?</text>',
      '    </g>',
      '    <g v-else-if="mood===\'think\'" class="mood-deco mood-deco--think">',
      '      <circle cx="90" cy="40" r="3.4" fill="#9fc6da" opacity="0.75"/>',
      '      <circle cx="98" cy="30" r="4.6" fill="#9fc6da" opacity="0.6"/>',
      '      <circle cx="107" cy="19" r="6" fill="#9fc6da" opacity="0.42"/>',
      '    </g>',
      '    <g v-else class="mood-deco mood-deco--insight">',
      '      <path d="M96 30 a8 8 0 1 1 12 0 q-2 4 -3 7 h-6 q-1 -3 -3 -7z" fill="#ffe07a"/>',
      '      <rect x="99" y="38" width="6" height="4" rx="1.4" fill="#e0b64a"/>',
      '      <path d="M88 18 l3 5 M116 18 l-3 5 M86 34 l5 1 M118 34 l-5 1" stroke="#ffe07a" stroke-width="2" stroke-linecap="round"/>',
      '    </g>',
      '  </svg>',
      '  <div class="cartoon__tag" :style="{borderColor: def.color, color: def.color}">',
      '    <b>{{ def.name }}</b><span>{{ moodLabel }}</span>',
      '  </div>',
      '</div>'
    ].join('\n')
  };
  NS.components['cartoon-figure'].computed.moodLabel = function () {
    return MOOD_LABEL[this.mood] || '思考';
  };

  /* ---------------------------------------------------------------- 气泡组件 */
  NS.components['speech-bubble'] = {
    name: 'SpeechBubble',
    props: {
      text: { type: String, required: true },
      mood: { type: String, default: 'think' },
      color: { type: String, default: '#4dd4c4' },
      side: { type: String, default: 'left' },   // 尾巴朝向
      typing: { type: Boolean, default: true },
      speed: { type: Number, default: 26 }
    },
    data: function () { return { shown: '', done: false, timer: null }; },
    computed: {
      moodLabel: function () { return MOOD_LABEL[this.mood] || '思考'; },
      moodIcon: function () { return MOOD_ICON[this.mood] || '…'; }
    },
    watch: {
      text: function () { this.run(); },
      typing: function () { this.run(); }
    },
    mounted: function () { this.run(); },
    beforeUnmount: function () { if (this.timer) clearInterval(this.timer); },
    methods: {
      run: function () {
        var self = this;
        if (this.timer) clearInterval(this.timer);
        if (!this.typing) { this.shown = this.text; this.done = true; return; }
        this.shown = ''; this.done = false;
        var i = 0;
        this.timer = setInterval(function () {
          i += 1;
          self.shown = self.text.slice(0, i);
          if (i >= self.text.length) { clearInterval(self.timer); self.timer = null; self.done = true; }
        }, Math.max(8, this.speed));
      },
      skip: function () {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        this.shown = this.text; this.done = true;
      }
    },
    template: [
      '<div :class="[\'bubble\', \'bubble--\'+side, \'bubble--\'+mood]"',
      '     :style="{\'--bub\': color}" @click="skip">',
      '  <span class="bubble__mood">{{ moodIcon }} {{ moodLabel }}</span>',
      '  <p class="bubble__text">{{ shown }}<i v-if="!done" class="bubble__caret"></i></p>',
      '  <svg class="bubble__tail" viewBox="0 0 24 18" aria-hidden="true">',
      '    <path d="M22 1 C10 3 6 9 1 17 C12 15 18 10 23 5 Z"/>',
      '  </svg>',
      '</div>'
    ].join('\n')
  };

  /* ------------------------------------------------------- 对白条（角色+气泡） */
  NS.components['dialogue-strip'] = {
    name: 'DialogueStrip',
    props: {
      lines: { type: Array, required: true },
      title: { type: String, default: '角色旁白' },
      autoplay: { type: Boolean, default: false }
    },
    data: function () { return { idx: 0, revealed: 1, playing: false, timer: null }; },
    computed: {
      chars: function () { return window.PAPER_DATA.characters; },
      visible: function () { return this.lines.slice(0, this.revealed); },
      current: function () { return this.lines[Math.min(this.revealed - 1, this.lines.length - 1)]; },
      atEnd: function () { return this.revealed >= this.lines.length; }
    },
    methods: {
      colorOf: function (who) { return (this.chars[who] || {}).color || '#4dd4c4'; },
      next: function () {
        if (this.revealed < this.lines.length) this.revealed += 1;
        else this.revealed = 1;
      },
      showAll: function () { this.revealed = this.lines.length; },
      reset: function () { this.revealed = 1; }
    },
    template: [
      '<div class="dlg">',
      '  <div class="dlg__head">',
      '    <span class="dlg__title">💬 {{ title }}</span>',
      '    <span class="dlg__count">{{ revealed }} / {{ lines.length }}</span>',
      '    <span class="dlg__spacer"></span>',
      '    <button class="btn btn--ghost btn--sm" @click="next">{{ atEnd ? \'↺ 从头再看\' : \'下一句 →\' }}</button>',
      '    <button class="btn btn--ghost btn--sm" @click="showAll" v-if="!atEnd">全部展开</button>',
      '  </div>',
      '  <transition-group name="dlgfade" tag="div" class="dlg__body">',
      '    <div v-for="(ln, i) in visible" :key="i"',
      '         :class="[\'dlg__row\', i % 2 ? \'dlg__row--alt\' : \'\']">',
      '      <div class="dlg__actor">',
      '        <cartoon-figure :who="ln.who" :mood="ln.mood" :size="112" :talking="i === revealed-1"/>',
      '      </div>',
      '      <speech-bubble :text="ln.text" :mood="ln.mood" :color="colorOf(ln.who)"',
      '                     :side="i % 2 ? \'right\' : \'left\'" :typing="i === revealed-1"/>',
      '    </div>',
      '  </transition-group>',
      '</div>'
    ].join('\n')
  };

  /* ------------------------------------------------- 悬浮小助手（页面右下角） */
  NS.components['mini-guide'] = {
    name: 'MiniGuide',
    props: { tip: { type: Object, required: true } },
    data: function () { return { open: true }; },
    computed: {
      chars: function () { return window.PAPER_DATA.characters; },
      color: function () { return (this.chars[this.tip.who] || {}).color || '#4dd4c4'; }
    },
    template: [
      '<div class="guide" :class="{ \'guide--closed\': !open }">',
      '  <transition name="guidefade">',
      '    <div class="guide__bubble" v-if="open" :style="{ \'--bub\': color }">',
      '      <button class="guide__x" @click="open=false" aria-label="收起">×</button>',
      '      <span class="guide__mood">{{ tip.mood === \'puzzle\' ? \'？疑惑\' : (tip.mood === \'insight\' ? \'！感悟\' : \'…思考\') }}</span>',
      '      <p>{{ tip.text }}</p>',
      '    </div>',
      '  </transition>',
      '  <button class="guide__avatar" @click="open = !open" :aria-label="open ? \'收起旁白\' : \'展开旁白\'">',
      '    <cartoon-figure :who="tip.who" :mood="tip.mood" :size="86"/>',
      '  </button>',
      '</div>'
    ].join('\n')
  };
})();
