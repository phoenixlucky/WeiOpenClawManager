const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn } = require("child_process");

let sea = null;
try {
  sea = require("node:sea");
} catch {
  sea = null;
}

const DEFAULT_PORT = Number(process.env.PORT || 4173);
const APP_DIR = __dirname;
const WORK_DIR = process.cwd();
const PUBLIC_DIR = path.join(APP_DIR, "public");

const MIME_MAP = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function getEmbeddedAsset(assetPath) {
  if (!sea || typeof sea.isSea !== "function" || !sea.isSea()) {
    return null;
  }

  const normalized = String(assetPath || "").replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }

  try {
    const asset = sea.getAsset(`public/${normalized}`);
    return Buffer.from(asset);
  } catch {
    return null;
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || WORK_DIR,
      shell: false,
      env: process.env
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      reject(new Error(stderr.trim() || stdout.trim() || `Command failed with code ${code}`));
    });
  });
}

function collectPowerShellCandidates() {
  const candidates = [];
  const addCandidate = (value) => {
    const normalized = String(value || "").trim();
    if (!normalized || candidates.includes(normalized)) {
      return;
    }
    candidates.push(normalized);
  };

  addCandidate(process.env.OPENCLAW_PWSH);
  addCandidate("pwsh.exe");
  addCandidate("C:\\Program Files\\PowerShell\\7\\pwsh.exe");
  addCandidate("D:\\Program Files\\PowerShell\\7\\pwsh.exe");
  addCandidate("powershell.exe");
  addCandidate("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");

  return candidates;
}

function findOpenClawCmdShim() {
  const npmBinDir = path.join(process.env.APPDATA || "", "npm");
  if (!npmBinDir || !fsSync.existsSync(npmBinDir)) {
    return null;
  }

  try {
    const candidates = fsSync
      .readdirSync(npmBinDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /^openclaw\.cmd$/i.test(name))
      .map((name) => path.join(npmBinDir, name));

    return candidates[0] || null;
  } catch {
    return null;
  }
}

function isStableOpenClawCommandPath(commandPath) {
  const normalized = normalizePath(commandPath);
  if (!normalized || !fsSync.existsSync(normalized)) {
    return false;
  }

  const baseName = path.basename(normalized).toLowerCase();
  return ["openclaw", "openclaw.cmd", "openclaw.exe", "openclaw.bat"].includes(baseName);
}

async function findOpenClawCmdFromPath() {
  try {
    const result = await runPowerShellScript(
      "$cmd = Get-Command openclaw.cmd, openclaw -ErrorAction SilentlyContinue | Where-Object { $_.CommandType -eq 'Application' } | Select-Object -First 1 -ExpandProperty Source; if ($cmd) { Write-Output $cmd }"
    );
    const commandPath = normalizePath(result.stdout || result.stderr || "");
    return isStableOpenClawCommandPath(commandPath) ? commandPath : null;
  } catch {
    return null;
  }
}

function resolveCmdShimTarget(shimPath) {
  const normalized = normalizePath(shimPath);
  if (!normalized || !fsSync.existsSync(normalized)) {
    return null;
  }

  try {
    const content = fsSync.readFileSync(normalized, "utf8");
    const match = content.match(/"%dp0%\\([^"]+)"/i);
    if (!match || !match[1]) {
      return null;
    }
    return path.join(path.dirname(normalized), match[1].replaceAll("\\", path.sep));
  } catch {
    return null;
  }
}

async function resolvePowerShellPath() {
  let lastError = null;

  for (const shellPath of collectPowerShellCandidates()) {
    try {
      await runCommand(shellPath, [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "$PSVersionTable.PSVersion.ToString()"
      ]);
      return shellPath;
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        lastError = error;
        continue;
      }
      return shellPath;
    }
  }

  throw lastError || new Error("No PowerShell executable was found.");
}

async function runPowerShellScript(script, options = {}) {
  const shellPath = await resolvePowerShellPath();
  return runCommand(
    shellPath,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    options
  );
}

function openBrowser(url) {
  let command = null;
  let args = [];

  if (process.platform === "win32") {
    command = "cmd.exe";
    args = ["/c", "start", "", url];
  } else if (process.platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

function spawnDetached(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || WORK_DIR,
    env: process.env,
    detached: true,
    stdio: "ignore",
    shell: false
  });
  child.unref();
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += String(chunk);
        });
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on("error", reject);
  });
}

