const state = {
  roots: [],
  configCandidates: [],
  workspace: null
};

const discoverBtn = document.getElementById("discoverBtn");
const refreshBtn = document.getElementById("refreshBtn");
const launchOpenClawBtn = document.getElementById("launchOpenClawBtn");
const openControlBtn = document.getElementById("openControlBtn");
const openClawHubSiteBtn = document.getElementById("openClawHubSiteBtn");
const clawhubPackageInput = document.getElementById("clawhubPackageInput");
const installClawHubBtn = document.getElementById("installClawHubBtn");
const exportAllBtn = document.getElementById("exportAllBtn");
const importAllBtn = document.getElementById("importAllBtn");
const importAllInput = document.getElementById("importAllInput");
const discoverySummary = document.getElementById("discoverySummary");
const configCandidateList = document.getElementById("configCandidateList");
const pathForm = document.getElementById("pathForm");
const configPathInput = document.getElementById("configPathInput");
const workspaceStatus = document.getElementById("workspaceStatus");
const globalVersionValue = document.getElementById("globalVersionValue");
const globalVersionSource = document.getElementById("globalVersionSource");
const localVersionValue = document.getElementById("localVersionValue");
const localVersionSource = document.getElementById("localVersionSource");
const rootPathValue = document.getElementById("rootPathValue");
const configPathValue = document.getElementById("configPathValue");
const configMeta = document.getElementById("configMeta");
const updateStatusText = document.getElementById("updateStatusText");
const updateLocalVersionBtn = document.getElementById("updateLocalVersionBtn");
const checkUpdateBtn = document.getElementById("checkUpdateBtn");
const runUpdateBtn = document.getElementById("runUpdateBtn");
const modelSummary = document.getElementById("modelSummary");
const modelCount = document.getElementById("modelCount");
const modelList = document.getElementById("modelList");
const modelNameInput = document.getElementById("modelNameInput");
const modelProviderInput = document.getElementById("modelProviderInput");
const modelIdInput = document.getElementById("modelIdInput");
const modelBaseUrlInput = document.getElementById("modelBaseUrlInput");
const modelApiKeyInput = document.getElementById("modelApiKeyInput");
const modelExtraConfigInput = document.getElementById("modelExtraConfigInput");
const primaryModelSelect = document.getElementById("primaryModelSelect");
const saveModelConfigBtn = document.getElementById("saveModelConfigBtn");
const saveAndSwitchModelBtn = document.getElementById("saveAndSwitchModelBtn");
const switchModelBtn = document.getElementById("switchModelBtn");
const clearModelFormBtn = document.getElementById("clearModelFormBtn");
const workspaceFileCount = document.getElementById("workspaceFileCount");
const workspaceFileList = document.getElementById("workspaceFileList");
const workspaceSkillCount = document.getElementById("workspaceSkillCount");
const workspaceSkillList = document.getElementById("workspaceSkillList");
const pluginCount = document.getElementById("pluginCount");
const pluginList = document.getElementById("pluginList");
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
const updateModalTitle = document.getElementById("updateModalTitle");
const closeUpdateModalBtn = document.getElementById("closeUpdateModalBtn");
const updateModalStatus = document.getElementById("updateModalStatus");
const updateProgressBar = document.getElementById("updateProgressBar");
const updateModalLog = document.getElementById("updateModalLog");
const workspaceDetailModal = document.getElementById("workspaceDetailModal");
const workspaceDetailTitle = document.getElementById("workspaceDetailTitle");
const workspaceDetailPath = document.getElementById("workspaceDetailPath");
const workspaceDetailMeta = document.getElementById("workspaceDetailMeta");
const workspaceDetailExtra = document.getElementById("workspaceDetailExtra");
const workspaceDetailEditor = document.getElementById("workspaceDetailEditor");
const workspaceDetailSecondaryEditor = document.getElementById("workspaceDetailSecondaryEditor");
const workspaceDetailRefreshBtn = document.getElementById("workspaceDetailRefreshBtn");
const workspaceDetailSaveBtn = document.getElementById("workspaceDetailSaveBtn");
const closeWorkspaceDetailBtn = document.getElementById("closeWorkspaceDetailBtn");
const rootCardTpl = document.getElementById("rootCardTpl");
const infoCardTpl = document.getElementById("infoCardTpl");
const interactiveCardTpl = document.getElementById("interactiveCardTpl");

const updateModalState = {
  closable: true
};

