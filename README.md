# OpenClaw Skill 下载与管理工具

一个本地运行的可视化控制台，用于管理 OpenClaw Skills：

- 从 Git 仓库下载并安装 Skill
- 查看已安装 Skill 列表和元信息
- 启用 / 停用 Skill
- 拉取最新代码更新 Skill
- 卸载 Skill

## 快速开始

1. 安装 Node.js 22+
2. 在项目目录执行：

```bash
npm start
```

3. 浏览器打开：

```text
http://localhost:4173
```

## 目录说明

- `server.js`：后端 API + 静态资源服务
- `public/`：前端页面与交互逻辑
- `openclaw-skills/`：Skill 安装目录（启动时自动创建）
- `skill-manager-state.json`：Skill 启用状态和来源信息
- `catalog.json`：推荐 Skill 列表（可自行维护）

## API 概览

- `GET /api/catalog`：读取推荐 Skill 列表
- `GET /api/skills`：读取本地已安装 Skill 列表
- `POST /api/skills/install`：安装 Skill（参数：`name`、`repoUrl`、`branch`）
- `POST /api/skills/:name/toggle`：启停 Skill（参数：`enabled`）
- `POST /api/skills/:name/update`：更新 Skill（`git pull --ff-only`）
- `DELETE /api/skills/:name`：卸载 Skill

## 注意事项

- 安装与更新依赖本机 `git` 命令。
- 默认分支为 `main`，如果仓库使用其他分支请手动填写。
- 当前工具面向本地开发环境，不包含权限鉴权与多用户隔离。
