const state = {
  skills: [],
  catalog: []
};

const installForm = document.getElementById("installForm");
const refreshBtn = document.getElementById("refreshBtn");
const catalogList = document.getElementById("catalogList");
const installedGrid = document.getElementById("installedGrid");
const skillCount = document.getElementById("skillCount");
const logBox = document.getElementById("logBox");
const clearLogBtn = document.getElementById("clearLogBtn");
const skillCardTpl = document.getElementById("skillCardTpl");

function appendLog(message) {
  const time = new Date().toLocaleTimeString();
  logBox.textContent = `[${time}] ${message}\n${logBox.textContent}`.trim();
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

function renderCatalog() {
  catalogList.innerHTML = "";
  if (!state.catalog.length) {
    catalogList.innerHTML = "<p class='muted'>暂无推荐 Skill</p>";
    return;
  }

  state.catalog.forEach((item) => {
    const wrapper = document.createElement("article");
    wrapper.className = "catalog-item";
    wrapper.innerHTML = `
      <h3>${item.title || item.name}</h3>
      <p class="meta">${item.description || "无描述"}</p>
      <p class="meta">${item.repoUrl}</p>
      <button class="btn">一键安装</button>
    `;

    wrapper.querySelector("button").addEventListener("click", async () => {
      try {
        await installSkill({
          name: item.name,
          repoUrl: item.repoUrl,
          branch: item.branch || "main"
        });
      } catch (error) {
        appendLog(`安装失败: ${error.message}`);
      }
    });

    catalogList.appendChild(wrapper);
  });
}

function renderSkills() {
  installedGrid.innerHTML = "";
  skillCount.textContent = `${state.skills.length} 个`;

  if (!state.skills.length) {
    installedGrid.innerHTML = "<p class='muted'>还没有安装 Skill，请从上方开始。</p>";
    return;
  }

  state.skills.forEach((skill) => {
    const node = skillCardTpl.content.firstElementChild.cloneNode(true);
    const tag = node.querySelector("[data-field='enabledTag']");
    const toggleBtn = node.querySelector("[data-action='toggle']");
    const updateBtn = node.querySelector("[data-action='update']");
    const deleteBtn = node.querySelector("[data-action='delete']");

    node.querySelector("[data-field='title']").textContent = skill.title || skill.name;
    node.querySelector("[data-field='description']").textContent = skill.description || "暂无描述";
    node.querySelector("[data-field='name']").textContent = `ID: ${skill.name}`;
    node.querySelector("[data-field='version']").textContent = `v${skill.version || "unknown"}`;
    node.querySelector("[data-field='repoUrl']").textContent = skill.repoUrl || "未记录仓库地址";

    tag.textContent = skill.enabled ? "Enabled" : "Disabled";
    tag.classList.toggle("enabled", skill.enabled);

    toggleBtn.textContent = skill.enabled ? "停用" : "启用";
    toggleBtn.addEventListener("click", async () => {
      try {
        await request(`/api/skills/${encodeURIComponent(skill.name)}/toggle`, {
          method: "POST",
          body: JSON.stringify({ enabled: !skill.enabled })
        });
        appendLog(`${skill.name} 已${skill.enabled ? "停用" : "启用"}`);
        await loadInstalledSkills();
      } catch (error) {
        appendLog(`切换失败: ${error.message}`);
      }
    });

    updateBtn.addEventListener("click", async () => {
      try {
        const result = await request(`/api/skills/${encodeURIComponent(skill.name)}/update`, {
          method: "POST"
        });
        appendLog(`${skill.name} 更新完成: ${result.message || "OK"}`);
      } catch (error) {
        appendLog(`更新失败: ${error.message}`);
      }
    });

    deleteBtn.addEventListener("click", async () => {
      const confirmed = window.confirm(`确定要卸载 ${skill.name} 吗？`);
      if (!confirmed) {
        return;
      }
      try {
        await request(`/api/skills/${encodeURIComponent(skill.name)}`, {
          method: "DELETE"
        });
        appendLog(`${skill.name} 已卸载`);
        await loadInstalledSkills();
      } catch (error) {
        appendLog(`卸载失败: ${error.message}`);
      }
    });

    installedGrid.appendChild(node);
  });
}

async function loadCatalog() {
  const { items } = await request("/api/catalog");
  state.catalog = items || [];
  renderCatalog();
}

async function loadInstalledSkills() {
  const { skills } = await request("/api/skills");
  state.skills = skills || [];
  renderSkills();
}

async function installSkill({ name, repoUrl, branch }) {
  await request("/api/skills/install", {
    method: "POST",
    body: JSON.stringify({ name, repoUrl, branch })
  });
  appendLog(`安装成功: ${name || repoUrl}`);
  await loadInstalledSkills();
}

installForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(installForm);
  const name = String(form.get("name") || "").trim();
  const repoUrl = String(form.get("repoUrl") || "").trim();
  const branch = String(form.get("branch") || "main").trim() || "main";

  if (!repoUrl) {
    appendLog("请先填写 Git 地址");
    return;
  }

  try {
    await installSkill({ name, repoUrl, branch });
    installForm.reset();
    installForm.querySelector("#branchInput").value = "main";
  } catch (error) {
    appendLog(`安装失败: ${error.message}`);
  }
});

refreshBtn.addEventListener("click", async () => {
  try {
    await Promise.all([loadCatalog(), loadInstalledSkills()]);
    appendLog("已刷新最新数据");
  } catch (error) {
    appendLog(`刷新失败: ${error.message}`);
  }
});

clearLogBtn.addEventListener("click", () => {
  logBox.textContent = "";
});

async function bootstrap() {
  appendLog("系统初始化中...");
  try {
    await Promise.all([loadCatalog(), loadInstalledSkills()]);
    appendLog("初始化完成");
  } catch (error) {
    appendLog(`初始化失败: ${error.message}`);
  }
}

bootstrap();