const workspaceDetailState = {
  mode: null,
  filePath: null,
  skillPath: null
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

function startUpdateModal({ title = "任务进度", statusText = "准备执行...", progress = 12, logMessage = "" } = {}) {
  updateModalState.closable = false;
  closeUpdateModalBtn.disabled = true;
  updateModalTitle.textContent = title;
  updateModalLog.textContent = "";
  openUpdateModal();
  setUpdateModalStep(statusText, progress);
  if (logMessage) {
    appendUpdateModalLog(logMessage);
  }
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

async function streamJsonLines(response, onMessage) {
  if (!response.body) {
    throw new Error("浏览器未返回可读取的流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      onMessage(JSON.parse(trimmed));
    }
  }

  const finalChunk = `${buffer}${decoder.decode()}`.trim();
  if (finalChunk) {
    onMessage(JSON.parse(finalChunk));
  }
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
    return normalized.split(/[/\\]/).slice(0, -1).join("\\");
  }
  return normalized;
}

function formatVersionText(version) {
  return version?.value || "unknown";
}

function formatVersionSource(version, fallback) {
  if (version?.source && version?.detail) {
    return `${version.source} · ${version.detail}`;
  }
  return version?.source || version?.detail || fallback;
}

function getVersionPair(workspace) {
  return {
    global: workspace?.versions?.global || { value: "unknown", source: null, detail: null },
    local: workspace?.versions?.local || workspace?.version || { value: "unknown", source: null, detail: null }
  };
}

function renderDiscovery() {
  configCandidateList.innerHTML = "";

  if (!state.configCandidates.length) {
    discoverySummary.textContent = "没有扫描到标准 OpenClaw 配置目录。";
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
    parsedHint.textContent = "从 JSON 自动解析";
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
          <h3>${escapeHtml(key)}</h3>
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

function renderInteractiveList(container, countNode, items, emptyMessage, mapItem, onOpen) {
  container.innerHTML = "";
  countNode.textContent = `${items.length} 个`;

  if (!items.length) {
    container.innerHTML = `<p class='muted'>${emptyMessage}</p>`;
    return;
  }

  items.forEach((item) => {
    const mapped = mapItem(item);
    const node = interactiveCardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-field='title']").textContent = mapped.title;
    node.querySelector("[data-field='path']").textContent = mapped.path;
    node.querySelector("[data-field='desc']").textContent = mapped.desc;
    node.querySelector("[data-action='open']").addEventListener("click", () => onOpen(item));
    container.appendChild(node);
  });
}

function renderManagedSkillList(items) {
  workspaceSkillList.innerHTML = "";
  workspaceSkillCount.textContent = `${items.length} 个`;

  if (!items.length) {
    workspaceSkillList.innerHTML = "<p class='muted'>当前工作区没有发现技能目录。</p>";
    return;
  }

  items.forEach((item) => {
    const node = interactiveCardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-field='title']").textContent = item.title || item.name;
    node.querySelector("[data-field='path']").textContent = item.path;
    node.querySelector("[data-field='desc']").textContent = item.description || item.name;
    node.querySelector("[data-action='open']").addEventListener("click", () => openWorkspaceSkillDetail(item));

    const actions = node.querySelector(".actions") || node.querySelector(".row-head");
    const uninstallBtn = document.createElement("button");
    uninstallBtn.className = "btn btn-danger";
    uninstallBtn.type = "button";
    uninstallBtn.textContent = "卸载";
    uninstallBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      uninstallWorkspaceSkill(item);
    });
    actions.appendChild(uninstallBtn);
    workspaceSkillList.appendChild(node);
  });
}

function getPluginEntries(config) {
  const installs = config?.plugins?.installs || {};
  const allow = Array.isArray(config?.plugins?.allow) ? config.plugins.allow : [];
  const names = new Set();

  if (installs && typeof installs === "object" && !Array.isArray(installs)) {
    Object.keys(installs).forEach((name) => names.add(name));
  }
  allow.forEach((name) => names.add(name));

  return Array.from(names)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      install: installs?.[name],
      allowed: allow.includes(name)
    }));
}

