export const demoProject = {
  id: "demo",
  name: "智能点餐系统课程答辩",
  category: "软件 / 数据类",
  deadline: "距离答辩 2 天",
  readiness: 55,
};

export const demoFiles = [
  {
    name: "答辩 PPT.pdf",
    type: "演示材料",
    status: "已生成 18 页预览",
    source: "PPT 同屏答辩",
  },
  {
    name: "README.md",
    type: "项目说明",
    status: "已入库",
    source: "项目速记 Skill",
  },
  {
    name: "backend.zip",
    type: "代码包",
    status: "Repomix 处理中",
    source: "代码解释 Skill",
  },
  {
    name: "orders.sql",
    type: "数据库",
    status: "已解析表结构",
    source: "数据库追问",
  },
  {
    name: "订单数据.xlsx",
    type: "数据表",
    status: "待抽取字段",
    source: "数据质疑 Skill",
  },
];

export const demoProcessingTasks = [
  {
    id: "demo-task-ppt",
    fileName: "答辩 PPT.pdf",
    title: "生成逐页预览与讲稿入口",
    engine: "PDF.js + 逐页讲稿 Skill",
    status: "completed",
    progress: 100,
  },
  {
    id: "demo-task-code",
    fileName: "backend.zip",
    title: "打包代码上下文",
    engine: "Repomix",
    status: "processing",
    progress: 35,
  },
  {
    id: "demo-task-data",
    fileName: "订单数据.xlsx",
    title: "抽取数据字段与指标",
    engine: "SheetJS",
    status: "pending",
    progress: 0,
  },
];

export const demoSkillPacks = [
  {
    name: "软件项目答辩",
    desc: "代码解释、数据库追问、分工真实性",
    enabled: true,
  },
  {
    name: "表达冲刺",
    desc: "逐页讲稿、30 秒压缩、兜底回答",
    enabled: true,
  },
  {
    name: "数据项目答辩",
    desc: "数据来源、指标质疑、实验复盘",
    enabled: false,
  },
  {
    name: "严格老师追问",
    desc: "技术细节、局限性、个人贡献连续追问",
    enabled: false,
  },
];

export const demoSkillInvocations = [
  {
    skill: "项目速记",
    trigger: "资料解析完成",
    result: "生成项目目标、模块、技术路线和分工摘要",
    status: "成功",
  },
  {
    skill: "逐页讲稿",
    trigger: "PPT 预览生成",
    result: "18 页讲稿已生成，3 页待确认",
    status: "待确认",
  },
  {
    skill: "当前页追问",
    trigger: "用户讲完第 2 页",
    result: "生成状态流转与接口权限追问",
    status: "已触发",
  },
  {
    skill: "代码解释",
    trigger: "backend.zip 入库",
    result: "发现订单模块和数据库访问层薄弱点",
    status: "处理中",
  },
];

export const demoDeepDives = [
  {
    title: "订单状态流转解释不够完整",
    evidence: "来自 PPT 第 2 页、orders.sql、backend.zip / routes/orders.ts",
    checklist: ["说清状态枚举", "解释取消权限", "补充后厨接单后的异常处理"],
  },
  {
    title: "数据库冗余字段缺少依据",
    evidence: "来自 PPT 第 3 页、orders.sql、README.md",
    checklist: ["解释订单金额快照", "说明菜品价格变动影响", "准备一致性兜底回答"],
  },
  {
    title: "个人负责模块需要说得更明确",
    evidence: "来自分工说明、README.md、后端接口目录",
    checklist: ["明确负责后端订单接口", "准备接口流程图说法", "避免把队友模块说成自己实现"],
  },
];

export const demoDefenseTurns = [
  {
    speaker: "AI 老师",
    content: "你正在讲第 2 页系统架构。先用 30 秒说明一次数据从用户下单到后厨接单的流程。",
  },
  {
    speaker: "我",
    content: "用户在前端选择菜品后提交订单，后端写入订单表和订单明细表，然后后厨看板读取待处理订单。",
  },
  {
    speaker: "AI 老师",
    content: "如果后厨已经接单，用户还能取消订单吗？你的状态设计怎么处理？",
  },
];

type DemoTone = "blue" | "gray" | "orange" | "green" | "red" | "purple" | "cyan";

type DemoKnowledgeNode = {
  id: string;
  title: string;
  type: string;
  tone: DemoTone;
  x: number;
  y: number;
  risk: string;
  description: string;
  evidence: string[];
  actions: string[];
};

