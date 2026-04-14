const state = {
  roots: [],
  configCandidates: [],
  workspace: null
};

const discoverBtn = document.getElementById("discoverBtn");
const refreshBtn = document.getElementById("refreshBtn");
const discoverySummary = document.getElementById("discoverySummary");
const configCandidateList = document.getElementById("configCandidateList");
const pathForm = document.getElementById("pathForm");
const configPathInput = document.getElementById("configPathInput");
const workspaceStatus = document.getElementById("workspaceStatus");
const versionValue = document.getElementById("versionValue");
const versionSource = document.getElementById("versionSource");
const rootPathValue = document.getElementById("rootPathValue");
const configPathValue = document.getElementById("configPathValue");
const configMeta = document.getElementById("configMeta");
const updateStatusText = document.getElementById("updateStatusText");
const checkUpdateBtn = document.getElementById("checkUpdateBtn");
const runUpdateBtn = document.getElementById("runUpdateBtn");
const workspaceFileCount = document.getElementById("workspaceFileCount");
const workspaceFileList = document.getElementById("workspaceFileList");
const workspaceSkillCount = document.getElementById("workspaceSkillCount");
const workspaceSkillList = document.getElementById("workspaceSkillList");
const parsedView = document.getElementById("parsedView");
const parsedHint = document.getElementById("parsedHint");
const explanationHint = document.getElementById("explanationHint");
const explanationView = document.getElementById("explanationView");
const configEditor = document.getElementById("configEditor");
const saveBtn = document.getElementById("saveBtn");
const formatBtn = document.getElementById("formatBtn");
const logBox = document.getElementById("logBox");
const clearLogBtn = document.getElementById("clearLogBtn");
const updateModal = document.getElementById("updateModal");
const closeUpdateModalBtn = document.getElementById("closeUpdateModalBtn");
const updateModalStatus = document.getElementById("updateModalStatus");
const updateProgressBar = document.getElementById("updateProgressBar");
const updateModalLog = document.getElementById("updateModalLog");
const rootCardTpl = document.getElementById("rootCardTpl");
const infoCardTpl = document.getElementById("infoCardTpl");

const updateModalState = {
  closable: true
};

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  logBox.textContent = `[${time}] ${message}\n${logBox.textContent}`.trim();
}

function appendUpdateModalLog(message) {
  const time = new Date().toLocaleTimeString();
  updateModalLog.textContent = `${updateModalLog.textContent}\n[${time}] ${message}`.trim();
  updateModalLog.scrollTop = updateModalLog.scrollHeight;
}

function setUpdateModalStep(statusText, progress) {
  updateModalStatus.textContent = statusText;
  updateProgressBar.style.width = `${progress}%`;
}

function openUpdateModal() {
  updateModal.classList.remove("hidden");
  updateModal.setAttribute("aria-hidden", "false");
}

function closeUpdateModal() {
  if (!updateModalState.closable) {
    return;
  }
  updateModal.classList.add("hidden");
  updateModal.setAttribute("aria-hidden", "true");
}

function startUpdateModal() {
  updateModalState.closable = false;
  closeUpdateModalBtn.disabled = true;
  updateModalLog.textContent = "";
  openUpdateModal();
  setUpdateModalStep("准备更新环境...", 12);
  appendUpdateModalLog("开始执行 OpenClaw 更新。");
}

function finishUpdateModal(statusText, progress) {
  updateModalState.closable = true;
  closeUpdateModalBtn.disabled = false;
  setUpdateModalStep(statusText, progress);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "请求失败");
  }
  return payload;
}

function renderDiscovery() {
  configCandidateList.innerHTML = "";

  if (!state.configCandidates.length) {
    discoverySummary.textContent = "没有扫描到标准 OpenClaw 配置目录。";
    configCandidateList.innerHTML = "";
    return;
  }

  discoverySummary.textContent = state.configCandidates[0];

  state.configCandidates.forEach((configPath) => {
    const wrapper = document.createElement("button");
    wrapper.className = "chip-button";
    wrapper.type = "button";
    wrapper.textContent = configPath;

    wrapper.addEventListener("click", async () => {
      configPathInput.value = configPath;
      await loadWorkspace({
        rootPath: inferRootPathFromConfigPath(configPath),
        configPath
      });
    });

    configCandidateList.appendChild(wrapper);
  });
}