function renderPluginList(config) {
  const plugins = getPluginEntries(config);
  pluginList.innerHTML = "";
  pluginCount.textContent = `${plugins.length} 个`;

  if (!plugins.length) {
    pluginList.innerHTML = "<p class='muted'>当前配置没有插件安装记录或白名单条目。</p>";
    return;
  }

  plugins.forEach((plugin) => {
    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    const installSummary =
      plugin.install && typeof plugin.install === "object"
        ? JSON.stringify(plugin.install)
        : plugin.install
          ? String(plugin.install)
          : "仅白名单";
    node.querySelector("[data-field='title']").textContent = plugin.name;
    node.querySelector("[data-field='path']").textContent = plugin.allowed ? "白名单已允许" : "未在白名单";
    node.querySelector("[data-field='desc']").textContent = installSummary;

    const actions = document.createElement("div");
    actions.className = "actions item-actions";
    const uninstallBtn = document.createElement("button");
    uninstallBtn.className = "btn btn-danger";
    uninstallBtn.type = "button";
    uninstallBtn.textContent = "卸载插件";
    uninstallBtn.addEventListener("click", () => uninstallPlugin(plugin));
    actions.appendChild(uninstallBtn);
    node.appendChild(actions);
    pluginList.appendChild(node);
  });
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
      desc: `主模型 ${primaryModel}；可选模型 ${modelList.length} 个；主并发 ${defaults.maxConcurrent ?? "未配置"}；子代理并发 ${defaults.subagents?.maxConcurrent ?? "未配置"}。`
    },
    {
      title: "网关配置",
      path: `port=${config.gateway?.port || "未设置"}`,
      desc: `模式 ${config.gateway?.mode || "未设置"}；绑定 ${config.gateway?.bind || "未设置"}；认证 ${config.gateway?.auth?.mode || "未设置"}。`
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
      desc: `工作区路径 ${defaults.workspace || "未设置"}；工具档位 ${config.tools?.profile || "未设置"}；搜索提供方 ${config.tools?.web?.search?.provider || "未设置"}。`
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

function getModelDefaults(config) {
  return config?.agents?.defaults || {};
}

function getModelEntries(config) {
  const models = getModelDefaults(config).models || {};
  if (!models || typeof models !== "object" || Array.isArray(models)) {
    return [];
  }
  return Object.entries(models).map(([name, value]) => ({
    name,
    config: value && typeof value === "object" && !Array.isArray(value) ? value : {}
  }));
}

function getPrimaryModelName(config) {
  return getModelDefaults(config).model?.primary || "";
}

function maskSecret(value) {
  const secret = String(value || "");
  if (!secret) {
    return "未设置";
  }
  if (secret.length <= 8) {
    return "已设置";
  }
  return `${secret.slice(0, 4)}...${secret.slice(-4)}`;
}

function pickModelId(modelConfig, fallbackName) {
  return modelConfig.model || modelConfig.modelId || modelConfig.id || fallbackName;
}

function pickBaseUrl(modelConfig) {
  return modelConfig.baseURL || modelConfig.baseUrl || modelConfig.base_url || "";
}

function pickApiKey(modelConfig) {
  return modelConfig.apiKey || modelConfig.api_key || "";
}

function clearModelForm() {
  modelNameInput.value = "";
  modelProviderInput.value = "";
  modelIdInput.value = "";
  modelBaseUrlInput.value = "";
  modelApiKeyInput.value = "";
  modelExtraConfigInput.value = "{}";
}

function fillModelForm(name, modelConfig) {
  const extraConfig = { ...(modelConfig || {}) };
  delete extraConfig.provider;
  delete extraConfig.model;
  delete extraConfig.modelId;
  delete extraConfig.id;
  delete extraConfig.baseURL;
  delete extraConfig.baseUrl;
  delete extraConfig.base_url;
  delete extraConfig.apiKey;
  delete extraConfig.api_key;

  modelNameInput.value = name || "";
  modelProviderInput.value = modelConfig?.provider || "";
  modelIdInput.value = pickModelId(modelConfig || {}, name || "");
  modelBaseUrlInput.value = pickBaseUrl(modelConfig || {});
  modelApiKeyInput.value = "";
  modelExtraConfigInput.value = `${JSON.stringify(extraConfig, null, 2)}\n`;
}

function buildModelConfigFromForm(existingConfig = {}) {
  let extraConfig = {};
  const extraRaw = String(modelExtraConfigInput.value || "{}").trim();
  if (extraRaw) {
    extraConfig = JSON.parse(extraRaw);
    if (!extraConfig || typeof extraConfig !== "object" || Array.isArray(extraConfig)) {
      throw new Error("其他配置 JSON 必须是对象");
    }
  }

  const nextConfig = { ...extraConfig };
  const provider = String(modelProviderInput.value || "").trim();
  const modelId = String(modelIdInput.value || "").trim();
  const baseUrl = String(modelBaseUrlInput.value || "").trim();
  const apiKey = String(modelApiKeyInput.value || "").trim();

  if (provider) {
    nextConfig.provider = provider;
  }
  if (modelId) {
    nextConfig.model = modelId;
  }
  if (baseUrl) {
    nextConfig.baseURL = baseUrl;
  }
  if (apiKey) {
    nextConfig.apiKey = apiKey;
  } else if (existingConfig.apiKey) {
    nextConfig.apiKey = existingConfig.apiKey;
  } else if (existingConfig.api_key) {
    nextConfig.api_key = existingConfig.api_key;
  }

  return nextConfig;
}

function renderModelConfig(config) {
  const entries = getModelEntries(config);
  const primaryModel = getPrimaryModelName(config);
  modelList.innerHTML = "";
  primaryModelSelect.innerHTML = "";
  modelCount.textContent = `${entries.length} 个`;
  modelSummary.textContent = primaryModel ? `当前主模型：${primaryModel}` : "尚未设置主模型";

  if (!entries.length) {
    modelList.innerHTML = "<p class='muted'>当前配置还没有模型条目。</p>";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "无可选模型";
    primaryModelSelect.appendChild(option);
    clearModelForm();
    return;
  }

  entries.forEach(({ name, config: modelConfig }) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name === primaryModel ? `${name}（当前）` : name;
    primaryModelSelect.appendChild(option);

    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    node.classList.add("model-card");
    if (name === primaryModel) {
      node.classList.add("active-model");
    }
    node.querySelector("[data-field='title']").textContent = name === primaryModel ? `${name} · 主模型` : name;
    node.querySelector("[data-field='path']").textContent = pickModelId(modelConfig, name);
    node.querySelector("[data-field='desc']").textContent =
      `Provider ${modelConfig.provider || "未设置"}；Base URL ${pickBaseUrl(modelConfig) || "未设置"}；API Key ${maskSecret(pickApiKey(modelConfig))}`;
    node.addEventListener("click", () => fillModelForm(name, modelConfig));
    modelList.appendChild(node);
  });

  primaryModelSelect.value = primaryModel || entries[0].name;
  const selectedEntry = entries.find((item) => item.name === primaryModelSelect.value) || entries[0];
  fillModelForm(selectedEntry.name, selectedEntry.config);
}

