# 变更记录

## 1.2.1

### 产品与安装

- 软件名称调整为 `尉龙虾OpenClaw配置管理`
- 安装包名称调整为 `尉龙虾OpenClaw配置管理-Setup-${version}.exe`
- 默认安装目录固定为 `D:\Program Files\OpenClawManager`
- 内部应用名调整为 `WeiOpenClawManager`

### OpenClaw 操作

- 增加“一键启动 OpenClaw”功能
- 启动命令修正为 `openclaw gateway`
- 修复误打开 `openclaw.ps1` 导致 Windows 弹出“如何打开这个文件”问题
- 增加“一键更新本地配置版本”功能
- 本地配置版本更新改为自动刷新到最新 OpenClaw 版本

### 工作区能力

- `工作区文件` 支持点击打开详情弹窗
- 工作区文件支持查看内容并直接保存修改
- `工作区技能` 支持点击打开详情弹窗
- 工作区技能支持查询 `_meta.json`、`SKILL.md`、`README.md` 和目录文件列表
- 工作区技能支持更新 `_meta.json` 和 `SKILL.md`

### 界面优化

- “当前工作区”信息卡片字号和间距缩小
- 工作区技能详情弹窗增加右侧滚动条
- 工作区技能详情内容和编辑区域字号缩小

### 接口新增

- `POST /api/openclaw/launch`
- `POST /api/openclaw/update-local-version`
- `POST /api/workspace/file-detail`
- `POST /api/workspace/file-save`
- `POST /api/workspace/skill-detail`
- `POST /api/workspace/skill-update`