function renderParsedObject(value) {
  if (!value || typeof value !== "object") {
    parsedView.innerHTML = "<p class='muted'>当前内容不是可解析的 JSON 对象。</p>";
    parsedHint.textContent = "仅 JSON 自动解析";
    return;
  }

  const entries = Object.entries(value);
  if (!entries.length) {
    parsedView.innerHTML = "<p class='muted'>JSON 已解析，但对象为空。</p>";
    parsedHint.textContent = "JSON 已解析";
    return;
  }

  parsedHint.textContent = `JSON 已解析，顶层 ${entries.length} 个字段`;
  parsedView.innerHTML = entries
    .map(
      ([key, itemValue]) => `
        <article class="parsed-item">
          <h3>${key}</h3>
          <pre>${escapeHtml(JSON.stringify(itemValue, null, 2))}</pre>
        </article>
      `
    )
    .join("");
}

function renderInfoList(container, countNode, items, emptyMessage, mapItem) {
  container.innerHTML = "";
  countNode.textContent = `${items.length} 个`;

  if (!items.length) {
    container.innerHTML = `<p class='muted'>${emptyMessage}</p>`;
    return;
  }

  items.forEach((item) => {
    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    const mapped = mapItem(item);
    node.querySelector("[data-field='title']").textContent = mapped.title;
    node.querySelector("[data-field='path']").textContent = mapped.path;
    node.querySelector("[data-field='desc']").textContent = mapped.desc;
    container.appendChild(node);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function inferRootPathFromConfigPath(configPath) {
  const normalized = String(configPath || "");
  if (!normalized) {
    return "";
  }
  if (normalized.toLowerCase().endsWith("\\openclaw.json") || normalized.toLowerCase().endsWith("/openclaw.json")) {
    return normalized.split(/[/\\\\]/).slice(0, -1).join("\\");
  }
  return normalized;
}

function buildExplanationItems(config) {
  if (!config || typeof config !== "object") {
    return [];
  }

  const defaults = config.agents?.defaults || {};
  const primaryModel = defaults.model?.primary || "未设置";
  const modelList = Object.keys(defaults.models || {});
  const enabledChannels = Object.entries(config.channels || {})
    .filter(([, value]) => value && value.enabled)
    .map(([name]) => name);
  const allowPlugins = Array.isArray(config.plugins?.allow) ? config.plugins.allow : [];
  const installedPlugins = Object.keys(config.plugins?.installs || {});

  return [
    {
      title: "模型配置",
      path: primaryModel,
      desc: `主模型 ${primaryModel}；可选模型 ${modelList.length || 0} 个；主并发 ${defaults.maxConcurrent ?? "未配置"}；子代理并发 ${defaults.subagents?.maxConcurrent ?? "未配置"}。`
    },
    {
      title: "网关配置",
      path: `port=${config.gateway?.port || "未设置"}`,
      desc: `模式 ${config.gateway?.mode || "未设置"}；绑定 ${config.gateway?.bind || "未设置"}；认证 ${config.gateway?.auth?.mode || "未设置"}；控制台不安全认证 ${config.gateway?.controlUi?.allowInsecureAuth ? "开启" : "关闭"}。`
    },
    {
      title: "插件配置",
      path: allowPlugins.join(", ") || "无白名单",
      desc: `白名单 ${allowPlugins.length} 项；已安装插件 ${installedPlugins.length} 项；最近触达版本 ${config.meta?.lastTouchedVersion || "未知"}。`
    },
    {
      title: "渠道配置",
      path: enabledChannels.join(", ") || "无",
      desc: enabledChannels.length
        ? `当前启用 ${enabledChannels.length} 个渠道；消息确认范围 ${config.messages?.ackReactionScope || "未设置"}；会话范围 ${config.session?.dmScope || "未设置"}。`
        : "当前没有启用的渠道配置。"
    },
    {
      title: "工作区配置",
      path: defaults.workspace || "未配置工作区",
      desc: `工作区路径 ${defaults.workspace || "未设置"}；工具档位 ${config.tools?.profile || "未设置"}；搜索提供方 ${config.tools?.web?.search?.provider || "未设置"}；会话可见性 ${config.tools?.sessions?.visibility || "未设置"}。`
    }
  ];
}

function renderExplanation(config) {
  const items = buildExplanationItems(config);
  explanationView.innerHTML = "";

  if (!items.length) {
    explanationHint.textContent = "没有可解析的配置摘要";
    explanationView.innerHTML = "<p class='muted'>当前内容不足以生成中文解析说明。</p>";
    return;
  }

  explanationHint.textContent = `已生成 ${items.length} 条说明`;
  items.forEach((item) => {
    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-field='title']").textContent = item.title;
    node.querySelector("[data-field='path']").textContent = item.path;
    node.querySelector("[data-field='desc']").textContent = item.desc;
    explanationView.appendChild(node);
  });
}

function renderWorkspace() {
  const workspace = state.workspace;
  if (!workspace) {
    workspaceStatus.textContent = "未加载";
    versionValue.textContent = "unknown";
    versionSource.textContent = "未找到版本来源";
    rootPathValue.textContent = "-";
    configPathValue.textContent = "-";
    configMeta.textContent = "尚未加载配置";
    updateStatusText.textContent = "尚未检查版本";
    configEditor.value = "";
    renderInfoList(workspaceFileList, workspaceFileCount, [], "尚未读取到工作区关键文件。", (item) => item);
    renderInfoList(workspaceSkillList, workspaceSkillCount, [], "尚未读取到工作区技能。", (item) => item);
    renderExplanation(null);
    parsedView.innerHTML = "<p class='muted'>请先从自动发现列表中选择 OpenClaw 配置目录，或手动输入配置目录 / openclaw.json 路径。</p>";
    return;
  }

  workspaceStatus.textContent = workspace.config.exists ? "已加载配置" : "配置文件不存在，可直接新建";
  versionValue.textContent = workspace.version?.value || "unknown";
  versionSource.textContent = workspace.version?.source || workspace.version?.detail || "未找到版本来源";
  rootPathValue.textContent = workspace.rootPath || "-";
  configPathValue.textContent = workspace.config.path || "-";
  configMeta.textContent = workspace.config.exists
    ? `格式: ${workspace.config.format}`
    : "openclaw.json 不存在，保存后会自动创建";
  configEditor.value = workspace.config.raw || "";
  renderInfoList(
    workspaceFileList,
    workspaceFileCount,
    workspace.workspace?.keyFiles || [],
    "当前工作区没有发现预设关键文件。",
    (item) => ({
      title: item.name,
      path: item.path,
      desc: `${item.size} bytes`
    })
  );
  renderInfoList(
    workspaceSkillList,
    workspaceSkillCount,
    workspace.workspace?.skills || [],
    "当前工作区没有发现技能目录。",
    (item) => ({
      title: item.title || item.name,
      path: item.path,
      desc: item.description || item.name
    })
  );

  renderParsedObject(workspace.config.parsed);
    renderExplanation(workspace.config.parsed);
}

function renderUpdateStatus(status) {
  if (!status) {
    updateStatusText.textContent = "尚未检查版本";
    return;
  }

  if (status.error) {
    updateStatusText.textContent = `当前 ${status.installed?.value || "unknown"}，最新版本检查失败: ${status.error}`;
    return;
  }

  if (status.canUpdate) {
    updateStatusText.textContent = `当前 ${status.installed.value}，最新 ${status.latest}，可更新`;
    return;
  }

  updateStatusText.textContent = `当前 ${status.installed?.value || "unknown"}，最新 ${status.latest || "unknown"}，已是最新`;
}

async function discover() {
  const data = await request("/api/discovery");
  state.roots = data.roots || [];
  state.configCandidates = data.configCandidates || [];
  renderDiscovery();

  if (!state.workspace && state.roots.length) {
    const first = state.roots[0];
    configPathInput.value = first.configPath || `${first.rootPath}\\openclaw.json`;
  }

  if (!state.workspace && state.configCandidates.length) {
    const firstConfig = state.configCandidates[0];
    configPathInput.value = firstConfig;
  }
}

async function loadWorkspace(payload) {
  const workspace = await request("/api/openclaw/load", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.workspace = workspace;
  renderWorkspace();
  appendLog(`已加载 OpenClaw 配置: ${workspace.config.path}`);
}

async function checkUpdate() {
  const status = await request("/api/openclaw/update-status");
  renderUpdateStatus(status);
  appendLog(
    status.error
      ? `检查更新失败: ${status.error}`
      : status.canUpdate
        ? `发现新版本: ${status.latest}`
        : `当前已是最新版本: ${status.installed?.value || "unknown"}`
  );
}

async function runUpdate() {
  startUpdateModal();
  appendUpdateModalLog("检查当前已安装版本。");
  setUpdateModalStep("正在执行 npm i -g openclaw@latest ...", 42);
  const result = await request("/api/openclaw/update", { method: "POST" });
  appendUpdateModalLog(`版本变更: ${result.result.before.value} -> ${result.result.after.value}`);
  if (result.result.output) {
    appendUpdateModalLog(result.result.output);
  }
  setUpdateModalStep("正在校验更新结果...", 78);
  appendLog(`OpenClaw 已更新: ${result.result.before.value} -> ${result.result.after.value}`);
  appendLog(result.result.output);
  await checkUpdate();
  finishUpdateModal("更新完成", 100);
  appendUpdateModalLog("更新完成，可以关闭弹窗。");
}

async function saveWorkspace() {
  const configPath = String(configPathInput.value || state.workspace?.config?.path || "").trim();
  if (!configPath) {
    appendLog("请先填写 OpenClaw 配置目录或 openclaw.json 路径");
    return;
  }

  const result = await request("/api/openclaw/save", {
    method: "POST",
    body: JSON.stringify({
      configPath,
      content: configEditor.value
    })
  });

  state.workspace = result.workspace;
  renderWorkspace();
  appendLog(`OpenClaw 配置已保存: ${configPath}`);
}

pathForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await loadWorkspace({
      rootPath: inferRootPathFromConfigPath(configPathInput.value),
      configPath: configPathInput.value
    });
  } catch (error) {
    appendLog(`加载失败: ${error.message}`);
  }
});

