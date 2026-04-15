# 变更记录

## 1.4.0

### 界面与体验

- 软件主体界面配色调整为与应用图标一致的暖橙、酒红、紫红风格
- 统一按钮、面板、日志区与进度条的视觉配色，提升整体一致性

### OpenClaw 命令与版本操作

- 修复“检查新版本”与“更新本地配置版本”时误命中 `openclaw.cmd-随机串` 临时文件的问题
- 收紧 OpenClaw 命令发现逻辑，仅识别稳定的 `openclaw` / `openclaw.cmd` 可执行入口

### 打包与安装器

- 保持安装程序文件名为 `WeiOpenClawManager-${version}.exe`
- 保持安装后快捷方式显式引用安装目录中的 `icon.ico`

### 版本与文档

- 项目版本号从 `1.3.3` 升级到 `1.4.0`
- README 中同步更新安装包文件名示例与当前版本号

## 1.3.3

### 打包与安装器

- 安装时将 `build/icon.ico` 直接复制到安装目录根部
- 桌面与开始菜单快捷方式改为显式引用安装目录下的 `icon.ico`
- 避免快捷方式继续依赖应用目录内的图标资源路径
- 安装程序文件名改为 `WeiOpenClawManager-${version}.exe`

### 版本与文档

- 项目版本号从 `1.3.2` 升级到 `1.3.3`
- README 中同步更新安装包文件名示例与当前版本号

## 1.3.2

### 打包与安装器

- 更新应用图标与安装器图片资源
- 补充安装器头图与侧边图的源 PNG 资源，便于后续继续派生其他尺寸
- 重新生成安装器与卸载器使用的 ICO / BMP 资源，保持打包素材一致

### 版本与文档

- 项目版本号从 `1.3.1` 升级到 `1.3.2`
- README 中同步更新安装包文件名示例与当前版本号

## 1.2.1

### 产品与安装器

- 软件名称调整为 `尉龙虾OpenClaw配置管理`
- 安装包名称调整为 `尉龙虾OpenClaw配置管理-Setup-${version}.exe`
- 默认安装目录固定为 `D:\Program Files\OpenClawManager`
- 内部应用名调整为 `WeiOpenClawManager`

### OpenClaw 操作

- 增加“一键启动 OpenClaw”功能
- 增加“一键打开 OpenClaw 网关仪表盘”功能
- 启动命令修正为 `openclaw gateway`
- 仪表盘入口改为通过 `openclaw dashboard` 获取带令牌 URL 后再打开
- 修复误打开 `openclaw.ps1` 导致 Windows 弹出“如何打开这个文件”问题
- 增加“一键更新本地配置版本”功能
- 本地配置版本更新改为自动刷新到最新 OpenClaw 版本
- 增加“一键导出所有配置”和“一键导入所有配置”功能
- 导入前增加“是否同步写入配置文件”的确认提醒

### 工作区能力

- `工作区文件` 支持点击打开详情弹窗
- 工作区文件支持查看内容并直接保存修改
- `工作区技能` 支持点击打开详情弹窗
- 工作区技能支持查看 `_meta.json`、`SKILL.md`、`README.md` 和目录文件列表
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