function getCurrentModelConfigByName(modelName) {
  const entries = getModelEntries(state.workspace?.config?.parsed);
  return entries.find((item) => item.name === modelName)?.config || {};
}

async function updateModelConfig({ shouldSave, shouldSwitch }) {
  const payload = getCurrentWorkspacePayload();
  if (!payload.configPath) {
    appendLog("请先加载 OpenClaw 配置，再更新模型配置");
    return;
  }

  const body = { ...payload };
  const modelName = String(modelNameInput.value || "").trim();

  if (shouldSave) {
    if (!modelName) {
      appendLog("请输入模型名称");
      return;
    }
    body.modelName = modelName;
    body.modelConfig = buildModelConfigFromForm(getCurrentModelConfigByName(modelName));
  }

  if (shouldSwitch) {
    body.primaryModel = shouldSave ? modelName : primaryModelSelect.value;
    if (!body.primaryModel) {
      appendLog("请选择要切换的主模型");
      return;
    }
  }

  const result = await request("/api/openclaw/model-config", {
    method: "POST",
    body: JSON.stringify(body)
  });

  state.workspace = result.result.workspace;
  renderWorkspace();
  appendLog(
    shouldSave && shouldSwitch
      ? `模型 ${result.result.modelName} 已保存并切换为主模型`
      : shouldSave
        ? `模型 ${result.result.modelName} 已保存`
        : `主模型已切换为 ${result.result.primaryModel}`
  );
}

function renderWorkspace() {
  const workspace = state.workspace;
  if (!workspace) {
    workspaceStatus.textContent = "未加载";
    globalVersionValue.textContent = "unknown";
    globalVersionSource.textContent = "未找到全局版本来源";
    localVersionValue.textContent = "unknown";
    localVersionSource.textContent = "未找到本地版本来源";
    rootPathValue.textContent = "-";
    configPathValue.textContent = "-";
    configMeta.textContent = "尚未加载配置";
    updateStatusText.textContent = "尚未检查版本";
    configEditor.value = "";
    clearModelForm();
    renderModelConfig(null);
    renderPluginList(null);
    renderInteractiveList(workspaceFileList, workspaceFileCount, [], "尚未读取到工作区关键文件。", (item) => item, () => {});
    renderManagedSkillList([]);
    renderExplanation(null);
    parsedView.innerHTML = "<p class='muted'>请先从自动发现列表中选择 OpenClaw 配置目录，或手动输入配置目录 / openclaw.json 路径。</p>";
    return;
  }

  const versions = getVersionPair(workspace);
  workspaceStatus.textContent = workspace.config.exists ? "已加载配置" : "配置文件不存在，可直接新建";
  globalVersionValue.textContent = formatVersionText(versions.global);
  globalVersionSource.textContent = formatVersionSource(versions.global, "未找到全局版本来源");
  localVersionValue.textContent = formatVersionText(versions.local);
  localVersionSource.textContent = formatVersionSource(versions.local, "未找到本地版本来源");
  rootPathValue.textContent = workspace.rootPath || "-";
  configPathValue.textContent = workspace.config.path || "-";
  configMeta.textContent = workspace.config.exists
    ? `格式: ${workspace.config.format}`
    : "openclaw.json 不存在，保存后会自动创建";
  configEditor.value = workspace.config.raw || "";

  renderInteractiveList(
    workspaceFileList,
    workspaceFileCount,
    workspace.workspace?.keyFiles || [],
    "当前工作区没有发现预设关键文件。",
    (item) => ({
      title: item.name,
      path: item.path,
      desc: `${item.size} bytes`
    }),
    openWorkspaceFileDetail
  );

  renderManagedSkillList(workspace.workspace?.skills || []);

  renderParsedObject(workspace.config.parsed);
  renderExplanation(workspace.config.parsed);
  renderModelConfig(workspace.config.parsed);
  renderPluginList(workspace.config.parsed);
}

