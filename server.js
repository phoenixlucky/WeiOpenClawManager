const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 4173;
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");

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

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
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

function runPowerShellScript(script, options = {}) {
  const shellPath =
    process.env.OPENCLAW_PWSH ||
    "D:\\Program Files\\PowerShell\\7\\pwsh.exe";
  return runCommand(
    shellPath,
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    options
  );
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

async function getInstalledOpenClawVersion() {
  const localVersion = await detectVersionInfo(getDefaultOpenClawRoot());
  if (localVersion.value !== "unknown") {
    return {
      value: localVersion.value,
      source: localVersion.source || "openclaw.json"
    };
  }

  try {
    const result = await runPowerShellScript("openclaw --version");
    const text = result.stdout || result.stderr;
    const match = text.match(/OpenClaw\s+([0-9][0-9A-Za-z._-]*)/i);
    return {
      value: match ? match[1] : text || "unknown",
      source: "openclaw --version"
    };
  } catch {
    try {
      const result = await runPowerShellScript("npm list -g openclaw --depth=0");
      const match = result.stdout.match(/openclaw@([0-9][0-9A-Za-z._-]*)/i);
      return {
        value: match ? match[1] : "unknown",
        source: "npm list -g openclaw --depth=0"
      };
    } catch {
      return {
        value: "unknown",
        source: null
      };
    }
  }
}

async function getLatestOpenClawVersion() {
  const payload = await fetchJson("https://registry.npmjs.org/openclaw/latest");
  return String(payload.version || "").trim();
}

async function getUpdateStatus() {
  const installed = await getInstalledOpenClawVersion();
  let latest = "unknown";
  let canUpdate = false;
  let error = null;

  try {
    latest = await getLatestOpenClawVersion();
    canUpdate = installed.value !== "unknown" && latest !== "unknown" && installed.value !== latest;
  } catch (updateError) {
    error = updateError.message || "检查最新版本失败";
  }

  return {
    installed,
    latest,
    canUpdate,
    error
  };
}

async function runOpenClawUpdate() {
  const before = await getInstalledOpenClawVersion();
  const result = await runPowerShellScript("npm i -g openclaw@latest");
  const after = await getInstalledOpenClawVersion();
  return {
    before,
    after,
    output: result.stdout || result.stderr || "Updated"
  };
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
      file: path.join(root, "openclaw.json"),
      reader: async (file) => {
        const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
        return parsed.meta?.lastTouchedVersion || parsed.wizard?.lastRunVersion || null;
      }
    },
    {
      file: path.join(root, "package.json"),
      reader: async (file) => {
        const parsed = JSON.parse(await fs.readFile(file, "utf-8"));
        return parsed.version || null;
      }
    },
    {
      file: path.join(root, "pyproject.toml"),
      reader: async (file) => extractVersionFromText(await fs.readFile(file, "utf-8"))
    },
    {
      file: path.join(root, "VERSION"),
      reader: async (file) => String(await fs.readFile(file, "utf-8")).trim()
    },
    {
      file: path.join(root, "version.txt"),
      reader: async (file) => String(await fs.readFile(file, "utf-8")).trim()
    }
  ];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate.file))) {
      continue;
    }
    try {
      const value = await candidate.reader(candidate.file);
      if (value) {
        return { value, source: candidate.file, detail: "Detected from local files" };
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

  const version = await detectVersionInfo(finalRootPath);
  const workspace = await readWorkspaceSummary(finalRootPath, config.parsed);
  return {
    rootPath: finalRootPath,
    version,
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

async function start() {
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`OpenClaw local manager running at http://localhost:${PORT}`);
  });
}

start();
