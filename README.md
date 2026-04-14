# OpenClaw 本地配置客户端

这是一个本地运行的 Node.js Web 客户端，用来查看和编辑 OpenClaw 配置目录、工作区信息，以及检查和执行 OpenClaw 更新。

## 功能

- 读取标准 OpenClaw 配置目录，默认定位到 `C:\Users\Administrator\.openclaw`
- 加载并编辑 `openclaw.json`
- 展示当前本地 OpenClaw 版本信息
- 展示工作区关键文件
- 展示工作区已安装技能
- 提供结构化预览和中文说明
- 检查 OpenClaw 最新版本
- 执行全局更新：`npm i -g openclaw@latest`

## 启动

1. 安装 Node.js 22+
2. 在项目目录执行：

```bash
npm start
```

3. 在浏览器打开：

```text
http://localhost:4173
```

## 页面内容

- 配置入口：快速加载 OpenClaw 配置目录或 `openclaw.json`
- 当前工作区：查看版本、根目录、配置文件位置
- 工作区文件：显示常用关键文件
- 工作区技能：显示 `workspace/skills` 下的技能目录
- 结构化预览：按 JSON 顶层字段查看配置
- 中文解析说明：按模型、网关、插件、渠道、工作区等维度输出摘要
- 原始配置内容：直接编辑并保存 `openclaw.json`
- OpenClaw 更新：检查新版本并执行更新

## 后端实现

- 使用原生 Node.js `http` 服务
- 本地配置优先从 `openclaw.json` 读取
- 本地版本优先从配置目录中的版本文件推断
- 工作区路径优先从 `agents.defaults.workspace` 推断
- 更新接口执行：

```bash
npm i -g openclaw@latest
```

## API

- `GET /api/health`：健康检查
- `GET /api/discovery`：读取标准 OpenClaw 配置目录候选
- `POST /api/openclaw/load`：加载配置目录和工作区信息
- `POST /api/openclaw/save`：保存 `openclaw.json`
- `GET /api/openclaw/update-status`：检查当前版本与最新版本
- `POST /api/openclaw/update`：执行全局更新

## 打包 Windows EXE

1. 安装依赖：

```bash
npm install
```

2. 执行打包：

```bash
npm run build:win
```

3. 产物位置：

```text
dist/win/OpenClaw-Local-Manager.exe
```

## EXE 说明

- 生成的 `.exe` 会启动本地服务，并自动打开浏览器
- 前端静态资源会在 SEA 构建时嵌入到可执行文件里
- 如果当前 Node 支持 `--build-sea`，脚本会优先使用官方新流程
- 如果当前 Node 不支持 `--build-sea`，脚本会自动回退到 `postject` 注入流程
- 使用 Node 24 及更早版本构建时，请先执行 `npm install`，确保 `postject` 已安装

## 注意事项

- 这是本地工具，不包含鉴权
- 更新 OpenClaw 依赖本机 `npm` 全局安装权限
- 最新版本检查依赖访问 npm registry
- 如果修改后页面没有反映新接口，请先重启 `npm start`