function renderUpdateStatus(status) {
  if (!status) {
    updateStatusText.textContent = "尚未检查版本";
    return;
  }

  const globalVersion = status.versions?.global || status.installed || { value: "unknown" };

  if (status.error) {
    updateStatusText.textContent = `全局 ${globalVersion.value || "unknown"}，最新检查失败: ${status.error}`;
    return;
  }

  if (status.canUpdate) {
    updateStatusText.textContent = `全局 ${globalVersion.value}，最新 ${status.latest}，可更新`;
    return;
  }

  updateStatusText.textContent = `全局 ${globalVersion.value || "unknown"}，最新 ${status.latest || "unknown"}，已是最新`;
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
    configPathInput.value = state.configCandidates[0];
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
        : `当前已是最新版本: ${status.versions?.global?.value || status.installed?.value || "unknown"}`
  );
}

function formatVersionTransition(label, before, after) {
  return `${label}: ${before?.value || "unknown"} -> ${after?.value || "unknown"}`;
}

async function runUpdate() {
  startUpdateModal({
    title: "OpenClaw 更新进度",
    statusText: "准备更新环境...",
    progress: 12,
    logMessage: "开始执行 OpenClaw 更新。"
  });
  appendUpdateModalLog("检查当前版本。");
  setUpdateModalStep("正在执行 npm i -g openclaw@latest ...", 42);
  const result = await request("/api/openclaw/update", { method: "POST" });
  appendUpdateModalLog(formatVersionTransition("全局版本", result.result.before.global, result.result.after.global));
  appendUpdateModalLog(formatVersionTransition("本地配置版本", result.result.before.local, result.result.after.local));
  if (result.result.output) {
    appendUpdateModalLog(result.result.output);
  }
  setUpdateModalStep("正在校验更新结果...", 78);
  appendLog(`OpenClaw 已更新: ${result.result.before.global.value} -> ${result.result.after.global.value}`);
  appendLog(result.result.output);

  if (state.workspace) {
    await loadWorkspace({
      rootPath: state.workspace.rootPath,
      configPath: state.workspace.config.path
    });
  }

  await checkUpdate();
  finishUpdateModal("更新完成", 100);
  appendUpdateModalLog("更新完成，可以关闭弹窗。");
}

async function launchOpenClaw() {
  const rootPath =
    state.workspace?.rootPath || inferRootPathFromConfigPath(configPathInput.value) || "";
  const result = await request("/api/openclaw/launch", {
    method: "POST",
    body: JSON.stringify({ rootPath })
  });

  appendLog(`已启动 OpenClaw (${result.result.source})，工作目录: ${result.result.cwd}`);
}

async function openOpenClawControl() {
  const result = await request("/api/openclaw/control", {
    method: "POST"
  });

  appendLog(`已打开 OpenClaw 网关仪表盘: ${result.result.url}`);
}

function setClawHubInstallBusy(isBusy) {
  clawhubPackageInput.disabled = isBusy;
  installClawHubBtn.disabled = isBusy;
}

function openClawHubSite() {
  window.open("https://clawhub.ai/", "_blank", "noopener,noreferrer");
  appendLog("已打开 ClawHub 官网: https://clawhub.ai/");
}

async function installClawHubPackage() {
  const packageName = String(clawhubPackageInput.value || "").trim();
  if (!packageName) {
    appendLog("请输入 ClawHub 包名");
    return;
  }

  setClawHubInstallBusy(true);
  startUpdateModal({
    title: "ClawHub 安装进度",
    statusText: `准备安装 ${packageName} ...`,
    progress: 8,
    logMessage: `开始执行 clawhub install ${packageName}`
  });

  let failedMessage = "";

  try {
    const response = await fetch("/api/clawhub/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        packageName,
        rootPath: state.workspace?.rootPath || inferRootPathFromConfigPath(configPathInput.value) || ""
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "ClawHub 安装请求失败");
    }

    await streamJsonLines(response, (event) => {
      if (typeof event.progress === "number") {
        setUpdateModalStep(event.message || "处理中...", event.progress);
      }

      if (event.message) {
        appendUpdateModalLog(event.message);
      }

      if (event.type === "complete") {
        finishUpdateModal("安装完成", 100);
        appendLog(`ClawHub 包安装完成: ${packageName}`);
      }

      if (event.type === "error") {
        failedMessage = event.message || "ClawHub 安装失败";
      }
    });

    if (failedMessage) {
      throw new Error(failedMessage);
    }
  } catch (error) {
    appendLog(`ClawHub 包安装失败: ${error.message}`);
    appendUpdateModalLog(`安装失败: ${error.message}`);
    finishUpdateModal("安装失败", 100);
  } finally {
    setClawHubInstallBusy(false);
  }
}

function getCurrentWorkspacePayload() {
  return {
    rootPath: state.workspace?.rootPath || inferRootPathFromConfigPath(configPathInput.value) || "",
    configPath: String(configPathInput.value || state.workspace?.config?.path || "").trim()
  };
}