discoverBtn.addEventListener("click", async () => {
  try {
    await discover();
    appendLog("已重新扫描本地目录");
  } catch (error) {
    appendLog(`扫描失败: ${error.message}`);
  }
});

refreshBtn.addEventListener("click", async () => {
  try {
    if (!configPathInput.value) {
      await discover();
      appendLog("已刷新自动发现结果");
      return;
    }
    await loadWorkspace({
      rootPath: inferRootPathFromConfigPath(configPathInput.value),
      configPath: configPathInput.value
    });
  } catch (error) {
    appendLog(`刷新失败: ${error.message}`);
  }
});

checkUpdateBtn.addEventListener("click", async () => {
  try {
    await checkUpdate();
  } catch (error) {
    appendLog(`检查更新失败: ${error.message}`);
    renderUpdateStatus({ installed: { value: "unknown" }, latest: "unknown", error: error.message });
  }
});

runUpdateBtn.addEventListener("click", async () => {
  try {
    runUpdateBtn.disabled = true;
    runUpdateBtn.textContent = "更新中...";
    await runUpdate();
  } catch (error) {
    if (updateModal.classList.contains("hidden")) {
      startUpdateModal();
    }
    appendLog(`更新失败: ${error.message}`);
    appendUpdateModalLog(`更新失败: ${error.message}`);
    finishUpdateModal("更新失败", 100);
  } finally {
    runUpdateBtn.disabled = false;
    runUpdateBtn.textContent = "执行更新";
  }
});