function normalizePath(input) {
  const value = String(input || "").trim();
  if (!value) {
    return "";
  }
  return path.resolve(value);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function statSafe(targetPath) {
  try {
    return await fs.stat(targetPath);
  } catch {
    return null;
  }
}

function uniquePaths(paths) {
  return [...new Set(paths.filter(Boolean).map((item) => normalizePath(item)).filter(Boolean))];
}

function ensurePathInside(parentPath, targetPath, label) {
  const parent = normalizePath(parentPath);
  const target = normalizePath(targetPath);
  if (!parent || !target) {
    throw new Error(`${label}路径无效`);
  }

  const relative = path.relative(parent, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label}不在允许范围内`);
  }

  return target;
}

function extractVersionToken(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return null;
  }

  const patterns = [
    /OpenClaw\s+([0-9][0-9A-Za-z._-]*)/i,
    /\bopenclaw@([0-9][0-9A-Za-z._-]*)/i,
    /\bversion\s*[:=]?\s*([0-9][0-9A-Za-z._-]*)/i,
    /\b([0-9]+\.[0-9]+(?:\.[0-9A-Za-z_-]+)*)\b/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

function buildVersionResult(value, source, detail = null) {
  return {
    value: value || "unknown",
    source: source || null,
    detail: detail || null
  };
}

function extractFirstUrl(text) {
  const match = String(text || "").match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : null;
}

function getDefaultOpenClawRoot() {
  const homeDir = os.homedir();
  return path.join(homeDir, ".openclaw");
}

async function detectConfigCandidates() {
  const defaultRoot = getDefaultOpenClawRoot();
  const explicitCandidates = uniquePaths([defaultRoot, path.join(defaultRoot, "openclaw.json")]);
  const existing = [];
  for (const candidate of explicitCandidates) {
    const stat = await statSafe(candidate);
    if (!stat) {
      continue;
    }

    if (stat.isDirectory()) {
      const directoryConfig = path.join(candidate, "openclaw.json");
      if (await pathExists(directoryConfig)) {
        existing.push(candidate);
      }
      continue;
    }

    const baseName = path.basename(candidate).toLowerCase();
    if (baseName === "openclaw.json" || baseName === ".openclaw") {
      existing.push(candidate);
    }
  }

  return existing;
}

async function detectOpenClawRoots() {
  const defaultRoot = getDefaultOpenClawRoot();
  const stat = await statSafe(defaultRoot);
  if (stat && stat.isDirectory()) {
    return [defaultRoot];
  }
  return [];
}

async function readMaybeJson(filePath) {
  const raw = await fs.readFile(filePath, "utf-8");
  try {
    return {
      raw,
      parsed: JSON.parse(raw),
      format: "json"
    };
  } catch {
    return {
      raw,
      parsed: null,
      format: "text"
    };
  }
}

async function resolveWorkspacePaths({ rootPath, configPath }) {
  const normalizedRoot = normalizePath(rootPath);
  const normalizedConfig = normalizePath(configPath);

  if (normalizedConfig) {
    const configStat = await statSafe(normalizedConfig);
    if (configStat && configStat.isDirectory()) {
      const directoryConfig = path.join(normalizedConfig, "openclaw.json");
      if (await pathExists(directoryConfig)) {
        return {
          rootPath: normalizedRoot || normalizedConfig,
          configPath: directoryConfig,
          configDirectory: normalizedConfig
        };
      }
    }

    return {
      rootPath: normalizedRoot || path.dirname(normalizedConfig),
      configPath: normalizedConfig,
      configDirectory: path.dirname(normalizedConfig)
    };
  }

  if (normalizedRoot) {
    const candidates = [
      path.join(normalizedRoot, "openclaw.json"),
      path.join(normalizedRoot, ".openclaw")
    ];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return {
          rootPath: normalizedRoot,
          configPath: candidate,
          configDirectory: path.dirname(candidate)
        };
      }
    }

    return {
      rootPath: normalizedRoot,
      configPath: path.join(normalizedRoot, "openclaw.json"),
      configDirectory: normalizedRoot
    };
  }

  throw new Error("未提供配置文件路径");
}

async function readWorkspaceSummary(rootPath, parsedConfig) {
  const workspacePath =
    parsedConfig?.agents?.defaults?.workspace || path.join(rootPath, "workspace");
  const workspaceStat = await statSafe(workspacePath);
  const exists = Boolean(workspaceStat && workspaceStat.isDirectory());

  const keyFiles = [
    "AGENTS.md",
    "USER.md",
    "TOOLS.md",
    "SOUL.md",
    "MEMORY.md",
    "IDENTITY.md",
    "DREAMS.md",
    "package.json",
    "scheduled_tasks.json",
    "quick_queries.json"
  ];

  const files = [];
  if (exists) {
    for (const name of keyFiles) {
      const filePath = path.join(workspacePath, name);
      const stat = await statSafe(filePath);
      if (!stat || !stat.isFile()) {
        continue;
      }
      files.push({
        name,
        path: filePath,
        size: stat.size
      });
    }
  }

  const skillsPath = path.join(workspacePath, "skills");
  const skills = [];
  const skillsStat = await statSafe(skillsPath);
  if (skillsStat && skillsStat.isDirectory()) {
    const entries = await fs.readdir(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = path.join(skillsPath, entry.name);
      const metaFile = path.join(skillDir, "_meta.json");
      let title = entry.name;
      let description = "";

      if (await pathExists(metaFile)) {
        try {
          const parsed = JSON.parse(await fs.readFile(metaFile, "utf-8"));
          title = parsed.title || parsed.name || entry.name;
          description = parsed.description || "";
        } catch {
          // ignore malformed meta
        }
      }

      skills.push({
        name: entry.name,
        title,
        description,
        path: skillDir
      });
    }
  }

  skills.sort((a, b) => a.name.localeCompare(b.name));

  return {
    path: workspacePath,
    exists,
    keyFiles: files,
    skills
  };
}

async function readFileIfExists(filePath) {
  if (!(await pathExists(filePath))) {
    return null;
  }
  return fs.readFile(filePath, "utf-8");
}

async function readTextFile(filePath) {
  const stat = await statSafe(filePath);
  if (!stat || !stat.isFile()) {
    throw new Error("目标文件不存在");
  }

  const content = await fs.readFile(filePath, "utf-8");
  return {
    path: filePath,
    size: stat.size,
    content
  };
}

async function getLocalOpenClawVersion(rootPath = getDefaultOpenClawRoot()) {
  const localVersion = await detectVersionInfo(rootPath);
  return buildVersionResult(
    localVersion.value,
    localVersion.source || "openclaw.json",
    localVersion.detail || "No supported version file found"
  );
}

async function tryReadGlobalPackageVersionFromFilesystem() {
  const npmRootResult = await runCommand("cmd.exe", ["/c", "npm.cmd", "root", "-g"]);
  const npmRoot = normalizePath((npmRootResult.stdout || npmRootResult.stderr || "").trim());
  if (!npmRoot) {
    return null;
  }

  const packageDir = path.join(npmRoot, "openclaw");
  const packageJsonPath = path.join(packageDir, "package.json");

  if (await pathExists(packageJsonPath)) {
    const parsed = JSON.parse(await fs.readFile(packageJsonPath, "utf-8"));
    const version = extractVersionToken(parsed.version);
    if (version) {
      return buildVersionResult(version, packageJsonPath, "Read from npm global package.json");
    }
  }

  if (await pathExists(packageDir)) {
    return buildVersionResult(
      "unknown",
      packageDir,
      "Global OpenClaw package directory exists but package.json is missing or invalid"
    );
  }

  return null;
}

async function getInstalledOpenClawVersion() {
  const shimPath = findOpenClawCmdShim();

  try {
    if (shimPath && isStableOpenClawCommandPath(shimPath)) {
      const result = await runCommand("cmd.exe", ["/c", shimPath, "--version"]);
      const text = result.stdout || result.stderr;
      const version = extractVersionToken(text);
      if (version) {
        return buildVersionResult(version, shimPath, "Read from openclaw.cmd --version");
      }
    }
  } catch {
    // continue with fallback strategies
  }

  try {
    const result = await runPowerShellScript("& openclaw --version");
    const text = result.stdout || result.stderr;
    const version = extractVersionToken(text);
    if (version) {
      return buildVersionResult(version, "openclaw --version", "Read from PATH command");
    }
  } catch {
    // continue with fallback strategies
  }

  try {
    const result = await runCommand("cmd.exe", ["/c", "npm.cmd", "list", "-g", "openclaw", "--depth=0"]);
    const text = [result.stdout, result.stderr].filter(Boolean).join("\n");
    const version = extractVersionToken(text);
    if (version) {
      return buildVersionResult(version, "npm.cmd list -g openclaw --depth=0", "Read from npm global list");
    }
  } catch {
    // continue with fallback strategies
  }

  try {
    const packageResult = await tryReadGlobalPackageVersionFromFilesystem();
    if (packageResult) {
      return packageResult;
    }
  } catch {
    // continue with diagnostics
  }

  if (shimPath) {
    const target = resolveCmdShimTarget(shimPath);
    if (target && !fsSync.existsSync(target)) {
      return buildVersionResult(
        "unknown",
        shimPath,
        `Global OpenClaw command shim is broken: target file is missing (${target})`
      );
    }

    return buildVersionResult(
      "unknown",
      shimPath,
      "Global OpenClaw command exists but version could not be determined"
    );
  }

  return buildVersionResult("unknown", null, "OpenClaw is not available as a valid global CLI installation");
}

async function getLatestOpenClawVersion() {
  const payload = await fetchJson("https://registry.npmjs.org/openclaw/latest");
  return String(payload.version || "").trim();
}

async function getUpdateStatus() {
  const global = await getInstalledOpenClawVersion();
  const local = await getLocalOpenClawVersion();
  let latest = "unknown";
  let canUpdate = false;
  let error = null;

  try {
    latest = await getLatestOpenClawVersion();
    canUpdate = global.value !== "unknown" && latest !== "unknown" && global.value !== latest;
  } catch (updateError) {
    error = updateError.message || "检查最新版本失败";
  }

  return {
    installed: global,
    versions: {
      global,
      local
    },
    latest,
    canUpdate,
    error
  };
}

async function runOpenClawUpdate() {
  const before = {
    global: await getInstalledOpenClawVersion(),
    local: await getLocalOpenClawVersion()
  };
  const result = await runPowerShellScript("npm i -g openclaw@latest");
  const after = {
    global: await getInstalledOpenClawVersion(),
    local: await getLocalOpenClawVersion()
  };
  return {
    before,
    after,
    output: result.stdout || result.stderr || "Updated"
  };
}

async function launchOpenClaw(rootPath) {
  const cwd = normalizePath(rootPath) || getDefaultOpenClawRoot() || WORK_DIR;
  const shimPath = findOpenClawCmdShim();

  if (shimPath && isStableOpenClawCommandPath(shimPath)) {
    const target = resolveCmdShimTarget(shimPath);
    if (target && !fsSync.existsSync(target)) {
      throw new Error(`OpenClaw 启动失败：全局命令损坏，目标文件不存在 (${target})`);
    }

    spawnDetached("cmd.exe", ["/c", "start", "", "cmd.exe", "/k", shimPath, "gateway"], { cwd });
    return {
      cwd,
      command: `${shimPath} gateway`,
      source: "openclaw.cmd"
    };
  }

  const pathCommand = await findOpenClawCmdFromPath();
  if (pathCommand) {
    spawnDetached("cmd.exe", ["/c", "start", "", "cmd.exe", "/k", pathCommand, "gateway"], { cwd });
    return {
      cwd,
      command: `${pathCommand} gateway`,
      source: "PATH application"
    };
  }

  throw new Error("未找到可启动的 OpenClaw 命令，请先确认已正确安装 openclaw.cmd");
}

async function resolveOpenClawDashboardUrl() {
  const shimPath = findOpenClawCmdShim();

  if (shimPath && isStableOpenClawCommandPath(shimPath)) {
    try {
      const result = await runCommand("cmd.exe", ["/c", shimPath, "dashboard"]);
      const url = extractFirstUrl([result.stdout, result.stderr].filter(Boolean).join("\n"));
      if (url) {
        return url;
      }
    } catch (error) {
      const url = extractFirstUrl(error?.message || "");
      if (url) {
        return url;
      }
    }
  }

  const pathCommand = await findOpenClawCmdFromPath();
  if (pathCommand) {
    try {
      const result = await runCommand("cmd.exe", ["/c", pathCommand, "dashboard"]);
      const url = extractFirstUrl([result.stdout, result.stderr].filter(Boolean).join("\n"));
      if (url) {
        return url;
      }
    } catch (error) {
      const url = extractFirstUrl(error?.message || "");
      if (url) {
        return url;
      }
    }
  }

  try {
    const result = await runPowerShellScript("& openclaw dashboard");
    const url = extractFirstUrl([result.stdout, result.stderr].filter(Boolean).join("\n"));
    if (url) {
      return url;
    }
  } catch (error) {
    const url = extractFirstUrl(error?.message || "");
    if (url) {
      return url;
    }
  }

  throw new Error("未能从 `openclaw dashboard` 输出中解析到仪表盘 URL");
}

async function openOpenClawDashboard() {
  const url = await resolveOpenClawDashboardUrl();
  openBrowser(url);
  return { url };
}

function extractVersionFromText(text) {
  const match = String(text || "").match(/version\s*[:=]\s*["']?([0-9a-zA-Z._-]+)["']?/i);
  return match ? match[1] : null;
}

async function detectVersionInfo(rootPath) {
  const root = normalizePath(rootPath);
  if (!root) {
    return { value: "unknown", source: null, detail: "No root selected" };
  }

  const candidates = [
    {
      file: path.join(root, "package.json"),
      reader: async (file) => {
        const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
        return parsed.version || null;
      },
      sourceLabel: "package.json"
    },
    {
      file: path.join(root, "pyproject.toml"),
      reader: async (file) => extractVersionFromText(await fs.readFile(file, "utf-8")),
      sourceLabel: "pyproject.toml"
    },
    {
      file: path.join(root, "VERSION"),
      reader: async (file) => String(await fs.readFile(file, "utf-8")).trim(),
      sourceLabel: "VERSION"
    },
    {
      file: path.join(root, "version.txt"),
      reader: async (file) => String(await fs.readFile(file, "utf-8")).trim(),
      sourceLabel: "version.txt"
    },
    {
      file: path.join(root, "openclaw.json"),
      reader: async (file) => {
        const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
        return parsed.meta?.lastTouchedVersion || null;
      },
      sourceLabel: "openclaw.json meta.lastTouchedVersion",
      detail: "Fallback to config metadata marker, not guaranteed to match the installed CLI version"
    },
    {
      file: path.join(root, "openclaw.json"),
      reader: async (file) => {
        const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
        return parsed.wizard?.lastRunVersion || null;
      },
      sourceLabel: "openclaw.json wizard.lastRunVersion",
      detail: "Fallback to config wizard marker, not guaranteed to match the installed CLI version"
    }
  ];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate.file))) {
      continue;
    }
    try {
      const value = await candidate.reader(candidate.file);
      const version = extractVersionToken(value || "");
      if (version) {
        return {
          value: version,
          source: candidate.sourceLabel ? `${candidate.file} (${candidate.sourceLabel})` : candidate.file,
          detail: candidate.detail || "Detected from local files"
        };
      }
    } catch {
      // ignore malformed version files
    }
  }

  return { value: "unknown", source: null, detail: "No supported version file found" };
}

async function summarizeRoot(rootPath) {
  const root = normalizePath(rootPath);
  if (!root) {
    return null;
  }

  const stat = await statSafe(root);
  if (!stat || !stat.isDirectory()) {
    throw new Error("OpenClaw 根目录不存在");
  }

  const openclawJsonPath = path.join(root, "openclaw.json");
  const configPath = path.join(root, ".openclaw");
  const version = await detectVersionInfo(root);
  const hasOpenclawJson = await pathExists(openclawJsonPath);
  const hasDotOpenclaw = await pathExists(configPath);

  return {
    rootPath: root,
    hasConfig: hasOpenclawJson || hasDotOpenclaw,
    configPath: hasOpenclawJson ? openclawJsonPath : hasDotOpenclaw ? configPath : null,
    version
  };
}

async function loadWorkspace({ rootPath, configPath }) {
  const resolved = await resolveWorkspacePaths({ rootPath, configPath });
  const finalConfigPath = resolved.configPath;
  const finalRootPath = resolved.rootPath;

  const fileExists = await pathExists(finalConfigPath);
  let config = {
    path: finalConfigPath,
    directory: resolved.configDirectory,
    exists: fileExists,
    format: "text",
    raw: "",
    parsed: null
  };

  if (fileExists) {
    const loaded = await readMaybeJson(finalConfigPath);
    config = {
      path: finalConfigPath,
      directory: resolved.configDirectory,
      exists: true,
      format: loaded.format,
      raw: loaded.raw,
      parsed: loaded.parsed
    };
  }

  const versions = {
    global: await getInstalledOpenClawVersion(),
    local: await getLocalOpenClawVersion(finalRootPath)
  };
  const workspace = await readWorkspaceSummary(finalRootPath, config.parsed);
  return {
    rootPath: finalRootPath,
    version: versions.local,
    versions,
    config,
    workspace
  };
}

async function saveConfig({ configPath, content }) {
  const resolved = await resolveWorkspacePaths({ configPath });
  const targetPath = resolved.configPath;

  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(targetPath, String(content ?? ""), "utf-8");
  return loadWorkspace({ configPath: targetPath });
}

async function exportAllConfig({ rootPath, configPath }) {
  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const workspacePath = workspace.workspace.path;
  const skillsRoot = path.join(workspacePath, "skills");

  const keyFiles = [];
  for (const item of workspace.workspace.keyFiles || []) {
    keyFiles.push({
      name: item.name,
      path: item.path,
      content: await fs.readFile(item.path, "utf-8")
    });
  }

  const skills = [];
  for (const skill of workspace.workspace.skills || []) {
    const skillPath = skill.path;
    skills.push({
      name: skill.name,
      path: skillPath,
      metaRaw: (await readFileIfExists(path.join(skillPath, "_meta.json"))) || "",
      skillDocContent: (await readFileIfExists(path.join(skillPath, "SKILL.md"))) || "",
      readmeContent: (await readFileIfExists(path.join(skillPath, "README.md"))) || ""
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    rootPath: workspace.rootPath,
    configPath: workspace.config.path,
    workspacePath,
    config: {
      raw: workspace.config.raw || "",
      parsed: workspace.config.parsed || null
    },
    workspaceFiles: keyFiles,
    skillsRoot,
    skills
  };
}

async function importAllConfig({ rootPath, configPath, bundle, writeFiles }) {
  if (!writeFiles) {
    return {
      imported: false,
      summary: {
        workspaceFiles: Array.isArray(bundle?.workspaceFiles) ? bundle.workspaceFiles.length : 0,
        skills: Array.isArray(bundle?.skills) ? bundle.skills.length : 0
      }
    };
  }

  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const workspacePath = workspace.workspace.path;
  const targetConfigPath = workspace.config.path;
  const skillsRoot = path.join(workspacePath, "skills");

  if (bundle?.config?.raw !== undefined) {
    await fs.mkdir(path.dirname(targetConfigPath), { recursive: true });
    await fs.writeFile(targetConfigPath, String(bundle.config.raw ?? ""), "utf-8");
  }

  for (const file of bundle?.workspaceFiles || []) {
    if (!file?.name) {
      continue;
    }
    const targetPath = ensurePathInside(workspacePath, path.join(workspacePath, file.name), "工作区文件");
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, String(file.content ?? ""), "utf-8");
  }

  for (const skill of bundle?.skills || []) {
    if (!skill?.name) {
      continue;
    }
    const skillDir = ensurePathInside(skillsRoot, path.join(skillsRoot, skill.name), "工作区技能");
    await fs.mkdir(skillDir, { recursive: true });

    if (skill.metaRaw !== undefined && skill.metaRaw !== "") {
      await fs.writeFile(path.join(skillDir, "_meta.json"), String(skill.metaRaw), "utf-8");
    }
    if (skill.skillDocContent !== undefined && skill.skillDocContent !== "") {
      await fs.writeFile(path.join(skillDir, "SKILL.md"), String(skill.skillDocContent), "utf-8");
    }
    if (skill.readmeContent !== undefined && skill.readmeContent !== "") {
      await fs.writeFile(path.join(skillDir, "README.md"), String(skill.readmeContent), "utf-8");
    }
  }

  return {
    imported: true,
    workspace: await loadWorkspace({ rootPath, configPath }),
    summary: {
      workspaceFiles: Array.isArray(bundle?.workspaceFiles) ? bundle.workspaceFiles.length : 0,
      skills: Array.isArray(bundle?.skills) ? bundle.skills.length : 0
    }
  };
}

async function getWorkspaceContext({ rootPath, configPath }) {
  const workspace = await loadWorkspace({ rootPath, configPath });
  if (!workspace.workspace?.path) {
    throw new Error("未找到工作区路径");
  }
  return workspace;
}

async function getWorkspaceFileDetail({ rootPath, configPath, filePath }) {
  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const targetPath = ensurePathInside(workspace.workspace.path, filePath, "工作区文件");
  const file = await readTextFile(targetPath);
  return {
    file,
    workspace
  };
}

async function saveWorkspaceFile({ rootPath, configPath, filePath, content }) {
  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const targetPath = ensurePathInside(workspace.workspace.path, filePath, "工作区文件");
  const parentDir = path.dirname(targetPath);
  await fs.mkdir(parentDir, { recursive: true });
  await fs.writeFile(targetPath, String(content ?? ""), "utf-8");
  const updatedWorkspace = await loadWorkspace({ rootPath, configPath });
  const file = await readTextFile(targetPath);
  return {
    file,
    workspace: updatedWorkspace
  };
}

async function getSkillDetail({ rootPath, configPath, skillPath }) {
  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const skillsRoot = path.join(workspace.workspace.path, "skills");
  const targetPath = ensurePathInside(skillsRoot, skillPath, "工作区技能");
  const targetStat = await statSafe(targetPath);
  if (!targetStat || !targetStat.isDirectory()) {
    throw new Error("技能目录不存在");
  }

  const metaPath = path.join(targetPath, "_meta.json");
  const skillMdPath = path.join(targetPath, "SKILL.md");
  const readmePath = path.join(targetPath, "README.md");
  const entries = await fs.readdir(targetPath, { withFileTypes: true });

  let meta = { path: metaPath, exists: false, raw: "", parsed: null };
  if (await pathExists(metaPath)) {
    const loaded = await readMaybeJson(metaPath);
    meta = {
      path: metaPath,
      exists: true,
      raw: loaded.raw,
      parsed: loaded.parsed
    };
  }

  let skillDoc = { path: skillMdPath, exists: false, content: "" };
  if (await pathExists(skillMdPath)) {
    skillDoc = {
      path: skillMdPath,
      exists: true,
      content: await fs.readFile(skillMdPath, "utf-8")
    };
  }

  let readme = { path: readmePath, exists: false, content: "" };
  if (await pathExists(readmePath)) {
    readme = {
      path: readmePath,
      exists: true,
      content: await fs.readFile(readmePath, "utf-8")
    };
  }

  return {
    skill: {
      path: targetPath,
      name: path.basename(targetPath),
      files: entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? "dir" : "file"
      })),
      meta,
      skillDoc,
      readme
    },
    workspace
  };
}

async function updateSkillDetail({ rootPath, configPath, skillPath, metaRaw, skillDocContent, readmeContent }) {
  const workspace = await getWorkspaceContext({ rootPath, configPath });
  const skillsRoot = path.join(workspace.workspace.path, "skills");
  const targetPath = ensurePathInside(skillsRoot, skillPath, "工作区技能");
  const targetStat = await statSafe(targetPath);
  if (!targetStat || !targetStat.isDirectory()) {
    throw new Error("技能目录不存在");
  }

  const metaPath = path.join(targetPath, "_meta.json");
  const skillMdPath = path.join(targetPath, "SKILL.md");
  const readmePath = path.join(targetPath, "README.md");

  if (metaRaw !== undefined) {
    const parsed = JSON.parse(String(metaRaw || "{}"));
    await fs.writeFile(metaPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
  }

  if (skillDocContent !== undefined) {
    await fs.writeFile(skillMdPath, String(skillDocContent ?? ""), "utf-8");
  }

  if (readmeContent !== undefined) {
    await fs.writeFile(readmePath, String(readmeContent ?? ""), "utf-8");
  }

  return getSkillDetail({ rootPath, configPath, skillPath: targetPath });
}

async function updateLocalConfigVersion({ rootPath, configPath }) {
  const resolved = await resolveWorkspacePaths({ rootPath, configPath });
  const targetPath = resolved.configPath;
  const fileExists = await pathExists(targetPath);
  const latestVersion = await getLatestOpenClawVersion();

  if (!latestVersion || latestVersion === "unknown") {
    throw new Error("未获取到最新 OpenClaw 版本");
  }

  let parsed = {};
  if (fileExists) {
    const loaded = await readMaybeJson(targetPath);
    if (loaded.parsed) {
      parsed = loaded.parsed;
    } else if (String(loaded.raw || "").trim()) {
      throw new Error("当前 openclaw.json 不是有效 JSON，无法自动更新本地配置版本");
    }
  }

  if (!parsed.meta || typeof parsed.meta !== "object" || Array.isArray(parsed.meta)) {
    parsed.meta = {};
  }
  if (!parsed.wizard || typeof parsed.wizard !== "object" || Array.isArray(parsed.wizard)) {
    parsed.wizard = {};
  }

  parsed.meta.lastTouchedVersion = latestVersion;
  parsed.wizard.lastRunVersion = latestVersion;

  const content = `${JSON.stringify(parsed, null, 2)}\n`;
  const workspace = await saveConfig({ configPath: targetPath, content });

  return {
    version: latestVersion,
    workspace
  };
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (body.length > 2_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "openclaw-local-manager" });
  }

  if (req.method === "GET" && pathname === "/api/discovery") {
    const [configCandidates, rootCandidates] = await Promise.all([
      detectConfigCandidates(),
      detectOpenClawRoots()
    ]);

    const roots = [];
    for (const rootPath of rootCandidates) {
      try {
        roots.push(await summarizeRoot(rootPath));
      } catch {
        // ignore invalid root
      }
    }

    return sendJson(res, 200, {
      configCandidates,
      roots: roots.filter(Boolean)
    });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/load") {
    const payload = await readJsonBody(req);
    const workspace = await loadWorkspace(payload);
    return sendJson(res, 200, workspace);
  }

  if (req.method === "POST" && pathname === "/api/openclaw/save") {
    const payload = await readJsonBody(req);
    const workspace = await saveConfig(payload);
    return sendJson(res, 200, { ok: true, workspace });
  }

  if (req.method === "GET" && pathname === "/api/openclaw/update-status") {
    const status = await getUpdateStatus();
    return sendJson(res, 200, status);
  }

  if (req.method === "POST" && pathname === "/api/openclaw/update") {
    const result = await runOpenClawUpdate();
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/launch") {
    const payload = await readJsonBody(req);
    const result = await launchOpenClaw(payload.rootPath);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/control") {
    const result = await openOpenClawDashboard();
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/update-local-version") {
    const payload = await readJsonBody(req);
    const result = await updateLocalConfigVersion(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/export-all") {
    const payload = await readJsonBody(req);
    const result = await exportAllConfig(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/openclaw/import-all") {
    const payload = await readJsonBody(req);
    const result = await importAllConfig(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/workspace/file-detail") {
    const payload = await readJsonBody(req);
    const result = await getWorkspaceFileDetail(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/workspace/file-save") {
    const payload = await readJsonBody(req);
    const result = await saveWorkspaceFile(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/workspace/skill-detail") {
    const payload = await readJsonBody(req);
    const result = await getSkillDetail(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  if (req.method === "POST" && pathname === "/api/workspace/skill-update") {
    const payload = await readJsonBody(req);
    const result = await updateSkillDetail(payload);
    return sendJson(res, 200, { ok: true, result });
  }

  sendJson(res, 404, { error: "API endpoint not found" });
}

async function serveStatic(req, res, pathname) {
  const cleanPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.join(PUBLIC_DIR, cleanPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const mime = MIME_MAP[ext] || "application/octet-stream";
    const content = await fs.readFile(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    const embedded = getEmbeddedAsset(cleanPath);
    if (embedded) {
      const ext = path.extname(cleanPath);
      const mime = MIME_MAP[ext] || "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(embedded);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  }
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    if (pathname.startsWith("/api/")) {
      await handleApi(req, res, pathname);
      return;
    }
    await serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
}

async function startServer(options = {}) {
  const port = Number(options.port ?? DEFAULT_PORT);
  const openClient = options.openClient === true;
  const host = options.host || "127.0.0.1";
  const server = http.createServer(requestHandler);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : port;
  const url = `http://${host === "::" ? "localhost" : host}:${activePort}`;

  if (openClient) {
    openBrowser(url);
  }

  return {
    server,
    port: activePort,
    url,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      })
  };
}

async function startCli() {
  const openClient =
    process.env.OPENCLAW_AUTO_OPEN === "1" ||
    (process.env.OPENCLAW_AUTO_OPEN !== "0" &&
      /^(node|iojs)(\.exe)?$/i.test(path.basename(process.execPath)));

  const runtime = await startServer({
    port: DEFAULT_PORT,
    openClient
  });

  console.log(`OpenClaw local manager running at ${runtime.url}`);
  return runtime;
}

if (require.main === module) {
  startCli().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PORT,
  startServer,
  requestHandler
};