function downloadJsonFile(filename, data) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportAllConfig() {
  const payload = getCurrentWorkspacePayload();
  if (!payload.configPath) {
    appendLog("请先加载 OpenClaw 配置，再导出所有配置");
    return;
  }

  const result = await request("/api/openclaw/export-all", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  const stamp = new Date().toISOString().replaceAll(":", "-");
  downloadJsonFile(`openclaw-all-config-${stamp}.json`, result.result);
  appendLog("已导出所有配置");
}

async function importAllConfig(bundle) {
  const payload = getCurrentWorkspacePayload();
  if (!payload.configPath) {
    appendLog("请先加载 OpenClaw 配置，再导入所有配置");
    return;
  }

  const fileCount = Array.isArray(bundle?.workspaceFiles) ? bundle.workspaceFiles.length : 0;
  const skillCount = Array.isArray(bundle?.skills) ? bundle.skills.length : 0;
  const confirmed = window.confirm(
    `将导入当前备份，并同步写入配置文件。\n\nopenclaw.json: 1 个\n工作区文件: ${fileCount} 个\n工作区技能: ${skillCount} 个\n\n是否继续写入？`
  );

  if (!confirmed) {
    appendLog("已取消导入所有配置");
    return;
  }

  const result = await request("/api/openclaw/import-all", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      bundle,
      writeFiles: true
    })
  });

  state.workspace = result.result.workspace;
  renderWorkspace();
  appendLog(`已导入所有配置，工作区文件 ${result.result.summary.workspaceFiles} 个，技能 ${result.result.summary.skills} 个`);
}

async function updateLocalConfigVersion() {
  const rootPath =
    state.workspace?.rootPath || inferRootPathFromConfigPath(configPathInput.value) || "";
  const configPath = String(configPathInput.value || state.workspace?.config?.path || "").trim();
  if (!configPath) {
    appendLog("请先填写 OpenClaw 配置目录或 openclaw.json 路径");
    return;
  }

  const result = await request("/api/openclaw/update-local-version", {
    method: "POST",
    body: JSON.stringify({ rootPath, configPath })
  });

  state.workspace = result.result.workspace;
  renderWorkspace();
  appendLog(`本地配置版本已更新为 ${result.result.version}`);
}

async function uninstallWorkspaceSkill(skillItem) {
  const payload = getCurrentWorkspacePayload();
  if (!payload.configPath) {
    appendLog("请先加载 OpenClaw 配置，再卸载技能");
    return;
  }

  const skillName = skillItem.title || skillItem.name || skillItem.path;
  const confirmed = window.confirm(`将删除技能目录：\n${skillItem.path}\n\n是否继续卸载 ${skillName}？`);
  if (!confirmed) {
    appendLog(`已取消卸载技能: ${skillName}`);
    return;
  }

  const result = await request("/api/workspace/skill-uninstall", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      skillPath: skillItem.path
    })
  });

  state.workspace = result.result.workspace;
  renderWorkspace();
  appendLog(`技能已卸载: ${skillName}`);
}

async function uninstallPlugin(plugin) {
  const payload = getCurrentWorkspacePayload();
  if (!payload.configPath) {
    appendLog("请先加载 OpenClaw 配置，再卸载插件");
    return;
  }

  const confirmed = window.confirm(`将从 openclaw.json 中移除插件：\n${plugin.name}\n\n是否继续？`);
  if (!confirmed) {
    appendLog(`已取消卸载插件: ${plugin.name}`);
    return;
  }

  const result = await request("/api/openclaw/plugin-uninstall", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      pluginName: plugin.name
    })
  });

  state.workspace = result.result.workspace;
  renderWorkspace();
  appendLog(`插件已卸载: ${result.result.pluginName}`);
}

function openWorkspaceDetailModal() {
  workspaceDetailModal.classList.remove("hidden");
  workspaceDetailModal.setAttribute("aria-hidden", "false");
}

function closeWorkspaceDetailModal() {
  workspaceDetailModal.classList.add("hidden");
  workspaceDetailModal.setAttribute("aria-hidden", "true");
}

function renderDetailMetaBlocks(items) {
  workspaceDetailMeta.innerHTML = "";
  items.forEach((item) => {
    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-field='title']").textContent = item.title;
    node.querySelector("[data-field='path']").textContent = item.path || "-";
    node.querySelector("[data-field='desc']").textContent = item.desc || "";
    workspaceDetailMeta.appendChild(node);
  });
}

function renderDetailExtraBlocks(items) {
  workspaceDetailExtra.innerHTML = "";
  items.forEach((item) => {
    const node = infoCardTpl.content.firstElementChild.cloneNode(true);
    node.querySelector("[data-field='title']").textContent = item.title;
    node.querySelector("[data-field='path']").textContent = item.path || "-";
    node.querySelector("[data-field='desc']").textContent = item.desc || "";
    workspaceDetailExtra.appendChild(node);
  });
}