export const demoKnowledgeNodes: DemoKnowledgeNode[] = [
  {
    id: "project",
    title: "智能点餐系统",
    type: "项目中心",
    tone: "blue",
    x: 50,
    y: 47,
    risk: "准备度 68%",
    description: "面向餐饮门店的课程项目，围绕点餐、订单、后厨看板和数据统计完成答辩。",
    evidence: ["README.md 项目介绍", "答辩 PPT 第 1 页", "分工说明"],
    actions: ["开始讲练", "查看速记卡"],
  },
  {
    id: "ppt",
    title: "PPT 18 页",
    type: "演示资料",
    tone: "cyan",
    x: 22,
    y: 23,
    risk: "3 页讲稿待确认",
    description: "已抽取项目背景、系统架构、数据库设计和功能演示页面。",
    evidence: ["答辩 PPT.pdf", "Slide 02 系统架构", "Slide 03 数据库设计"],
    actions: ["查看逐页讲稿", "进入第 2 页讲练"],
  },
  {
    id: "code",
    title: "后端订单模块",
    type: "代码",
    tone: "purple",
    x: 76,
    y: 24,
    risk: "分工真实性高危",
    description: "老师可能追问订单接口、状态流转和异常处理是否由本人实现。",
    evidence: ["backend.zip / routes/orders.ts", "README.md 分工", "接口说明"],
    actions: ["生成代码解释", "加入薄弱点"],
  },
  {
    id: "db",
    title: "数据库设计",
    type: "数据库",
    tone: "green",
    x: 20,
    y: 72,
    risk: "金额冗余需解释",
    description: "orders、order_items、dishes、users 四张表是答辩追问重点。",
    evidence: ["orders.sql", "PPT 第 3 页", "订单数据.xlsx"],
    actions: ["查看证据链", "生成兜底回答"],
  },
  {
    id: "risk",
    title: "高危追问 8 个",
    type: "风险",
    tone: "orange",
    x: 78,
    y: 68,
    risk: "3 个未掌握",
    description: "集中在状态流转、权限边界、数据库冗余和个人贡献。",
    evidence: ["模拟讲练记录", "当前页追问 Skill", "复盘报告"],
    actions: ["进入模拟讲练", "查看高压问题"],
  },
  {
    id: "weakness",
    title: "薄弱点 3 个",
    type: "钻研",
    tone: "red",
    x: 50,
    y: 82,
    risk: "需回流补强",
    description: "讲练中暴露的薄弱点会进入钻研队列，再回到 PPT 同屏答辩验证。",
    evidence: ["DefensePracticeTurn", "AI 老师评分", "复盘报告"],
    actions: ["进入项目钻研", "生成学习清单"],
  },
];

export const demoGraphLinks = [
  ["project", "ppt"],
  ["project", "code"],
  ["project", "db"],
  ["project", "risk"],
  ["project", "weakness"],
  ["ppt", "risk"],
  ["code", "weakness"],
  ["db", "risk"],
];

export const demoSlideScripts = [
  {
    page: "01",
    title: "项目背景与痛点",
    duration: "40 秒",
    status: "已确认",
    normal:
      "本项目面向校园周边小型餐饮门店，解决高峰期人工点餐效率低、订单记录容易出错、后厨同步慢的问题。",
    short:
      "我们做的是智能点餐系统，重点解决点餐、下单和后厨同步这三个流程效率问题。",
    keywords: ["排队", "错单", "后厨同步"],
    risks: ["是否调研过真实门店流程？", "为什么不用现成点餐小程序？"],
    evidence: ["PPT 第 1 页", "README 项目背景"],
  },
  {
    page: "02",
    title: "系统架构",
    duration: "55 秒",
    status: "重点练习",
    normal:
      "系统分为用户点餐端、后端订单服务、数据库和后厨看板。用户提交订单后，后端负责校验菜品、写入订单和订单明细，后厨看板再读取待处理订单。",
    short:
      "这一页要讲清数据流：前端提交订单，后端校验并落库，后厨看板读取状态变化。",
    keywords: ["订单流转", "状态机", "接口权限", "后厨看板"],
    risks: ["后厨接单后还能取消吗？", "前端能否篡改订单状态？", "接口权限怎么控制？"],
    evidence: ["PPT 第 2 页", "routes/orders.ts", "orders.sql"],
  },
  {
    page: "03",
    title: "数据库设计",
    duration: "50 秒",
    status: "待补强",
    normal:
      "数据库核心是 users、dishes、orders、order_items 四张表。orders 保存订单快照，order_items 保存明细，避免菜品价格变化影响历史订单。",
    short:
      "数据库重点讲订单和订单明细拆分，以及订单金额快照为什么需要冗余保存。",
    keywords: ["订单表", "明细表", "金额快照"],
    risks: ["订单金额为什么冗余？", "菜品价格变化后历史订单怎么算？"],
    evidence: ["PPT 第 3 页", "orders.sql", "订单数据.xlsx"],
  },
];

export const demoReviewMetrics = [
  { label: "表达清晰度", value: 82, desc: "结构完整，但系统架构页略啰嗦" },
  { label: "证据支撑度", value: 71, desc: "能引用 PPT，代码路径还需更具体" },
  { label: "追问抗压度", value: 64, desc: "状态流转和权限追问容易卡顿" },
  { label: "负责范围准确度", value: 76, desc: "需要明确自己负责后端订单接口" },
];

export const demoPcgCards = [
  {
    title: "QQ 小组群",
    status: "模拟接入",
    desc: "从答辩小组群创建训练，同步成员分工、倒计时和今日任务。",
    items: ["成员 4 人", "倒计时 2 天", "今日任务：AI 模块讲练、数据库追问"],
  },
  {
    title: "微视 30 秒口播",
    status: "可生成",
    desc: "把复盘结论转成短视频口播脚本，适合展示项目亮点。",
    items: ["项目痛点", "核心功能", "个人贡献", "一句话收尾"],
  },
  {
    title: "腾讯视频项目展示",
    status: "可生成",
    desc: "生成 1 分钟项目展示简介和分镜，用于课程成果展示。",
    items: ["开场问题", "系统演示", "技术亮点", "观众追问"],
  },
];
