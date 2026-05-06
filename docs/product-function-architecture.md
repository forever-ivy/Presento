# Presento 产品功能架构图

基于当前代码实现整理，覆盖产品入口、核心业务闭环、AI 能力层、数据与基础设施层。

## 1. 产品全景架构图

```mermaid
flowchart LR
    U[用户 / 答辩成员]

    subgraph A[产品入口层]
        A1[首页 / 创建首个项目]
        A2[项目工作台 Flow Workspace]
    end

    subgraph B[核心功能层]
        B1[资料导入]
        B2[知识地图]
        B3[逐页讲稿]
        B4[模拟讲练]
        B5[复盘报告]
        B6[薄弱点钻研]
        B7[Agent Skills]
        B8[PCG 内容输出]
    end

    subgraph C[AI 能力层]
        C1[项目速记卡]
        C2[逐页讲稿生成]
        C3[高危追问]
        C4[实时答辩追问]
        C5[复盘报告生成]
        C6[薄弱点 Deep Dive]
        C7[文件讲解 / 代码走查 / 数据讲解]
        C8[内容二次创作]
        C9[兜底回答与技能路由]
    end

    subgraph D[业务数据层]
        D1[项目 Project]
        D2[文件 FileAsset]
        D3[代码仓库 CodeRepositorySource]
        D4[Slides / SlideDeck / ScriptDraft]
        D5[知识块 KnowledgeChunk]
        D6[知识图谱 Nodes / Edges]
        D7[训练会话 / 实时会话 / Turn]
        D8[复盘 / Weakness / DeepDive]
        D9[技能包 / 技能调用 / 反馈]
        D10[内容导出 Export]
    end

    subgraph E[处理与服务层]
        E1[文档 Worker]
        E2[代码 Worker]
        E3[图谱 Worker]
        E4[Ingest Pipeline]
        E5[Notebook RAG Sidecar]
        E6[Realtime Defense Server]
        E7[Built-in Skill Executor]
    end

    subgraph F[基础设施层]
        F1[Next.js App Router API]
        F2[PostgreSQL + Prisma]
        F3[本地 / 对象存储]
        F4[LLM Provider / GLM Realtime]
        F5[GitHub Public Repo 接入]
    end

    U --> A1 --> A2
    A2 --> B1
    A2 --> B2
    A2 --> B3
    A2 --> B4
    A2 --> B5
    A2 --> B6
    A2 --> B7
    A2 --> B8

    B1 --> E4
    B1 --> F5
    E4 --> E1
    E4 --> E2
    E4 --> E3
    E4 --> E5
    E4 --> D2
    E4 --> D3
    E4 --> D4
    E4 --> D5
    E4 --> D6

    B2 --> D6
    B2 --> C7
    C7 --> E5
    C7 --> E7

    B3 --> D4
    B3 --> C1
    B3 --> C2
    B3 --> C3
    C1 --> E7
    C2 --> E7
    C3 --> E7

    B4 --> D7
    B4 --> C4
    B4 --> E6
    C4 --> E7
    E6 --> F4

    B5 --> D8
    B5 --> C5
    C5 --> E7

    B6 --> D8
    B6 --> C6
    C6 --> E7

    B7 --> D9
    B7 --> C9
    C9 --> E7

    B8 --> D10
    B8 --> C8
    C8 --> E7

    E7 --> F4
    F1 --> F2
    F1 --> F3
    F1 --> E4
    F1 --> E6
    F1 --> E7

    D1 --> F2
    D2 --> F2
    D3 --> F2
    D4 --> F2
    D5 --> F2
    D6 --> F2
    D7 --> F2
    D8 --> F2
    D9 --> F2
    D10 --> F2
```

## 2. 产品主闭环

```mermaid
flowchart LR
    P1[创建项目] --> P2[上传 PPT / 文档 / 数据 / 代码仓库]
    P2 --> P3[资料解析与入库]
    P3 --> P4[生成知识块与知识地图]
    P4 --> P5[逐页讲稿与追问准备]
    P5 --> P6[实时模拟答辩]
    P6 --> P7[复盘报告]
    P7 --> P8[薄弱点钻研]
    P7 --> P9[内容导出]
    P8 --> P4
```

## 3. 各模块职责

- 资料导入：支持本地资料上传，也支持接入 GitHub 公开仓库，把代码仓库转成可分析来源。
- 知识地图：把项目资料沉淀成节点、边、风险点、薄弱点和训练入口，是后续讲稿、训练、讲解的中枢。
- 逐页讲稿：围绕 Slide 生成标准讲稿、30 秒版、关键词版、转场句、追问答辩卡，并支持草稿保存。
- 模拟讲练：创建训练会话和实时会话，对当前页进行老师追问、回答、反馈、转场与最终总结。
- 复盘报告：训练结束后自动输出评分、优势、薄弱点、改答建议和下一轮动作。
- 薄弱点钻研：把复盘中的 weakness 转成深挖材料、证据链和补强清单。
- Agent Skills：管理技能包、技能推荐、技能调用记录和用户反馈闭环。
- PCG 内容输出：把训练结果再加工成 QQ 空间摘要、微视口播稿、腾讯视频展示稿。

## 4. 关键实现映射

- 入口与工作台：`src/app/page.tsx`、`src/components/first-project-home.tsx`、`src/components/flow-workspace-view.tsx`
- 产品路由定义：`src/lib/flow-workspace.ts`、`src/lib/project-routes.ts`
- 项目与工作区 API：`src/app/api/projects/route.ts`、`src/app/api/projects/[projectId]/workspace/route.ts`
- 文件 / 仓库导入：`src/app/api/projects/[projectId]/files/route.ts`、`src/app/api/projects/[projectId]/code-repositories/route.ts`
- 资料处理链路：`packages/ingest/src/process-job.ts`、`packages/ingest/src/pipeline.ts`
- 异步 Worker：`workers/document-worker/src/index.ts`、`workers/code-worker/src/index.ts`、`workers/graph-worker/src/index.ts`
- 文件讲解与 RAG：`src/lib/file-explanation-service.ts`、`services/notebook-rag/app/main.py`
- 训练与实时答辩：`src/app/api/projects/[projectId]/training-sessions/route.ts`、`src/app/api/projects/[projectId]/training-sessions/[sessionId]/realtime-sessions/route.ts`、`services/defense-realtime/src/server.ts`
- 复盘与 Deep Dive：`src/app/api/projects/[projectId]/training-sessions/[sessionId]/finish/route.ts`、`src/lib/defense-review.ts`
- 技能体系：`packages/ai/src/skills/registry.ts`、`src/lib/skills-runtime.ts`
- 数据模型：`prisma/schema.prisma`

## 5. 当前产品定位总结

Presento 不是单点的 PPT 答辩辅助工具，而是一个围绕“项目资料理解 -> 表达生成 -> 实时讲练 -> 复盘补强 -> 内容传播”构建的答辩训练操作系统。