async function openWorkspaceFileDetail(fileItem) {
  const rootPath = state.workspace?.rootPath || "";
  const configPath = state.workspace?.config?.path || configPathInput.value;
  const result = await request("/api/workspace/file-detail", {
    method: "POST",
    body: JSON.stringify({
      rootPath,
      configPath,
      filePath: fileItem.path
    })
  });

  workspaceDetailState.mode = "file";
  workspaceDetailState.filePath = fileItem.path;
  workspaceDetailState.skillPath = null;
  workspaceDetailTitle.textContent = `工作区文件: ${fileItem.name}`;
  workspaceDetailPath.textContent = result.result.file.path;
  renderDetailMetaBlocks([
    { title: "文件大小", path: `${result.result.file.size} bytes`, desc: "可直接修改并保存当前文件内容。" }
  ]);
  renderDetailExtraBlocks([]);
  workspaceDetailEditor.classList.remove("hidden");
  workspaceDetailSecondaryEditor.classList.add("hidden");
  workspaceDetailEditor.value = result.result.file.content || "";
  workspaceDetailSecondaryEditor.value = "";
  workspaceDetailRefreshBtn.textContent = "刷新详情";
  workspaceDetailSaveBtn.textContent = "保存文件";
  openWorkspaceDetailModal();
}

async function openWorkspaceSkillDetail(skillItem) {
  const rootPath = state.workspace?.rootPath || "";
  const configPath = state.workspace?.config?.path || configPathInput.value;
  const result = await request("/api/workspace/skill-detail", {
    method: "POST",
    body: JSON.stringify({
      rootPath,
      configPath,
      skillPath: skillItem.path
    })
  });

  const skill = result.result.skill;
  workspaceDetailState.mode = "skill";
  workspaceDetailState.skillPath = skill.path;
  workspaceDetailState.filePath = null;
  workspaceDetailTitle.textContent = `工作区技能: ${skill.name}`;
  workspaceDetailPath.textContent = skill.path;
  renderDetailMetaBlocks([
    {
      title: "元数据",
      path: skill.meta.path,
      desc: skill.meta.exists ? "可直接编辑 _meta.json 并保存。" : "当前不存在 _meta.json，保存时会自动创建。"
    },
    {
      title: "技能文档",
      path: skill.skillDoc.path,
      desc: skill.skillDoc.exists ? "已读取 SKILL.md。" : "当前不存在 SKILL.md，保存时会自动创建。"
    },
    {
      title: "目录文件",
      path: skill.files.map((item) => item.name).join(", "),
      desc: `共 ${skill.files.length} 个条目`
    }
  ]);
  renderDetailExtraBlocks(
    skill.readme.exists
      ? [{ title: "README", path: skill.readme.path, desc: "已检测到 README.md，可用于补充技能说明。" }]
      : [{ title: "README", path: skill.readme.path, desc: "当前不存在 README.md。" }]
  );
  workspaceDetailEditor.classList.remove("hidden");
  workspaceDetailSecondaryEditor.classList.remove("hidden");
  workspaceDetailEditor.value = skill.meta.raw || "{}\n";
  workspaceDetailSecondaryEditor.value = skill.skillDoc.content || "";
  workspaceDetailSecondaryEditor.placeholder = "这里可编辑 SKILL.md 内容";
  workspaceDetailRefreshBtn.textContent = "查询详情";
  workspaceDetailSaveBtn.textContent = "更新技能";
  openWorkspaceDetailModal();
}

async function refreshWorkspaceDetail() {
  if (workspaceDetailState.mode === "file" && workspaceDetailState.filePath) {
    await openWorkspaceFileDetail({ name: workspaceDetailState.filePath.split(/[/\\]/).pop(), path: workspaceDetailState.filePath });
    return;
  }

  if (workspaceDetailState.mode === "skill" && workspaceDetailState.skillPath) {
    await openWorkspaceSkillDetail({ name: workspaceDetailState.skillPath.split(/[/\\]/).pop(), path: workspaceDetailState.skillPath });
  }
}

async function saveWorkspaceDetail() {
  const rootPath = state.workspace?.rootPath || "";
  const configPath = state.workspace?.config?.path || configPathInput.value;

  if (workspaceDetailState.mode === "file" && workspaceDetailState.filePath) {
    const result = await request("/api/workspace/file-save", {
      method: "POST",
      body: JSON.stringify({
        rootPath,
        configPath,
        filePath: workspaceDetailState.filePath,
        content: workspaceDetailEditor.value
      })
    });
    state.workspace = result.result.workspace;
    renderWorkspace();
    appendLog(`工作区文件已保存: ${workspaceDetailState.filePath}`);
    return;
  }

  if (workspaceDetailState.mode === "skill" && workspaceDetailState.skillPath) {
    const result = await request("/api/workspace/skill-update", {
      method: "POST",
      body: JSON.stringify({
        rootPath,
        configPath,
        skillPath: workspaceDetailState.skillPath,
        metaRaw: workspaceDetailEditor.value,
        skillDocContent: workspaceDetailSecondaryEditor.value
      })
    });
    state.workspace = result.result.workspace;
    renderWorkspace();
    appendLog(`工作区技能已更新: ${workspaceDetailState.skillPath}`);
    await openWorkspaceSkillDetail({ name: result.result.skill.name, path: result.result.skill.path });
  }
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
    appendLog("已刷新当前配置");
  } catch (error) {
    appendLog(`刷新失败: ${error.message}`);
  }
});

