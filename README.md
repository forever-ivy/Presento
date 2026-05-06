# Presento Web

一个基于 `Next.js 16 App Router` 的全栈项目，面向“答辩辅导 / 项目资料解析 / 训练演练”场景。它不是单纯的前端站点，而是一套由 Web 应用、数据库、文件解析 sidecar、实时服务和后台 worker 组成的多服务系统。

这份 README 以“开发 + 部署一体”为目标来写，尽量覆盖：

- 这个项目现在由哪些服务组成
- 本地开发怎么启动
- 线上部署应该怎么拆
- 现在代码里有哪些需要提前知道的约束
- 适合什么样的服务器配置

## 1. 项目结构概览

当前仓库核心由以下部分组成：

- `src/app`
  Next.js 页面与 API 路由
- `src/lib`
  业务逻辑、运行时配置、存储、模型调用、知识图谱等
- `prisma/schema.prisma`
  数据模型定义
- `packages/db`
  数据访问层
- `packages/ingest`
  文件解析、持久化、知识片段生成、PPT 处理
- `services/defense-realtime`
  独立实时服务，负责实时训练 / 语音 / WebSocket 场景
- `services/notebook-rag`
  Python FastAPI sidecar，负责较重的文件解析和 NotebookLM 风格问答
- `workers/document-worker`
  文档类任务 worker
- `workers/code-worker`
  代码仓库类任务 worker
- `workers/graph-worker`
  图谱生成类任务 worker
- `compose.yaml`
  当前仓库自带的基础依赖编排文件

## 2. 这不是单服务应用

如果你只运行 `npm run dev`，页面虽然能打开，但并不等于“整个系统完整可用”。

完整能力依赖下面这些角色同时存在：

- `web`
  Next.js 主应用，负责页面和 HTTP API
- `postgres`
  PostgreSQL + pgvector
- `notebook-rag`
  Python 文件解析与解释 sidecar
- `defense-realtime`
  独立 WebSocket 实时服务
- `workers`
  后台任务消费者，负责处理上传后的异步解析和图谱任务

当前仓库里的 `compose.yaml` 只覆盖了：

- `postgres`
- `notebook-rag`
- `defense-realtime`

它没有把下面这些一起纳入：

- `web`
- `document-worker`
- `code-worker`
- `graph-worker`

所以不管是本地开发还是线上部署，你都需要明确区分：

- 基础依赖服务
- 应用主进程
- 后台 worker

## 3. 运行链路

一个典型流程大致如下：

1. 用户访问 Next.js 页面。
2. 用户上传文件到 `/api/uploads`。
3. 文件先落本地 `.data/uploads`，或者写入对象存储。
4. 系统往数据库写入文件记录和待处理任务。
5. 后台 worker 轮询并消费这些任务。
6. `packages/ingest` 调用 `notebook-rag` sidecar 解析文件内容。
7. 解析结果、知识片段、幻灯片、图谱等写回数据库。
8. 某些训练或实时交互场景会走 `defense-realtime`。

这也是为什么这个项目不能简单理解成“前端 + 一个 API”。

## 4. 环境要求

### 本地开发建议

- Node.js `22.x`
- npm `10+`
- Docker 与 Docker Compose
- Python `3.11+` 或 `3.12`

### 如果你在 macOS 开发

PPTX 幻灯片预览渲染目前更友好，因为仓库里的 `scripts/render_pptx_slides.py` 依赖：

- `qlmanage`
- `sips`

这两个都是 macOS 自带工具。

### 如果你在 Linux 服务器部署

项目大部分功能可以运行，但要特别注意：

- 当前 `PPTX` 幻灯片缩略图脚本不是按 Linux 写的
- 在 Linux 上，PPTX 解析主流程可以继续跑，但幻灯片图片渲染能力大概率需要你后续改造

也就是说：

- “上传并解析 PPTX 文本内容”不一定会坏
- “生成每页 PPTX 预览图 / 缩略图”当前不应默认假设能在 Ubuntu 上正常工作

## 5. 环境变量

当前仓库里没有现成的 `.env.example`，实际开发默认使用 `.env.local`。

建议你在项目根目录创建：

```bash
.env.local
```

可以参考下面这份模板填写：

