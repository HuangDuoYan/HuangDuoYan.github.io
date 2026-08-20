/* =============================================================================
 * data.js — 全站内容数据层
 * 论文：Yuxin Kong, Peng Yang, Yan Cheng.
 *      "Edge-Assisted On-Device Model Update for Video Analytics in
 *       Adverse Environments." ACM MM '23, pp. 9051-9060.
 *
 * 数据来源标注约定：
 *   src: 'paper'  —— 论文正文/图中明确给出的数字或论断
 *   src: 'derived'—— 由论文给出的百分比/比例推算得到
 *   src: 'demo'   —— 为交互演示设定的示意参数（形式取自论文，数值非原文）
 * ========================================================================== */
window.PAPER_DATA = (function () {
  'use strict';

  /* ---------------------------------------------------------------- 论文元信息 */
  var meta = {
    title: 'Edge-Assisted On-Device Model Update for Video Analytics in Adverse Environments',
    titleCn: '边缘辅助的端侧模型更新：面向恶劣环境下的视频分析',
    authors: ['Yuxin Kong', 'Peng Yang*', 'Yan Cheng'],
    affiliation: '华中科技大学 (HUST)',
    venue: 'ACM MM 2023',
    pages: 'pp. 9051–9060',
    doi: '10.1145/3581783.3612585',
    keywords: ['Video analytics', 'Edge computing', 'Neural networks', 'Model update'],
    oneLine: '端侧只跑得动轻量模型，轻量模型在雨雪暗光下会崩；那就让边缘服务器"边看边补课"——但补课本身要花时间，而补完的课可能已经过期。',
    contradiction: '精度 ↔ 时效：重训练能换回精度，但重训练延迟会让新模型过期，于是精度收益被自己的延迟吃掉。',
    modules: [
      { name: 'Key Frame Extractor', where: '端 · 摄像头', job: '在带宽预算内挑出"最值得学"的帧' },
      { name: 'Trigger Controller', where: '边 · 服务器', job: '判断"现在到底该不该补课"' },
      { name: 'Retraining Manager', where: '边 · 服务器', job: '决定"补多久、用哪个老师"' }
    ]
  };

  /* ------------------------------------------------------------ 关键实验参数 */
  var params = [
    { k: 'β（低置信过滤阈值）', v: '0.4', src: 'paper' },
    { k: 'W_length（窗口长度）', v: '10 s', src: 'paper' },
    { k: 'τ₀（单次重训延迟上限）', v: '60 s', src: 'paper' },
    { k: 'e_min / e_max', v: '5 / 100 epochs', src: 'paper' },
    { k: 'n_min（最小帧数）', v: '50', src: 'paper' },
    { k: '教师模型集 M', v: 'Yolov5-s / m / l', src: 'paper' },
    { k: '学生模型', v: 'Yolov5-n + TensorRT', src: 'paper' },
    { k: 'Oracle 标注模型', v: 'Yolov5-X @ RTX 3080Ti', src: 'paper' },
    { k: '端设备', v: 'Jetson Nano / Jetson TX2', src: 'paper' },
    { k: '视频', v: '1920×1080 @ 30fps（YouTube 实采）', src: 'paper' },
    { k: '配置搜索耗时', v: '约 20 ms', src: 'paper' },
    { k: '场景', v: 'Low Light / Heavy Snow / Heavy Rain', src: 'paper' }
  ];

  /* ============================================================== 1 问题抽象 */
  var tensions = [
    {
      id: 'T1',
      axis: 'model capacity  ↔  inference latency',
      cn: '模型容量 ↔ 推理时延',
      pos: 0.12,
      color: '#4dd4c4',
      claim: '端侧算力是硬上限，重模型再准也进不去。',
      evidence: 'Yolov5-L 精度全程稳定并大幅领先所有轻量模型，但在 Jetson Nano 上延迟约为轻量模型的 6 倍，无法实时。',
      why: '这条轴决定了"端上只能是轻量模型"这一不可协商的前提，后面所有设计都建在它之上。',
      src: 'paper'
    },
    {
      id: 'T2',
      axis: 'specialization  ↔  generalization',
      cn: '场景特化 ↔ 泛化能力',
      pos: 0.3,
      color: '#7cc4ff',
      claim: '轻量模型只能靠"特化"换回精度，可特化就意味着不泛化。',
      evidence: 'GhostNet / ShuffleNet 类模型"在定制场景或良好条件下表现出色"，但受限于简化结构与参数量，在恶劣环境下精度骤降。',
      why: '把"提升泛化能力"这条路堵死了 —— 因为参数量就那么点。于是唯一出路是"持续换权重"，而不是"换架构"。',
      src: 'paper'
    },
    {
      id: 'T3',
      axis: 'adaptation cost  ↔  model freshness',
      cn: '适配开销 ↔ 模型时效（核心）',
      pos: 0.52,
      color: '#ffb454',
      claim: '这是全文的主矛盾：训得准，和训得及时，是同一份时间预算里的两个对手。',
      evidence: '"过长的重训练延迟可能让重训后的模型对不断变化的视频流而言已经过时"；因此设 τ₀ = 60s 硬约束，并在效用函数中用 U = A − ηT 给延迟定价。',
      why: '大多数论文把 latency 当作与 accuracy 并列的第二个指标；这篇把 latency 建成会"侵蚀"accuracy 收益的变量。指标的关系从"并列"变成"相乘/相减"，整个问题的形状就变了。',
      src: 'paper',
      core: true
    },
    {
      id: 'T4',
      axis: 'uplink bandwidth  ↔  data informativeness',
      cn: '上行带宽 ↔ 数据信息量',
      pos: 0.72,
      color: '#ff8fa3',
      claim: '重训数据必须上传，但带宽有限且波动；而"挑帧"这件事本身也要在端上花算力。',
      evidence: '"把所有帧都送到边缘服务器去筛选是带宽低效的"；因此必须在端上筛，而端上筛的代价必须可忽略。',
      why: '这里嵌套了一层自指约束：为了省带宽引入的筛选器，不能反过来吃掉端侧的实时性预算。',
      src: 'paper'
    },
    {
      id: 'T5',
      axis: 'responsiveness  ↔  edge resource waste',
      cn: '响应及时性 ↔ 边缘资源浪费',
      pos: 0.9,
      color: '#c79dff',
      claim: '触发得太勤浪费共享的边缘 GPU，太懒则长时间低精度。',
      evidence: '固定周期（AMS / Ekya 的 200s 窗口）响应不及时；固定阈值（JIT）在 Heavy Rain 下频繁触发。减少重训次数"能显著节省边缘服务器的算力"。',
      why: '一旦承认边缘是多摄像头共享的，"重训次数"本身就是一项一等成本，而不是免费的。',
      src: 'paper'
    }
  ];

  var bottleneck = {
    headline: '作者真正抓住的 bottleneck：目标函数在决策时不可观测，而决策本身有保质期。',
    bullets: [
      '要决定"用多少 epoch、多少帧、哪个老师"，可是"训完能有多准"只有训完才知道 —— 目标函数在决策时刻不可观测。',
      '要决定"什么时候触发"，可是"环境到底恶化了多少"没有标签可看 —— 状态在决策时刻不可观测。',
      '而且这两个决策都在与时间赛跑：慢一步，答案就作废。',
      '所以本文的技术主线不是"更强的模型"，而是"更便宜的可观测代理 + 更快的近似优化"。'
    ]
  };

  var priorWork = [
    {
      name: '模型压缩 / 特化',
      rep: 'GhostNet, ShuffleNet, NoScope, 模型特化',
      assume: '部署环境的数据分布与训练时一致（或可提前定制）。',
      fail: '恶劣环境是分布外输入：噪声增加、亮度改变、目标模糊，三者都直接破坏特征提取。',
      axis: 'T2'
    },
    {
      name: '固定周期持续学习',
      rep: 'AMS, Ekya（200s 固定重训窗口）',
      assume: '环境变化的时间尺度是已知且平稳的。',
      fail: '周期长 → 突变响应不及时；周期短 → 无谓重训，浪费边缘算力（Low Light 下 Ekya 的重训次数接近本文的两倍）。',
      axis: 'T5'
    },
    {
      name: '固定阈值触发',
      rep: 'JIT (Online Model Distillation)',
      assume: '存在一个跨场景通用的"精度合格线"。',
      fail: '不同场景难度不同，固定阈值在难场景里会疯狂触发、在易场景里又过于迟钝；且它"训到达标为止"，延迟不可控。',
      axis: 'T5'
    },
    {
      name: '在线 micro-profiling 选配置',
      rep: 'Ekya 的 micro-profiler',
      assume: '可以先花少量 epoch 试跑，把训练曲线画出来再决策。',
      fail: '为了省时间先花时间：profiler 占总运行时 27%（约 25s）；且在 Heavy Rain 这种难场景里，几个 epoch 根本无法收敛，画出的曲线是错的，导致输出配置更差。',
      axis: 'T3'
    },
    {
      name: '全流卸载 / 云端推理',
      rep: '把视频持续传给边缘或云端做推理',
      assume: '带宽充足且稳定。',
      fail: '对带宽波动最脆弱，实测精度下降可达 10%；云端还叠加不可接受的响应延迟。',
      axis: 'T4'
    },
    {
      name: '端侧重训',
      rep: '直接在摄像头上做持续学习',
      assume: '端设备能承担训练开销。',
      fail: '训练算力远高于推理，且需要大教师模型产生 groundtruth —— 端侧两样都给不了。',
      axis: 'T1'
    }
  ];

  /* ============================================================ 2 技术推导链 */
  var chain = [
    {
      id: 'L1',
      layer: '第 0 层 · 需求',
      question: '摄像头要在雨雪 / 暗光下保持实时且准确的目标检测。',
      naive: '把最强的模型直接放到摄像头上：用 Yolov5-L。',
      fail: '在 Jetson Nano 上，Yolov5-L 的单帧延迟约为轻量模型的 6 倍，完全无法实时。',
      constraint: 'C1 · 端侧推理必须使用轻量模型（算力硬上限，不可协商）。',
      tech: '选定 Yolov5-n 作为端侧学生模型，并用 TensorRT 加速。',
      newProblem: '轻量模型在恶劣环境下还准吗？',
      tag: 'capacity',
      figure: 'fig02b_latency_accuracy'
    },
    {
      id: 'L2',
      layer: '第 1 层 · 换更好的轻量模型？',
      question: '既然只能轻量，那就用 SOTA 的轻量骨干。',
      naive: '把 Yolo 骨干换成 GhostNet / ShuffleNet，保留 Yolo 检测头。',
      fail: '动机实验（320s 视频，第 170s 起突降大雪）显示：所有轻量模型在 t≈270s 出现精度骤降，平均精度明显损失。换架构救不回来 —— 因为参数量与结构的表达能力就那么点。',
      constraint: 'C2 · 静态权重无法覆盖分布外环境 → 出路是在线换"参数"，不是换"架构"。',
      tech: '引入持续学习：用大教师模型的知识，把学生模型在当前场景上"补课"（知识蒸馏）。同时做了一个 Ideal Retrain 上界实验（穷举最优配置、且假装重训不花时间），先量出天花板。',
      newProblem: '重训需要算力和 groundtruth 标签，谁来出？',
      tag: 'drift',
      figure: 'fig02a_accuracy_curve',
      insight: '这个"理想上界"实验是全文最关键的一次方法论动作：先证明"有多少收益可捞"，后面每一个工程妥协才有量化预算。'
    },
    {
      id: 'L3',
      layer: '第 2 层 · 谁来重训？',
      question: '在哪里执行重训练？',
      naive: '就在摄像头上做端侧持续学习。',
      fail: '训练开销远大于推理；而且 groundtruth 需要一个大模型来产生 —— 资源受限的端设备两样都提供不了。',
      constraint: 'C3 · 计算必须分层：端做推理，边做重训与标注。',
      tech: '端-边协同架构：学生模型在端推理；边缘服务器上 Oracle 模型（Yolov5-X）打标签、执行蒸馏重训、把新权重回传。相比云端，边缘带宽消耗更小、响应更快。',
      newProblem: '训练数据必须从端传到边 —— 上行带宽立刻变成新的瓶颈。',
      tag: 'split',
      figure: 'fig03_system_overview'
    },
    {
      id: 'L4',
      layer: '第 3 层 · 传什么数据？',
      question: '把哪些帧送到边缘去当训练样本？',
      naive: '全传：把整段视频（或整窗所有帧）送到边缘，让算力充足的边缘去筛。',
      fail: '1920×1080@30fps 全传是带宽灾难，且上行带宽本身在波动；实测这种"朴素全流卸载"策略对带宽最敏感，精度可掉 10%。',
      constraint: 'C4 · 必须在端侧筛帧；而且筛选器自身的开销必须远小于推理，否则会吃掉实时性。',
      tech: 'Key Frame Extractor，两步级联：① 复用学生推理已经算出的置信度，取"低置信目标占比 L_i > β"的帧（对训练有用的帧 = 模型现在还预测不好的帧，因为只有预测与真值有差异时参数才会更新）；② 对第①步的子集算帧差，按差异从大到小取 top-C，C 由当前上行带宽 B_up 决定。',
      newProblem: '有了"传什么"，但还不知道"什么时候要重训"。',
      tag: 'bandwidth',
      sim: 'keyframe',
      insight: '两步的顺序不能交换。置信度是推理的免费副产品（零额外前向），帧差要真算像素；先用免费的把候选集从 |F| 缩到 |S|，再让付费的只在 S 上跑 —— 论文原话是"计算量可以大幅削减"。这是端侧算力账本逼出来的排序。'
    },
    {
      id: 'L5',
      layer: '第 4 层 · 什么时候重训？',
      question: '如何决定触发时机？',
      naive: 'A：固定周期更新（AMS / Ekya 用 200s 窗口）。B：固定精度阈值，掉到线下就训（JIT）。',
      fail: 'A：周期大 → 突变响应慢；周期小 → 无谓重训，浪费共享的边缘 GPU。B：一个固定阈值无法适配难度不同的场景 —— Heavy Rain 下会频繁触发，Low Light 下又太钝。',
      constraint: 'C5 · 阈值必须相对"这台摄像头自己的历史水平"自适应，并且要对精度的正常抖动免疫。',
      tech: 'Trigger Controller：对历史窗口精度做指数衰减加权，得到 μ_{i<j}（越近的窗口权重越大，以跟踪非平稳环境）；再用历史标准差 σ_{i<j} 划出"正常波动带"。当 μ_{i<j} − σ_{i<j} > a_j 时才触发。',
      newProblem: '没触发的那些窗口的数据白传了吗？以及：触发之后，用多少资源训？',
      tag: 'trigger',
      sim: 'trigger',
      insight: 'σ 这一项是"防误报"的：它承认轻量模型的精度本身就在抖，只有跌出自身抖动范围才算"环境真的变了"。这在统计上就是一张控制图。'
    },
    {
      id: 'L6',
      layer: '第 5 层 · 已传数据的复用',
      question: '未触发窗口的帧和标签怎么处理？',
      naive: '丢掉，下次重训再重新采集。',
      fail: '这些帧的传输成本和 Oracle 标注成本已经付过了，丢掉等于重复付费；而且单窗数据量太小，重训容易过拟合。',
      constraint: 'C6 · 已付出的成本必须复用（reuse before recompute）。',
      tech: 'Buffer：未触发窗口的（关键帧, groundtruth）留在边缘缓存，下次触发时与当前窗口数据一起用于重训，重训后清空。由此延迟模型里的"传输"和"标注"两项只统计触发窗口，Buffer 中的历史数据不再计费。',
      newProblem: '训练集变大了，那到底训多少 epoch、用几帧、找哪个老师？',
      tag: 'reuse'
    },
    {
      id: 'L7',
      layer: '第 6 层 · 训多久？',
      question: '如何选择重训配置 (e, n, m)？',
      naive: '训到收敛 / 训到达到目标精度为止（JIT 的策略）。',
      fail: '延迟不可控，模型过期风险直接上升；而且实测精度-延迟是边际收益递减的：时间成本大幅上升，精度只有微小改善。',
      constraint: 'C7 · 必须为"时效"显式定价，并给总延迟一个硬上限 τ₀ = 60s。',
      tech: '效用函数 U_k = A_k − η_k·T_k。其中 T_k 拆成四段可测延迟：① 传输 d₀|S^Γ_k|/B_up ② 标注 t₀|S^Γ_k| ③ 训练 e_k·n_k·t(m_k) ④ 权重回传 M₀/B_down。η_k 是"紧急度"，直接取触发窗口里低置信帧的比例 |S̃^Γ_k|/|F| —— 环境越糟，η 越大，延迟惩罚越重，系统就自动选更快的配置。',
      newProblem: 'A_k 和 T_k 在训练前都不可知，怎么算 U_k？',
      tag: 'utility',
      insight: 'η 的妙处有两层：一是它把"精度/延迟的权衡系数"本身做成了随环境自适应的；二是它复用了 Key Frame Extractor 第①步已经算好的中间量，零额外开销。同一个中间量被用了两次。'
    },
    {
      id: 'L8',
      layer: '第 7 层 · 目标函数不可观测',
      question: '还没训，怎么知道会有多准、要多久？',
      naive: '在线试跑几个 epoch 把训练曲线画出来（Ekya 的 micro-profiler）。',
      fail: 'profiler 自己就占总运行时的 27%（约 25s）；更糟的是在难场景里几个 epoch 无法收敛，profile 出的曲线是错的，反而选出更差的配置。',
      constraint: 'C8 · 决策所需的"预测"必须几乎免费，且必须在决策时刻已经可用。',
      tech: '离线 profiling + 参数化代理模型：把三维配置压成"计算量 e·n"这一个标量，于是 —— 训练延迟对 e·n 近似线性（R² = 0.979，斜率 t(m) 随教师模型变化）；精度对 e·n 是饱和指数 A = 0.9194 − 0.3218·e^(−9.9692·e·n)。两条曲线离线拟合一次，在线只做闭式求值。',
      newProblem: '有了闭式目标，但这是个 MILP，怎么解？',
      tag: 'proxy',
      figure: 'fig05_linear_latency',
      figure2: 'fig07_accuracy_fit',
      insight: '整篇论文最漂亮的一步是这次降维：(e, n, m) → (e·n, m)。因为"训练做了多少计算"才是真正驱动延迟与精度的物理量，epoch 和帧数只是它的两个因子。找到这个标量之后，两个不可观测的量同时变成了可拟合的一维曲线。'
    },
    {
      id: 'L9',
      layer: '第 8 层 · 优化本身太贵',
      question: '如何在毫秒级解出配置？',
      naive: '穷举所有 (e, n, m) 组合，甚至联合优化全部 K 次重训。',
      fail: '复杂度 O(K·|M|·|S_k|·e_max)，实践中不可行；而且未来窗口何时触发本身不可知，联合优化在信息上也无从下手。',
      constraint: 'C9 · 决策延迟必须小到可以在延迟模型里被忽略。',
      tech: '两次让步：① 解耦 —— 不联合优化 K 次，每次触发独立求解；② 用带 Metropolis 准则的随机扰动搜索（模拟退火思想）：邻域由 e、n 的有界随机步与 m 的随机选择定义，配 max_iter / max_fail 早停。实测约 20ms 完成，因此可以正当地从延迟模型中省略。',
      newProblem: '选出了 n* 帧，具体用哪 n* 帧？',
      tag: 'search',
      sim: 'retrain',
      insight: '"最优"的时间价值可以是负的：一个迟到的最优配置，其对应的模型已经过期了。作者敢于接受次优解，是因为他已经把"过期"写进了目标函数。'
    },
    {
      id: 'L10',
      layer: '第 9 层 · 闭环',
      question: '训练集选哪些帧？系统怎么收尾？',
      naive: '随机采样，或者用全部缓存帧。',
      fail: '越老的帧越不代表"当前"环境，用老帧训出来的模型对当下无效。',
      constraint: 'C10 · 数据的时间局部性优先。',
      tech: '取最近的 n* 帧作为训练集；重训完成后把权重回传，端侧模型热更新。更新后的学生模型会改变置信度分布 → 改变关键帧选择 → 改变紧急度 η → 影响下一轮触发。整个系统闭环。',
      newProblem: '闭环已成。剩下的问题交给评测与未来工作（如把编码过程纳入以进一步压缩带宽）。',
      tag: 'loop'
    }
  ];

  /* ========================================================== 3 技术结构映射 */
  var mappings = [
    {
      module: '低置信度筛帧（Step 1）',
      structure: 'Uncertainty Estimation / Active-Learning Acquisition + Cascade Filtering',
      abstraction: '"哪些帧对重训有价值" 被抽象成 "当前模型对哪些帧不确定"。',
      why: '训练只在预测与真值有差异时更新参数，所以"模型自己不确定的样本"就是梯度的来源 —— 这正是主动学习里的 uncertainty sampling。而置信度是推理的副产品，天然零成本，于是它同时充当了级联过滤器的第一级（cheap-first）。',
      classic: ['active learning', 'uncertainty sampling', 'cascade / early filtering'],
      icon: 'filter'
    },
    {
      module: '帧差 + top-C 选择（Step 2）',
      structure: 'Budgeted Top-K Selection（退化的 0/1 Knapsack）',
      abstraction: '"在带宽预算内选一组最有信息量的帧" 被抽象成 "等体积物品的背包"。',
      why: '每帧的数据量近似相同（同分辨率同编码），于是 0/1 背包退化为"按价值排序取前 C 个"，O(n log n) 排序即可替代 DP。价值函数用帧间差异作为多样性/非冗余性的代理。认出这一退化，是把 NP-hard 变成排序的关键。',
      classic: ['knapsack', 'top-K selection', 'submodular diversity (近似)'],
      icon: 'budget'
    },
    {
      module: 'Trigger Controller：μ − σ > a_j',
      structure: 'Statistical Process Control / EWMA Control Chart / Change-Point Detection',
      abstraction: '"环境是否发生了变化" 被抽象成 "精度时间序列是否越出了它自身的正常波动带"。',
      why: '指数衰减加权正是 EWMA（对非平稳序列跟踪最新水平），σ 正是控制限（区分"真实漂移"与"随机抖动"）。一旦翻译成控制图，"自适应阈值"就不再是启发式，而是有统计含义的越界检验 —— 并且免费继承了控制图对误报率的直觉。',
      classic: ['control chart', 'EWMA', 'drift detection'],
      icon: 'chart'
    },
    {
      module: 'Buffer（未触发窗口的帧与标签）',
      structure: 'Replay Buffer / Memory Bank + Cache Reuse',
      abstraction: '"已经付过传输与标注成本的数据" 被抽象成 "缓存条目"。',
      why: '这是 reuse-before-recompute 的直接应用：缓存命中的部分不再计入延迟模型的 Part 1/2。它同时顺手解决了另一个问题 —— 单窗样本太少、重训容易过拟合。',
      classic: ['replay buffer', 'caching', 'memory bank'],
      icon: 'buffer'
    },
    {
      module: 'A(e·n) 与 T(e·n, m) 的离线拟合',
      structure: 'Surrogate Model / Optimization Proxy（Predict-then-Optimize）',
      abstraction: '"训完才知道的黑箱结果" 被抽象成 "一条离线标定好的参数曲线"。',
      why: '在线优化的前提是目标函数可求值。作者用饱和指数拟合精度、用线性拟合延迟（R²=0.979），把黑箱换成闭式，于是优化从"要试跑"变成"要算术"。这是 predict-then-optimize 范式的教科书式落地。',
      classic: ['surrogate model', 'predict-then-optimize', 'offline profiling'],
      icon: 'curve'
    },
    {
      module: 'U = A − η·T 与 τ₀ 约束',
      structure: 'Constrained Optimization + Deadline-Aware Value Discounting',
      abstraction: '"新模型会不会过期" 被抽象成 "延迟的价格 + 一条硬 deadline"。',
      why: '精度和延迟不同量纲，必须有定价机制才能比较；η 就是这个价格，而且它随环境恶化程度自适应。τ₀ 则是"再便宜也不能超时"的硬边界。软定价 + 硬约束的组合，是实时系统里最常见也最稳的建模方式。',
      classic: ['Lagrangian pricing', 'deadline scheduling', 'constrained optimization'],
      icon: 'scale'
    },
    {
      module: 'η = 低置信帧比例',
      structure: 'Observable Proxy for Hidden State / Adaptive Control Gain',
      abstraction: '"环境恶化了多少（无标签、不可观测）" 被抽象成 "学生模型有多少帧看不懂"。',
      why: '真正的"环境恶化幅度"需要 groundtruth 才能量化，但决策必须在标注之前做出。作者用模型自身的困惑程度作代理 —— 便宜、即时、且与目标单调相关。这是控制论里"用可测量替代不可测量"的经典手法。',
      classic: ['proxy variable', 'adaptive gain', 'self-assessment'],
      icon: 'gauge'
    },
    {
      module: 'Algorithm 2：Metropolis 扰动搜索',
      structure: 'Simulated Annealing / Metaheuristic on a Small Discrete Space',
      abstraction: '"MILP 的次优解" 被抽象成 "小离散空间里的随机游走 + 早停"。',
      why: '搜索空间小、目标函数闭式可评估、且要求毫秒级 —— 这正是元启发式的最佳区间：不需要梯度、不需要训练 RL、不需要凸性。用 Metropolis 准则允许暂时变差，是为了跳出 A(e·n) 饱和段造成的平坦局部区域。',
      classic: ['simulated annealing', 'metaheuristic', 'problem decoupling'],
      icon: 'search'
    },
    {
      module: '教师模型 m 作为可调旋钮',
      structure: 'Configuration-Knob Adaptation（Chameleon / VideoStorm 家族）',
      abstraction: '"用哪个老师" 从超参被提升为 "运行时资源旋钮"。',
      why: '教师模型同时改变精度曲线的上限和延迟曲线的斜率 t(m)，因此它在 (A, T) 平面上是一个真正的 trade-off 维度，而不是一个"调好就固定"的设计选择。把设计选择 knob 化，是配置自适应类系统的标准动作。',
      classic: ['configuration adaptation', 'knob tuning'],
      icon: 'knob'
    },
    {
      module: '端推理 / 边重训的切分',
      structure: 'Hierarchical Two-Tier Offloading',
      abstraction: '流水线按"计算强度 × 数据量 × 时延敏感度"切开。',
      why: '推理：时延敏感、数据量大（每帧都要）→ 留在端。重训：计算密集、数据量小（只要关键帧）→ 放到边。切分线正好落在"数据量骤减"的位置，这不是巧合，而是 Key Frame Extractor 制造出来的。',
      classic: ['offloading', 'pipeline partitioning'],
      icon: 'split'
    },
    {
      module: '知识蒸馏',
      structure: 'Teacher–Student Distillation',
      abstraction: '"让小模型快速获得新知识" 被抽象成 "从大模型迁移软标签"。',
      why: '端侧模型容量小、可用样本少、时间预算紧，从头学不可能；蒸馏让它在少量数据、少量 epoch 内吸收教师的场景知识。这也解释了为什么"教师"能成为旋钮。',
      classic: ['knowledge distillation'],
      icon: 'teach'
    }
  ];

  /* ====================================================== 4 隐藏约束与系统意识 */
  var hidden = [
    {
      id: 'h1',
      title: '筛选器自身的计算开销',
      ordinary: '用光流、显著性网络或额外的小模型来挑帧 —— 反正"挑帧"听起来很便宜。',
      paper: '只用推理已产生的置信度（零额外前向），且把帧差计算严格排在过滤之后，只在子集上算。论文明确强调"计算量可以大幅削减"，因此"low-cost，可在端相机上实现"。',
      level: 3,
      tag: 'on-device cost'
    },
    {
      id: 'h2',
      title: '上行带宽是波动的硬约束',
      ordinary: '假设网络够用，或只在实验里用一个固定带宽。',
      paper: '可传帧数 C 由"当前"可用上行带宽 B_up 现算；并专门做了 20–100 Mbps 的带宽扫描：本文只掉 5% 精度，而朴素全流卸载掉 10%。',
      level: 3,
      tag: 'bandwidth'
    },
    {
      id: 'h3',
      title: '模型时效性（staleness）',
      ordinary: '把重训延迟当成一个需要报告的性能数字。',
      paper: '把延迟建成会侵蚀精度收益的量：软定价 η·T + 硬上限 τ₀ = 60s。原文点明"更长的重训时间也提高了模型过期的风险"。',
      level: 4,
      tag: 'freshness',
      core: true
    },
    {
      id: 'h4',
      title: '边缘 GPU 是共享资源，重训次数本身是成本',
      ordinary: '只报告精度，不在意触发了多少次。',
      paper: '专门用一张图比较重训次数，并指出减少重训"能显著节省边缘服务器的算力" —— 这是多摄像头共享边缘时的资源竞争意识。',
      level: 3,
      tag: 'resource contention'
    },
    {
      id: 'h5',
      title: '在线 profiling 的自反成本',
      ordinary: '为了做决策先测量，测量成本不计入端到端延迟。',
      paper: '明确指出 Ekya 的 micro-profiler 占总运行时 27%（约 25s），并把这笔账搬到离线。"为了省时间而先花时间"这个悖论被正面处理。',
      level: 4,
      tag: 'meta-cost',
      core: true
    },
    {
      id: 'h6',
      title: 'Oracle 标注延迟',
      ordinary: '默认标签是现成的。',
      paper: '标注是延迟模型的 Part 2：t₀·|S^Γ|，实测占总时间 5.2%。',
      level: 2,
      tag: 'labeling'
    },
    {
      id: 'h7',
      title: '权重回传延迟',
      ordinary: '忽略不计。',
      paper: '写进模型：M₀/B_down，实测只占 0.8% —— 但它被显式建模了。愿意为 0.8% 写一项，说明作者是端到端记账的。',
      level: 2,
      tag: 'downlink'
    },
    {
      id: 'h8',
      title: '避免重复计费',
      ordinary: '每次重训都重新统计全部数据的传输与标注成本。',
      paper: 'Buffer 里的历史帧已经付过传输与标注费，因此延迟模型的 Part 1/2 只统计触发窗口 W^Γ_k。账要算对。',
      level: 3,
      tag: 'accounting'
    },
    {
      id: 'h9',
      title: '决策算法自身的延迟',
      ordinary: '优化器耗时不提。',
      paper: '先实测配置搜索约 20ms，再据此论证"可以从延迟模型中省略"。省略是被验证过的，不是被假设的。',
      level: 3,
      tag: 'solver cost'
    },
    {
      id: 'h10',
      title: '精度的自然抖动会造成误触发',
      ordinary: '精度一掉就触发。',
      paper: '用历史标准差 σ 划出正常波动带，只有跌破 μ − σ 才算真的变差。承认噪声的存在，是控制类设计的成熟标志。',
      level: 3,
      tag: 'false positive'
    },
    {
      id: 'h11',
      title: '异构端设备',
      ordinary: '只在一种硬件上验证。',
      paper: 'Jetson Nano 与 Jetson TX2 两种算力档位同时接入同一边缘服务器，说明设计不绑定单一硬件。',
      level: 2,
      tag: 'heterogeneity'
    },
    {
      id: 'h12',
      title: '非平稳性的"强度"是一个评测维度',
      ordinary: '把"恶劣天气"当作一个二元条件。',
      paper: '按变化速率排列三种场景：Low Light（最平缓）→ Heavy Snow → Heavy Rain（最剧烈），并逐场景分析各方法为何失效。评测的是"漂移速率"，不是"天气类别"。',
      level: 4,
      tag: 'non-stationarity',
      core: true
    },
    {
      id: 'h13',
      title: '训练数据的时间局部性',
      ordinary: '从缓存里随机采样 n 帧。',
      paper: '取最近的 n* 帧，因为"这些帧更能指示当前环境状况"。与 μ 的指数衰减、与 η 的即时估计，是同一个"重视当下"的价值取向。',
      level: 2,
      tag: 'recency'
    }
  ];

  /* ============================================================ 5 设计模式 */
  var patterns = [
    {
      name: '离线-在线解耦',
      en: 'offline–online decoupling',
      inPaper: '把 A(e·n)、t(m) 的标定全部放到离线，在线只做闭式求值与 20ms 搜索；正面替代 Ekya 的在线 micro-profiler。',
      transfer: ['数据库 knob 自动调优（离线代价模型 + 在线选择）', '视频码率自适应 ABR', '编译器/算子自动调优（离线 cost model）', 'LLM 推理的调度参数预标定'],
      strength: 4
    },
    {
      name: '先复用再重算',
      en: 'reuse before recompute',
      inPaper: '置信度复用推理副产品；Buffer 复用已传输已标注的帧；η 复用 Step 1 的中间量。同一份计算被用了两次甚至三次。',
      transfer: ['LLM 服务的 KV-cache / prefix 复用', '增量编译与增量渲染', '视频分析的跨帧结果复用', '联邦学习的历史梯度复用'],
      strength: 4
    },
    {
      name: '廉价优先的级联',
      en: 'cascade / cheap-first filtering',
      inPaper: '先做零成本的置信度阈值过滤，再做需要算像素的帧差 —— 顺序不可交换。',
      transfer: ['检索系统的粗排→精排', 'RAG 的 retrieve-then-rerank', '早退网络 / 级联分类器', '数据库的谓词下推与选择率排序'],
      strength: 4
    },
    {
      name: '重要性驱动的计算',
      en: 'importance-driven computation',
      inPaper: '"模型看不懂的帧"才值得传、才值得训；算力只花在信息密度高的地方。',
      transfer: ['hard-example mining / 主动学习', '数据集蒸馏与样本剪枝', '稀疏注意力与 token 剪枝', 'ROI 编码与感兴趣区域传输'],
      strength: 4
    },
    {
      name: '先预测再优化',
      en: 'predict-then-optimize（with surrogate）',
      inPaper: '两条离线拟合曲线把不可观测的 (A, T) 变成闭式，随后才谈优化。',
      transfer: ['集群调度器的性能预测 + 放置决策', 'AutoML 的代理评估', '网络拥塞控制中的带宽预测 + 速率决策', '编译优化的收益预测'],
      strength: 4
    },
    {
      name: '为隐状态找可观测代理',
      en: 'observable proxy for hidden state',
      inPaper: 'η 用低置信帧比例代理"环境恶化程度"；帧差代理"信息多样性"。',
      transfer: ['无标签漂移检测（用熵/置信度）', 'SLO 违约的前兆指标', '推荐系统的兴趣漂移信号', '模型上线后的静默失效监控'],
      strength: 4
    },
    {
      name: '用自身统计量做自适应阈值',
      en: 'adaptive thresholding via self-statistics',
      inPaper: 'μ − σ > a_j：阈值来自这台设备自己的历史均值与标准差，而不是一个全局常数。',
      transfer: ['异常检测与告警抑制', '自动扩缩容触发条件', 'A/B 实验的显著性护栏', '各类 drift detection'],
      strength: 3
    },
    {
      name: '配置空间降维',
      en: 'dimension collapsing to a physical scalar',
      inPaper: '(e, n) → e·n（总计算量）。两个不可观测量因此同时变成一维可拟合曲线。',
      transfer: ['把 batch×seq 压成 token 数来预测显存/延迟', '把分辨率×帧率压成像素吞吐', '把并行度×步数压成总 FLOPs', '任何"高维旋钮 + 需要拟合"的场景'],
      strength: 5,
      star: true
    },
    {
      name: '对时效性折价',
      en: 'deadline-aware value discounting',
      inPaper: 'U = A − η·T 加 τ₀ 硬上限：迟到的精度不值钱，太迟的直接违法。',
      transfer: ['实时推理的 deadline 调度', 'AR/VR 的帧预算分配', '自动驾驶感知的时效约束', '实时风控的决策时限'],
      strength: 4
    },
    {
      name: '把序列决策解耦成独立事件',
      en: 'event-driven decoupling',
      inPaper: '不联合优化 K 次重训，而是每次触发独立求一次次优解 —— 因为未来何时触发本就未知，联合优化没有信息基础。',
      transfer: ['在线算法而非 MDP/RL 化', '贪心 + 局部搜索代替全局规划', '流式系统的逐批决策'],
      strength: 3
    },
    {
      name: '把设计选择 knob 化',
      en: 'knob-ization of design choices',
      inPaper: '教师模型从"选定就固定的超参"变成运行时可调旋钮，因为它同时改变 A 的上限与 T 的斜率。',
      transfer: ['推理精度（FP16/INT8）作为运行时旋钮', '检索深度 top-k 作为运行时旋钮', '模型级联深度作为运行时旋钮'],
      strength: 3
    },
    {
      name: '端-边闭环协同设计',
      en: 'closed-loop end–edge co-design',
      inPaper: '端筛帧 → 边判断 → 边重训 → 权重回传 → 端推理，更新后的置信度又改变下一轮筛帧与 η。闭环。',
      transfer: ['联邦学习的客户端选择闭环', '车路协同感知', '数据飞轮 / 持续学习流水线'],
      strength: 4
    }
  ];

  /* ========================================================== 6 该学到什么 */
  var lessons = [
    {
      n: 1,
      title: '先用测量把"矛盾"钉死，再谈设计',
      body: '动机实验的作用不是"证明问题存在"，而是为后面每一处工程妥协设定量化预算。作者给出的是：延迟差 6 倍、雪后精度掉多少、以及最关键的 Ideal Retrain 上界。',
      action: '写论文时的第一个实验，应该是"理想上界"实验：假装没有成本，先量出天花板有多高。如果天花板很低，这个方向本身就不该做。'
    },
    {
      n: 2,
      title: '把每一个技术都当成"某个约束的产物"',
      body: '本文每个模块都能回答一句话："如果没有我，哪条约束会被违反？" Key Frame Extractor 对应带宽与端侧算力，Trigger Controller 对应边缘算力与响应性，Retraining Manager 对应时效性。',
      action: '自查方法：删掉你的某个模块，说出被违反的是哪条约束。如果说不出来，那个模块大概是为了"看起来复杂"而存在的。'
    },
    {
      n: 3,
      title: '持续下钻成本，直到它可以被忽略',
      body: '筛选器要便宜 → 复用置信度 + 先过滤后算差；决策要便宜 → 20ms；预测要便宜 → 搬到离线。顶会深度的一个可操作定义：你把"开销"这个问题追问到了第几层。',
      action: '每加一个组件就问三句：它欠多少延迟？欠多少带宽？欠多少算力？然后当场把账还上，或者证明它可忽略。'
    },
    {
      n: 4,
      title: '好系统论文的一半功夫在"找代理"',
      body: '置信度代理"信息量"，低置信比例代理"环境恶化程度"，帧差代理"多样性"，e·n 代理"计算量"。四个代理都满足两个条件：几乎免费，且与目标单调相关。',
      action: '当你发现"我需要的量测不到"时，不要放弃，去找一个"便宜且相关"的替身 —— 这通常就是论文的创新点所在。'
    },
    {
      n: 5,
      title: '降维，是让"不可拟合"变成"可拟合"的钥匙',
      body: '(e, n, m) 三维空间里，精度和延迟都是黑箱。压成 (e·n, m) 之后，一条线性、一条饱和指数，两次离线拟合全部解决。因为 e·n 才是驱动它们的物理量。',
      action: '面对高维配置空间，先问："真正驱动结果的物理量是什么？"往往它的维度比旋钮的维度低得多。'
    },
    {
      n: 6,
      title: '该解耦就解耦；"最优"的时间价值可以是负的',
      body: 'K 次重训不联合优化（因为未来不可知），MILP 不求精确最优（因为迟到的最优等于错误）。作者敢于接受次优，前提是他已经把"过期"写进了目标函数。',
      action: '在做近似之前，先把"近似造成的损失"和"求精确解造成的延迟损失"放进同一个目标函数比较。否则你无法理直气壮地近似。'
    },
    {
      n: 7,
      title: '把系统做成闭环，并给每条边记账',
      body: '延迟四分解 7.8% / 5.2% / 86.2% / 0.8% —— 这组数字的价值不在于漂亮，而在于它证明作者端到端地想过每一条边，包括那条只占 0.8% 的。',
      action: '画出你的系统图，给每条箭头标上"延迟 / 带宽 / 算力"三个数字。空着的箭头就是你没想清楚的地方。'
    },
    {
      n: 8,
      title: '让每个 baseline 对准一个设计维度',
      body: 'NR 问"要不要更新"，OTR（= 去掉 Trigger Controller）问"要不要自适应触发"，JIT 问"固定阈值 vs 自适应阈值"，Ekya 问"在线 profiling vs 离线代理 + 带宽意识"。四个 baseline 就是四次消融。',
      action: '设计实验时，先列出你的设计维度，再为每个维度找（或构造）一个恰好只在该维度上不同的对照组。'
    }
  ];

  /* ============================================================== 7 反向审阅 */
  var critiques = [
    {
      title: 'Oracle 也会错：伪标签噪声未被讨论',
      body: 'Yolov5-X 在暴雨/暗光下同样会漏检误检，但全文把它的输出当作 groundtruth，既用于重训也用于精度评估与触发判据。一旦 Oracle 在恶劣环境下系统性偏差，触发信号和训练目标会同时被污染。',
      open: '如何在教师本身不可靠时做持续学习？（教师集成、置信度加权蒸馏、一致性正则）'
    },
    {
      title: '离线拟合曲线的跨场景可迁移性',
      body: 'A = 0.9194 − 0.3218·e^(−9.9692·e·n) 是离线标定的。但 Heavy Rain 与 Low Light 的收益曲线是否共享同一组参数？如果不共享，那么"离线代理"就把 Ekya 的在线成本换成了离线的场景覆盖成本。',
      open: '代理模型的在线自校正（用每次真实重训的结果反过来更新曲线参数）。'
    },
    {
      title: '灾难性遗忘与环境回摆',
      body: 'Buffer 每次重训后清空，训练集只取最近 n* 帧 —— 这是彻底的"重视当下"。但天气会回摆：雪停之后，被特化到雪天的模型在正常场景下表现如何？文中没有这类"恢复"实验。',
      open: '多环境模型库 + 快速检索复用（RECL 思路），或参数隔离/正则化以抵抗遗忘。'
    },
    {
      title: '单摄像头视角下的多路调度缺口',
      body: '文中已有"减少重训次数以节省边缘算力"的意识，但只做到"少触发"，没有建模多摄像头同时触发时的排队、抢占与公平性。而这恰恰是边缘部署的常态。',
      open: '把 K 次重训的解耦重新耦合起来 —— 但耦合的是跨摄像头的资源竞争，而不是同一摄像头的时间序列。'
    },
    {
      title: '帧差在雨雪噪声下可能失真',
      body: '帧差衡量像素级变化，而雨雪本身就是高频随机像素变化。在 Heavy Rain 场景中，帧差的最大值可能由噪声而非目标运动主导，"最有代表性的帧"就可能选错。',
      open: '换用对噪声更鲁棒的多样性度量（特征空间距离、结构相似度）而仍保持端侧可算。'
    },
    {
      title: 'η 与"精度实际下降幅度"未必单调',
      body: '紧急度用低置信帧比例代理，但"置信度低"与"精度掉得多"之间只有相关性，没有保证的单调关系。可以构造出置信度整体偏低而 F1 仍可接受的场景（例如小目标密集）。',
      open: '代理变量的保真度分析：给出代理与真值之间的误差界，或至少给出相关性的实测。'
    }
  ];

  /* ============================================================== 卡通角色 */
  var characters = {
    huo: {
      key: 'huo', name: '小惑', role: '一年级研究生',
      color: '#4dd4c4', accent: '#2aa393',
      motto: '每读一段就想问"为什么不能更简单一点"'
    },
    yan: {
      key: 'yan', name: '老衍', role: '方法论导师',
      color: '#ffb454', accent: '#d9881f',
      motto: '技术是被约束逼出来的，不是被想出来的'
    },
    wu: {
      key: 'wu', name: '阿悟', role: '端侧摄像头 · 当事人',
      color: '#c79dff', accent: '#8d5fd3',
      motto: '我算力小，但我知道账该怎么算'
    }
  };

  /* 每一节的对白：疑惑 → 思考 → 感悟 */
  var dialogues = {
    hero: [
      { who: 'huo', mood: 'puzzle', text: '等等……摄像头明明一直在好好地跑 YOLO，为什么一下雪就"看不见"车了？模型又没被雪淋湿呀。' },
      { who: 'yan', mood: 'think', text: '它不是瞎了，是"没见过"。雪把画面的噪声、亮度和清晰度全改了 —— 输入分布变了，而权重还是旧的。' },
      { who: 'wu', mood: 'insight', text: '所以这篇论文真正的对手不是天气，而是"分布漂移"和"端侧算力不够"这两堵墙夹出来的那道窄缝。' }
    ],
    s1: [
      { who: 'huo', mood: 'puzzle', text: '那把最强的 Yolov5-L 搬到我身上不就完了？它精度全程都很稳啊。' },
      { who: 'wu', mood: 'puzzle', text: '……我只是一台 Jetson Nano。那玩意儿在我这儿要慢 6 倍，实时性一破，精度再高也没人要了。' },
      { who: 'yan', mood: 'think', text: '这就是第一条张力轴。于是路被逼成了"轻量模型 + 在线补课"。可你马上会撞上第三条轴 —— 补课要时间，而补出来的模型是有保质期的。' },
      { who: 'huo', mood: 'think', text: '哦……所以问题不是"能不能训得更准"，而是"训得准"和"训得及时"在抢同一份时间预算？' },
      { who: 'wu', mood: 'insight', text: '对。这篇论文最狠的一步，是把延迟从"另一个要报告的指标"改写成"会把精度收益吃掉的东西"。' }
    ],
    s2: [
      { who: 'huo', mood: 'puzzle', text: '为什么要先按置信度过滤，再算帧差？反过来先算帧差不行吗？' },
      { who: 'yan', mood: 'think', text: '反过来你就得对整窗三百帧逐一算像素差。作者在端上记账：置信度是推理送的赠品，帧差要真花钱 —— 所以先用免费的把候选缩小。' },
      { who: 'huo', mood: 'puzzle', text: '可精度和时间在训练之前都不知道，那怎么优化 U = A − ηT 呢？' },
      { who: 'yan', mood: 'insight', text: '把三维旋钮 (e, n, m) 压成一个标量 e·n。于是延迟是线性的、精度是饱和指数的 —— 两条曲线离线拟合一次，在线只做算术。' },
      { who: 'wu', mood: 'insight', text: '我看明白链条了：每一层新技术，都是被上一层新引入的开销逼出来的。所谓创新，就是把约束一层层剥到成本可以忽略为止。' }
    ],
    s3: [
      { who: 'huo', mood: 'puzzle', text: 'μ − σ > a_j 这个式子……我好像在质量管理课上见过类似的东西？' },
      { who: 'yan', mood: 'think', text: '正是控制图。指数衰减权重就是 EWMA，σ 就是控制限。作者把"环境变了吗"这个问题，翻译成了"这条精度序列越界了吗"。' },
      { who: 'wu', mood: 'insight', text: '会翻译，比会发明更值钱。把问题翻译成一个经典结构，你就免费继承了那套结构上所有成熟的工具和直觉。' }
    ],
    s4: [
      { who: 'huo', mood: 'puzzle', text: 'Ekya 也会选配置啊，它还专门做了在线 profiling，为什么反而更慢？' },
      { who: 'yan', mood: 'think', text: '因为它要先试跑几个 epoch 把训练曲线画出来 —— 这个 micro-profiler 吃掉了 27% 的总时间，大约 25 秒。为了省时间而先花时间，这是个自反悖论。' },
      { who: 'huo', mood: 'think', text: '那作者是怎么绕开的？' },
      { who: 'yan', mood: 'insight', text: '把这笔测量搬到离线去。同一个决策，成本被换到了另一个时间维度上，在线只剩 20 毫秒。' },
      { who: 'wu', mood: 'insight', text: '连那条只占 0.8% 的权重回传延迟都写进模型的人，是在端到端地记账。顶会深度，大概就是"你把开销追问到了第几层"。' }
    ],
    s5: [
      { who: 'huo', mood: 'puzzle', text: '这些设计模式我背下来，是不是就能写论文了？' },
      { who: 'yan', mood: 'think', text: '模式给你的是候选动作集，不是答案。真正的门槛在于判断：眼下这条约束，该出哪一张牌。' },
      { who: 'wu', mood: 'insight', text: '而且它们真的会迁移。把 e·n 降维那一招，我在"batch × seq 压成 token 数"里闻到了完全一样的味道。' }
    ],
    s6: [
      { who: 'huo', mood: 'puzzle', text: '如果我要写自己的系统论文，第一步该做什么？' },
      { who: 'yan', mood: 'think', text: '先做一个"理想上界"实验。作者的 Ideal Retrain 就是天花板：假装重训不花时间、配置穷举最优 —— 先量出最大可能收益，你后面的一切妥协才有预算。' },
      { who: 'wu', mood: 'insight', text: '从 idea 到系统，中间那段路的名字叫"记账"。每引入一个模块，就问它欠了多少延迟、带宽和算力，然后当场还上。' }
    ],
    s7: [
      { who: 'huo', mood: 'puzzle', text: '这么完整的系统，还有能攻击的地方吗？' },
      { who: 'yan', mood: 'think', text: '有。Oracle 在暴雨里也会错，伪标签噪声全文没讨论；A(e·n) 那条离线曲线能否跨场景迁移，也没有验证。' },
      { who: 'wu', mood: 'insight', text: '找到论文的边界，比崇拜它有用得多 —— 那些边界，就是你下一篇论文的入口。' }
    ]
  };

  /* ================================================================ 图表数据 */
  var figures = [
    {
      id: 'fig01_normal_vs_adverse', num: 'Fig. 1', page: 1,
      title: '同一个轻量模型，正常 vs 恶劣环境',
      caption: 'Yolov5-n 在正常环境（上排）与恶劣环境（下排）下的检测结果。',
      role: '把矛盾"钉死"的第一枚钉子：目标位置几乎相同，恶劣条件下却检不出来，F1 从 0.857/0.800 掉到 0.667/0.600，约 20 个点。',
      wide: false
    },
    {
      id: 'fig02a_accuracy_curve', num: 'Fig. 2(a)', page: 3,
      title: '精度随时间的崩塌与 Ideal Retrain 上界',
      caption: '第 170 秒起突降大雪；各模型 F1 随时间变化，含 Ideal Retrain（穷举最优配置且忽略重训延迟）。',
      role: '这张图同时给出三件事：轻量模型会崩、重模型稳但太慢、以及"如果重训不要钱能拿回多少" —— 后者就是全文的预算天花板。',
      wide: false
    },
    {
      id: 'fig02b_latency_accuracy', num: 'Fig. 2(b)', page: 3,
      title: '延迟与平均精度：为什么不能用大模型',
      caption: '四种模型在恶劣环境前后的平均精度，以及单帧推理延迟。',
      role: 'Yolov5-L 精度最稳，但延迟约为轻量模型的 6 倍 —— 这一条就把"直接上大模型"这条路封死了。',
      wide: false
    },
    {
      id: 'fig03_system_overview', num: 'Fig. 3', page: 4,
      title: '系统总览：端筛帧 / 边判断 / 边重训 / 权重回传',
      caption: '端相机侧的 Key Frame Extractor，与边缘侧的 Trigger Controller、Retraining Manager、Buffer、Oracle Model。',
      role: '注意这张图里的每条箭头都对应延迟模型的一项。切分线正好落在"数据量骤减"处 —— 而这个骤减是 Key Frame Extractor 制造出来的。',
      wide: true
    },
    {
      id: 'fig04_config_tradeoff', num: 'Fig. 4', page: 5,
      title: '配置的精度-延迟权衡：边际收益递减',
      caption: '不同重训配置下的精度与延迟表现。',
      role: '"时间成本显著更高时，精度只有微小改善" —— 这句观察直接催生了效用函数：不能训到收敛，必须给延迟定价。',
      wide: false
    },
    {
      id: 'fig05_linear_latency', num: 'Fig. 5', page: 5,
      title: 'e·n 与训练延迟近似线性（R² = 0.979）',
      caption: '归一化的 e_k·n_k 与训练处理延迟的线性拟合。',
      role: '降维的第一半证据：延迟只依赖"总计算量"这一个标量，斜率 t(m) 随教师模型变化。',
      wide: false
    },
    {
      id: 'fig07_accuracy_fit', num: 'Fig. 7', page: 6,
      title: 'e·n 与精度的饱和指数拟合',
      caption: 'A = 0.9194 − 0.3218·e^(−9.9692·e_k·n_k)（以 Yolov5-s 为教师）。',
      role: '降维的第二半证据。饱和形状本身就是"训到收敛不值得"的数学表达。',
      wide: false
    },
    {
      id: 'fig06_testbed', num: 'Fig. 6', page: 6,
      title: '真实测试床',
      caption: 'Jetson TX2 + Jetson Nano 两台端设备，一台 RTX 3080Ti 边缘服务器。',
      role: '两种算力档位的端设备，是"异构硬件"意识的直接体现；也说明这不是仿真论文。',
      wide: false
    },
    {
      id: 'fig08_first_update_compare', num: 'Fig. 8', page: 7,
      title: '首次模型更新：谁先反应、谁反应得准',
      caption: 'Heavy Snow 场景下各方案首次模型更新过程的对比。',
      role: '这张图是"响应时间"和"精度"两个维度同时呈现的：本文 52s 完成更新且 F1 = 0.868，JIT 67s / 0.723，Ekya 84s / 0.790。',
      wide: true
    },
    {
      id: 'fig09_avg_f1', num: 'Fig. 9', page: 8,
      title: '三种场景下的平均 F1 与标准差',
      caption: 'NR / OTR / JIT / Ekya / Ours 在 Low Light、Heavy Snow、Heavy Rain 下的平均 F1-Score。',
      role: '注意作者强调的是"最低的标准差"——不只是更准，而是更稳。稳定性才是系统论文的加分项。',
      wide: false
    },
    {
      id: 'fig10_acc_vs_time', num: 'Fig. 10', page: 8,
      title: '精度 vs 总重训时间开销',
      caption: '各方案在精度与总重训时间上的权衡位置。',
      role: '这是效用函数 U = A − ηT 的实验版本：作者要证明自己不是在某一维取胜，而是在权衡曲线上更靠外。',
      wide: false
    },
    {
      id: 'fig11_bandwidth', num: 'Fig. 11', page: 8,
      title: '带宽敏感性（Heavy Rain）',
      caption: '20–100 Mbps 带宽扫描下各方案的精度。',
      role: '带宽意识的兑现：本文只掉约 5%，而全流卸载策略掉约 10%。',
      wide: false
    },
    {
      id: 'fig12_retrain_times', num: 'Fig. 12', page: 8,
      title: '重训次数对比',
      caption: '各方案在三种场景下触发重训的次数。',
      role: '把"重训次数"单列一张图，等于宣布：边缘算力是共享的一等成本，少触发本身就是贡献。',
      wide: false
    },
    {
      id: 'fig13_time_decomposition', num: 'Fig. 13', page: 8,
      title: '总重训时延的四段分解',
      caption: '传输 / 标注 / 训练 / 更新四部分的时间占比对比。',
      role: '端到端记账的证据：本文四部分为 7.8% / 5.2% / 86.2% / 0.8%；而 Ekya 的 micro-profiler 单独吃掉 27%。',
      wide: false
    }
  ];

  /* 首次模型更新对比（Fig.8 + 正文，均为论文原始数值） */
  var firstUpdate = {
    src: 'paper',
    note: 'F1 取自 Fig. 8 各子图标注；响应/重训耗时取自 §4.2 正文。',
    rows: [
      { name: 'NR（雪前）', f1: 0.785, time: null, kind: 'ref', note: 't = 32s，环境正常，未重训' },
      { name: 'NR（雪后）', f1: 0.619, time: null, kind: 'bad', note: '同一模型面对恶劣环境，精度大幅下降' },
      { name: 'JIT', f1: 0.723, time: 67, kind: 'base', note: '固定阈值触发，训到达标为止' },
      { name: 'Ekya', f1: 0.790, time: 84, kind: 'base', note: '固定 200s 窗口 + 在线 micro-profiler' },
      { name: 'Ours', f1: 0.868, time: 52, kind: 'ours', note: '自适应触发 + 离线代理 + 20ms 配置搜索' }
    ]
  };

  /* 延迟四段分解 */
  var decomposition = {
    src: 'paper（百分比）/ derived（秒数）',
    note: '百分比为论文原文；秒数由“重训时间比 Ekya 减少 52.7%”与“Ekya profiler 占 27% ≈ 25s”反推，仅用于可视化。',
    parts: [
      { key: 'transmit', label: '① 传输关键帧', pct: 7.8, color: '#7cc4ff' },
      { key: 'label', label: '② Oracle 标注', pct: 5.2, color: '#4dd4c4' },
      { key: 'train', label: '③ 蒸馏重训', pct: 86.2, color: '#ffb454' },
      { key: 'update', label: '④ 权重回传', pct: 0.8, color: '#ff8fa3' }
    ],
    ekyaProfilePct: 27,
    ekyaProfileSec: 25,
    oursVsEkyaCut: 52.7,
    oursTotalSec: 43.8,
    ekyaTotalSec: 92.6
  };

  /* 论文明确给出的对比结论 */
  var claims = [
    { label: '相对 NR 的精度提升', value: 24, unit: '%', dir: 'up', src: 'paper' },
    { label: '相对 Ekya 的精度提升', value: 12, unit: '%', dir: 'up', src: 'paper' },
    { label: '重训时间相对 Ekya 的削减', value: 52.7, unit: '%', dir: 'down', src: 'paper' },
    { label: '带宽 20–100Mbps 扫描下的精度损失', value: 5, unit: '%', dir: 'down', src: 'paper', cmp: '朴素全流卸载：约 10%' },
    { label: '配置搜索耗时', value: 20, unit: 'ms', dir: 'down', src: 'paper' },
    { label: 'Ekya micro-profiler 占总运行时', value: 27, unit: '%', dir: 'up', src: 'paper', cmp: '约 25 秒，被本文搬到离线' }
  ];

  /* 交互模拟器所用的模型常数（形式来自论文，数值为演示取值） */
  var simConst = {
    src: 'demo',
    accFit: { a: 0.9194, b: 0.3218, c: 9.9692, src: 'paper' },
    teachers: [
      { key: 's', name: 'Yolov5-s', slope: 55, cap: 0.00, desc: '最快的老师，知识上限略低' },
      { key: 'm', name: 'Yolov5-m', slope: 72, cap: 0.015, desc: '折中选择' },
      { key: 'l', name: 'Yolov5-l', slope: 95, cap: 0.028, desc: '最强的老师，但训练每一步都更贵' }
    ],
    d0Mb: 3.2,     // 单帧数据量（Mb）
    t0Sec: 0.038,  // 单帧 Oracle 标注耗时
    M0Mb: 30,      // 学生模型大小（Mb）
    eMin: 5, eMax: 100,
    nMin: 50, nMax: 320,
    tau0: 60
  };

  return {
    meta: meta, params: params,
    tensions: tensions, bottleneck: bottleneck, priorWork: priorWork,
    chain: chain, mappings: mappings, hidden: hidden,
    patterns: patterns, lessons: lessons, critiques: critiques,
    characters: characters, dialogues: dialogues,
    figures: figures, firstUpdate: firstUpdate,
    decomposition: decomposition, claims: claims, simConst: simConst
  };
})();