closeUpdateModalBtn.addEventListener("click", () => {
  closeUpdateModal();
});

saveBtn.addEventListener("click", async () => {
  try {
    await saveWorkspace();
  } catch (error) {
    appendLog(`保存失败: ${error.message}`);
  }
});

formatBtn.addEventListener("click", () => {
  try {
    const parsed = JSON.parse(configEditor.value || "{}");
    configEditor.value = JSON.stringify(parsed, null, 2);
    appendLog("JSON 已格式化");
  } catch (error) {
    appendLog(`格式化失败: ${error.message}`);
  }
});

clearLogBtn.addEventListener("click", () => {
  logBox.textContent = "";
});

configEditor.addEventListener("input", () => {
  try {
    const parsed = JSON.parse(configEditor.value || "{}");
    renderParsedObject(parsed);
    renderExplanation(parsed);
  } catch {
    parsedView.innerHTML = "<p class='muted'>当前文本不是合法 JSON，仍可按原样保存。</p>";
    parsedHint.textContent = "仅 JSON 自动解析";
    renderExplanation(null);
  }
});

async function bootstrap() {
  appendLog("系统初始化中...");
  renderWorkspace();
  try {
    await discover();
    await checkUpdate();
    appendLog("初始化完成");
  } catch (error) {
    appendLog(`初始化失败: ${error.message}`);
  }
}

bootstrap();