```env
# Database
DATABASE_URL="postgresql://defense:defense@127.0.0.1:55433/defense_coach?schema=public"

# Main LLM
LLM_API_KEY="your-api-key"
LLM_BASE_URL="https://api.deepseek.com/v1"
LLM_MODEL="deepseek-chat"
LLM_QUICK_MODEL="deepseek-v4-flash"
LLM_MASTERY_MODEL="deepseek-v4-pro"

# Realtime service
DEFENSE_REALTIME_PORT="3021"
DEFENSE_REALTIME_WS_URL="ws://127.0.0.1:3021"
GLM_REALTIME_WS_URL="wss://open.bigmodel.cn/api/paas/v4/realtime"
GLM_API_KEY="your-glm-api-key"

# Notebook RAG sidecar
NOTEBOOK_RAG_BASE_URL="http://127.0.0.1:8011"
NOTEBOOK_RAG_API_KEY="local-dev-key"
NOTEBOOK_RAG_EMBEDDING_MODEL="sentence-transformers/all-MiniLM-L6-v2"
NOTEBOOK_RAG_RERANK_MODEL="ms-marco-MiniLM-L-12-v2"
NOTEBOOK_RAG_RETRIEVAL_V2_ENABLED="1"

# Optional object storage
OBJECT_STORAGE_ENDPOINT=""
OBJECT_STORAGE_REGION=""
OBJECT_STORAGE_BUCKET=""
OBJECT_STORAGE_ACCESS_KEY_ID=""
OBJECT_STORAGE_SECRET_ACCESS_KEY=""
OBJECT_STORAGE_FORCE_PATH_STYLE="true"

# Optional worker tuning
PRESENTO_DOCUMENT_WORKERS="2"
PRESENTO_CODE_WORKERS="4"
PRESENTO_GRAPH_WORKERS="1"

# Optional tracing
LANGFUSE_PUBLIC_KEY=""
LANGFUSE_SECRET_KEY=""
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
LANGFUSE_TRACING_ENVIRONMENT="development"
LANGFUSE_RELEASE="local"
```

### 变量说明

- `DATABASE_URL`
  Prisma 和应用层使用的数据库连接串
- `LLM_*`
  主应用与 sidecar 调用模型时使用
- `DEFENSE_REALTIME_*`
  浏览器连接实时服务时使用
- `GLM_*`
  实时训练时上游语音 / 实时能力依赖
- `NOTEBOOK_RAG_*`
  Python sidecar 地址与检索模型配置
- `OBJECT_STORAGE_*`
  配置后，上传文件会走 S3 兼容对象存储；不配置时走本地 `.data/uploads`
- `PRESENTO_*_WORKERS`
  控制每类 worker 的并发数量

## 6. 安装依赖

```bash
npm install
```

如果你后面要自己单独进入 Python sidecar 目录调试，再额外执行：

```bash
cd services/notebook-rag
pip install -r requirements.txt
```

## 7. 启动数据库和基础依赖

### 第一步：启动 Compose 里的基础服务

```bash
docker compose up -d
```

当前 `compose.yaml` 会启动：

- `postgres`
- `notebook-rag`
- `defense-realtime`

### 第二步：检查容器状态

```bash
docker compose ps
```

### 第三步：做数据库检查

```bash
npm run db:check
```

这个检查会验证：

- 关键业务表是否存在
- `vector` 扩展是否存在

### 第四步：同步数据库结构

第一次拉起环境时，建议执行：

```bash
npm run db:push
```

如果你修改了 `prisma/schema.prisma`，也需要重新执行一次。

## 8. 启动 Web 与 worker

### 启动主应用

```bash
npm run dev
```

默认访问地址：

```text
http://localhost:3000
```

### 启动 worker

建议至少再开一个终端窗口，运行：

```bash
npm run worker:all
```

如果你只想分别调试某一类任务，也可以单独运行：

```bash
npm run worker:document
npm run worker:code
npm run worker:graph
```

### 可选：单次执行模式

```bash
npm run worker:document:once
npm run worker:code:once
npm run worker:graph:once
```

## 9. 本地开发最小可用清单

如果你只是想把系统“完整跑起来”，建议至少同时保证下面这些都在运行：

1. `docker compose up -d`
2. `npm run dev`
3. `npm run worker:all`

少掉任何一块，通常都会表现成下面这些问题之一：

- 页面能打开，但上传后一直不处理
- 文件能入库，但知识图谱不生成
- 实时训练建立不了连接
- 文件解释相关接口报 sidecar 错误

## 10. 生产部署建议

### 先说结论

对当前这套代码，最省事、最稳的部署方式是：

- 一台 Linux 云服务器
- Ubuntu `22.04 LTS`
- Docker Compose 跑基础服务
- Node 进程跑 `web`
- Node 进程跑 `worker`
- 可选用 Nginx 或 Caddy 做反向代理

### 推荐服务器配置

如果只是先上线一个可用版本：

- 最低建议：`2核4G`
- 更稳妥：`2核8G`
- 面向多人并发和大量文件解析：`4核8G` 起步

如果你是给国内用户快速上线，又不想先做备案：

- 推荐买 `腾讯云轻量应用服务器`
- 地域优先选 `中国香港`
- 系统选 `Ubuntu 22.04 LTS`

### 为什么不建议直接上 Vercel

因为当前项目不是纯无状态 Next.js 站点，它还依赖：

- 常驻 worker
- 独立实时 WebSocket 服务
- Python sidecar
- 本地或对象存储文件读写

所以现阶段它更适合“整机部署”，而不是先拆成一堆 Serverless 服务。

## 11. 当前代码里的两个重要约束

这部分很重要，建议部署前先看一遍。

