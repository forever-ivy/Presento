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
