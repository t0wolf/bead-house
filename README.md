# 拼豆网站

用于生成、浏览、收藏和展示拼豆图纸的 Web 应用。

## 工作区

- `apps/web`: React 前端
- `apps/api`: FastAPI 后端
- `packages/shared-types`: 前后端共享类型
- `packages/bead-palettes`: 拼豆色卡数据
- `packages/pattern-engine`: 图纸生成核心逻辑

## 环境要求

### 前端

- `Node.js` 18+
- `pnpm` 10+

### 后端

- `Python` 3.11+ 推荐
- 可选使用 `venv`
- 可选使用 `conda`

## 启动方式

### 1. 安装前端依赖

在项目根目录执行：

```bash
pnpm install
```

### 2. 启动前端开发服务器

在项目根目录执行：

```bash
pnpm dev:web
```

默认会启动 `apps/web` 的 Vite 开发环境。

## 后端启动方式

后端目录为 `apps/api`，下面给出两种推荐方式。

### 方式 A：使用 `venv`

创建虚拟环境：

```bash
python3 -m venv .venv
```

激活虚拟环境：

```bash
source .venv/bin/activate
```

安装依赖：

```bash
pip install -r apps/api/requirements.txt
```

启动 FastAPI：

```bash
uvicorn apps.api.main:app --reload
```

如果上面的模块路径在你的本地环境里解析失败，也可以切到后端目录再启动：

```bash
cd apps/api
uvicorn main:app --reload
```

### 方式 B：使用 `conda`

创建环境：

```bash
conda create -n bead-app python=3.11 -y
```

激活环境：

```bash
conda activate bead-app
```

安装依赖：

```bash
pip install -r apps/api/requirements.txt
```

启动 FastAPI：

```bash
uvicorn apps.api.main:app --reload
```

如果模块路径解析有问题，也可以进入后端目录启动：

```bash
cd apps/api
uvicorn main:app --reload
```

## 推荐开发习惯

- 前端始终使用 `pnpm`
- 后端可以按个人习惯选择 `venv` 或 `conda`
- 不建议为了统一而让整个项目都依赖 `conda`

## 常用命令

### 前端

安装依赖：

```bash
pnpm install
```

启动开发环境：

```bash
pnpm dev:web
```

前端类型检查：

```bash
pnpm check:web
```

前端构建：

```bash
pnpm build:web
```

### 后端

安装依赖：

```bash
pip install -r apps/api/requirements.txt
```

启动开发服务：

```bash
uvicorn apps.api.main:app --reload
```