### 约束一：数据库访问层默认依赖 Docker Compose 里的 `postgres`

仓库当前的数据访问实现里，有一部分逻辑不是直接通过标准连接池访问数据库，而是默认通过：

```text
docker compose exec postgres psql ...
```

这意味着：

- 本项目现在天然更适合同机部署
- `web`、`worker`、`postgres` 最好在同一台机器或同一套部署环境里
- 如果你要拆成“托管数据库 + 分布式服务”，需要进一步改造数据访问层

### 约束二：PPTX 图片渲染偏向 macOS

当前 `scripts/render_pptx_slides.py` 使用的是 macOS 工具链：

- `qlmanage`
- `sips`

所以：

- macOS 本地开发体验更完整
- Ubuntu 线上部署时，不应默认认为 PPT 幻灯片截图功能可用
- 如果线上必须支持 PPTX 页面缩略图，建议后续改成基于 LibreOffice 或其他 Linux 兼容方案

## 12. 上传文件与存储策略

当前上传逻辑支持两种模式：

### 本地磁盘模式

如果没有配置对象存储变量，文件会写到：

```text
.data/uploads/
```

适合：

- 本地开发
- 单机部署
- 先快速跑通系统

### 对象存储模式

如果配置了 `OBJECT_STORAGE_*`，文件会写到 S3 兼容对象存储。

适合：

- 多机部署
- 需要持久化上传文件
- 需要避免本地磁盘增长

## 13. 一台 Ubuntu 服务器上的推荐部署方式

下面是一套比较贴近当前代码状态的实用部署思路。

### 方案

- `docker compose` 跑：
  - `postgres`
  - `notebook-rag`
  - `defense-realtime`
- 宿主机直接跑：
  - `npm run build`
  - `npm run start`
  - `npm run worker:all`
- `nginx` 反向代理到 `3000`

### 原因

- 当前仓库自带 Compose 已经包含基础服务
- `web` 和 `worker` 直接在宿主机跑，排查更简单
- 对现在这套代码来说，这比一上来把所有东西再打包成生产镜像更省事

### 典型部署步骤

1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y git curl build-essential python3 python3-pip nginx
```

2. 安装 Node.js `22.x`

3. 克隆项目

```bash
git clone <your-repo-url>
cd web
```

4. 创建 `.env.local`

5. 安装依赖

```bash
npm install
```

6. 启动基础依赖

```bash
docker compose up -d
```

7. 同步数据库

```bash
npm run db:push
```

8. 构建主应用

```bash
npm run build
```

9. 启动主应用

```bash
npm run start
```

10. 启动 worker

```bash
npm run worker:all
```

11. 配置 Nginx，把域名反代到 `127.0.0.1:3000`

### 更稳一点的做法

线上建议把这两个命令交给 `systemd` 或 `pm2` 托管：

- `npm run start`
- `npm run worker:all`

否则服务器重启后它们不会自动恢复。

## 14. 常用命令

### Web

```bash
npm run dev
npm run build
npm run start
```

### Database

```bash
npm run db:push
npm run db:studio
npm run db:check
```

### Realtime

```bash
npm run realtime:dev
npm run realtime:start
```

### Workers

```bash
npm run worker:all
npm run worker:document
npm run worker:code
npm run worker:graph
```

### Tests

```bash
npm run test:unit
```

## 15. 常见问题排查

### 页面能打开，但上传后一直没有结果

优先检查：

- `worker:all` 有没有运行
- `docker compose ps` 里 `postgres` 和 `notebook-rag` 是否健康
- `DATABASE_URL` 是否正确

### 实时训练连不上

优先检查：

- `defense-realtime` 是否启动
- `DEFENSE_REALTIME_WS_URL` 是否和浏览器访问地址一致
- `GLM_API_KEY` 是否配置

### 文件解释接口失败

优先检查：

- `NOTEBOOK_RAG_BASE_URL` 是否正确
- `notebook-rag` 容器是否健康
- `NOTEBOOK_RAG_API_KEY` 是否前后端一致

### 数据库检查失败

优先检查：

- `docker compose up -d` 是否成功
- `postgres` 容器是否健康
- 是否执行过 `npm run db:push`

### 线上 Ubuntu 上 PPT 预览图不生成

这是当前仓库已知限制之一。先不要把它当成部署错误，先确认是否命中了“macOS 专用渲染脚本”这一点。

## 16. 下一步建议

如果你接下来是要正式部署，我建议按这个顺序推进：

1. 先把本地环境完整跑通
2. 在一台 Ubuntu 服务器上按“单机多进程”方式上线
3. 稳定后再补：
   - `web` 的生产 Dockerfile
   - `worker` 的生产进程托管
   - Nginx / HTTPS
   - 对象存储
   - Linux 版 PPTX 渲染方案

如果你愿意，我可以继续直接帮你补下一批部署文件：

- `Dockerfile`
- `docker-compose.prod.yml`
- `nginx.conf`
- `.env.production.example`
- `systemd` 服务文件