launchOpenClawBtn.addEventListener("click", async () => {
  try {
    await launchOpenClaw();
  } catch (error) {
    appendLog(`启动 OpenClaw 失败: ${error.message}`);
  }
});

openControlBtn.addEventListener("click", async () => {
  try {
    await openOpenClawControl();
  } catch (error) {
    appendLog(`打开 OpenClaw 网关仪表盘失败: ${error.message}`);
  }
});

openClawHubSiteBtn.addEventListener("click", () => {
  openClawHubSite();
});

installClawHubBtn.addEventListener("click", async () => {
  await installClawHubPackage();
});

clawhubPackageInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter" || event.shiftKey) {
    return;
  }

  event.preventDefault();
  await installClawHubPackage();
});

updateLocalVersionBtn.addEventListener("click", async () => {
  try {
    await updateLocalConfigVersion();
  } catch (error) {
    appendLog(`更新本地配置版本失败: ${error.message}`);
  }
});

exportAllBtn.addEventListener("click", async () => {
  try {
    await exportAllConfig();
  } catch (error) {
    appendLog(`导出所有配置失败: ${error.message}`);
  }
});

importAllBtn.addEventListener("click", () => {
  importAllInput.value = "";
  importAllInput.click();
});

importAllInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const bundle = JSON.parse(text);
    await importAllConfig(bundle);
  } catch (error) {
    appendLog(`导入所有配置失败: ${error.message}`);
  } finally {
    importAllInput.value = "";
  }
});

checkUpdateBtn.addEventListener("click", async () => {
  try {
    await checkUpdate();
  } catch (error) {
    appendLog(`检查更新失败: ${error.message}`);
    updateStatusText.textContent = `检查更新失败: ${error.message}`;
  }
});

runUpdateBtn.addEventListener("click", async () => {
  try {
    await runUpdate();
  } catch (error) {
    appendLog(`更新失败: ${error.message}`);
    appendUpdateModalLog(`更新失败: ${error.message}`);
    finishUpdateModal("更新失败", 100);
  }
});

saveModelConfigBtn.addEventListener("click", async () => {
  try {
    await updateModelConfig({ shouldSave: true, shouldSwitch: false });
  } catch (error) {
    appendLog(`保存模型配置失败: ${error.message}`);
  }
});

saveAndSwitchModelBtn.addEventListener("click", async () => {
  try {
    await updateModelConfig({ shouldSave: true, shouldSwitch: true });
  } catch (error) {
    appendLog(`保存并切换模型失败: ${error.message}`);
  }
});

switchModelBtn.addEventListener("click", async () => {
  try {
    await updateModelConfig({ shouldSave: false, shouldSwitch: true });
  } catch (error) {
    appendLog(`切换主模型失败: ${error.message}`);
  }
});

clearModelFormBtn.addEventListener("click", () => {
  clearModelForm();
});

primaryModelSelect.addEventListener("change", () => {
  const selectedName = primaryModelSelect.value;
  if (!selectedName) {
    return;
  }
  fillModelForm(selectedName, getCurrentModelConfigByName(selectedName));
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
    const parsed = JSON.parse(configEditor.value);
    configEditor.value = `${JSON.stringify(parsed, null, 2)}\n`;
    appendLog("已格式化 JSON");
  } catch (error) {
    appendLog(`格式化失败: ${error.message}`);
  }
});

clearLogBtn.addEventListener("click", () => {
  logBox.textContent = "";
});

closeUpdateModalBtn.addEventListener("click", closeUpdateModal);
updateModal.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) {
    closeUpdateModal();
  }
});

workspaceDetailRefreshBtn.addEventListener("click", async () => {
  try {
    await refreshWorkspaceDetail();
  } catch (error) {
    appendLog(`刷新详情失败: ${error.message}`);
  }
});

workspaceDetailSaveBtn.addEventListener("click", async () => {
  try {
    await saveWorkspaceDetail();
  } catch (error) {
    appendLog(`保存详情失败: ${error.message}`);
  }
});

closeWorkspaceDetailBtn.addEventListener("click", closeWorkspaceDetailModal);
workspaceDetailModal.addEventListener("click", (event) => {
  if (event.target.classList.contains("modal-backdrop")) {
    closeWorkspaceDetailModal();
  }
});

renderWorkspace();
discover().catch((error) => {
  appendLog(`初始化扫描失败: ${error.message}`);
});
