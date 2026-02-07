const http = require("http");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = process.env.PORT || 4173;
const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const SKILLS_DIR = path.join(ROOT_DIR, "openclaw-skills");
const STATE_FILE = path.join(ROOT_DIR, "skill-manager-state.json");
const CATALOG_FILE = path.join(ROOT_DIR, "catalog.json");

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

async function ensureEnvironment() {
  await fs.mkdir(SKILLS_DIR, { recursive: true });
  if (!fsSync.existsSync(STATE_FILE)) {
    await fs.writeFile(STATE_FILE, JSON.stringify({ skills: {} }, null, 2), "utf-8");
  }
  if (!fsSync.existsSync(CATALOG_FILE)) {
    await fs.writeFile(
      CATALOG_FILE,
      JSON.stringify(
        [
          {
            name: "claw-voice-pack",
            title: "Voice Pack",
            description: "Adds multilingual voice interactions.",
            repoUrl: "https://github.com/example/openclaw-skill-voice.git"
          },
          {
            name: "claw-memory-agent",
            title: "Memory Agent",
            description: "Long-term memory skill for personalized responses.",
            repoUrl: "https://github.com/example/openclaw-skill-memory.git"
          }
        ],
        null,
        2
      ),
      "utf-8"
    );
  }
}

async function readState() {
  const raw = await fs.readFile(STATE_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!parsed.skills || typeof parsed.skills !== "object") {
    parsed.skills = {};
  }
  return parsed;
}

async function writeState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function safeSkillName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || ROOT_DIR,
      shell: process.platform === "win32",
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

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        const message = stderr.trim() || stdout.trim() || `Command failed with code ${code}`;
        reject(new Error(message));
      }
    });
  });
}

async function readCatalog() {
  const raw = await fs.readFile(CATALOG_FILE, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed;
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
      if (body.length > 1_000_000) {
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
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function listInstalledSkills() {
  const entries = await fs.readdir(SKILLS_DIR, { withFileTypes: true });
  const state = await readState();
  const result = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const name = entry.name;
    const skillDir = path.join(SKILLS_DIR, name);
    const configPath = path.join(skillDir, "skill.json");
    const gitPath = path.join(skillDir, ".git");
    const meta = {
      name,
      title: name,
      description: "",
      version: "unknown"
    };

    if (fsSync.existsSync(configPath)) {
      try {
        const raw = await fs.readFile(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        meta.title = parsed.title || parsed.name || name;
        meta.description = parsed.description || "";
        meta.version = parsed.version || "unknown";
      } catch {
        // ignore malformed config
      }
    }

    const tracked = state.skills[name] || {};
    result.push({
      name,
      title: meta.title,
      description: meta.description,
      version: meta.version,
      enabled: tracked.enabled !== false,
      repoUrl: tracked.repoUrl || "",
      branch: tracked.branch || "main",
      installedAt: tracked.installedAt || null,
      hasGit: fsSync.existsSync(gitPath)
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/health") {
    return sendJson(res, 200, { ok: true, service: "openclaw-skill-manager" });
  }

  if (req.method === "GET" && pathname === "/api/catalog") {
    const catalog = await readCatalog();
    return sendJson(res, 200, { items: catalog });
  }

  if (req.method === "GET" && pathname === "/api/skills") {
    const skills = await listInstalledSkills();
    return sendJson(res, 200, { skills });
  }

  if (req.method === "POST" && pathname === "/api/skills/install") {
    const payload = await readJsonBody(req);
    const repoUrl = String(payload.repoUrl || "").trim();
    const branch = String(payload.branch || "main").trim() || "main";
    const rawName = payload.name || path.basename(repoUrl).replace(/\.git$/i, "");
    const name = safeSkillName(rawName);

    if (!repoUrl) {
      return sendJson(res, 400, { error: "repoUrl is required" });
    }
    if (!name) {
      return sendJson(res, 400, { error: "A valid skill name is required" });
    }

    const targetDir = path.join(SKILLS_DIR, name);
    if (fsSync.existsSync(targetDir)) {
      return sendJson(res, 409, { error: `Skill '${name}' already exists` });
    }

    await runCommand("git", ["clone", "--depth", "1", "--branch", branch, repoUrl, targetDir]);
    const state = await readState();
    state.skills[name] = {
      enabled: true,
      repoUrl,
      branch,
      installedAt: new Date().toISOString()
    };
    await writeState(state);

    return sendJson(res, 201, { ok: true, name, repoUrl, branch });
  }

  const toggleMatch = pathname.match(/^\/api\/skills\/([^/]+)\/toggle$/);
  if (req.method === "POST" && toggleMatch) {
    const name = safeSkillName(toggleMatch[1]);
    const payload = await readJsonBody(req);
    const enabled = Boolean(payload.enabled);
    const state = await readState();

    if (!state.skills[name]) {
      state.skills[name] = {};
    }
    state.skills[name].enabled = enabled;
    await writeState(state);
    return sendJson(res, 200, { ok: true, name, enabled });
  }

  const updateMatch = pathname.match(/^\/api\/skills\/([^/]+)\/update$/);
  if (req.method === "POST" && updateMatch) {
    const name = safeSkillName(updateMatch[1]);
    const dir = path.join(SKILLS_DIR, name);
    if (!fsSync.existsSync(dir)) {
      return sendJson(res, 404, { error: "Skill not found" });
    }

    const output = await runCommand("git", ["-C", dir, "pull", "--ff-only"]);
    return sendJson(res, 200, {
      ok: true,
      name,
      message: output.stdout || output.stderr || "Updated"
    });
  }

  const deleteMatch = pathname.match(/^\/api\/skills\/([^/]+)$/);
  if (req.method === "DELETE" && deleteMatch) {
    const name = safeSkillName(deleteMatch[1]);
    const dir = path.join(SKILLS_DIR, name);
    if (!fsSync.existsSync(dir)) {
      return sendJson(res, 404, { error: "Skill not found" });
    }

    await fs.rm(dir, { recursive: true, force: true });
    const state = await readState();
    delete state.skills[name];
    await writeState(state);
    return sendJson(res, 200, { ok: true, name });
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
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
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
  await ensureEnvironment();
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    console.log(`OpenClaw skill manager running at http://localhost:${PORT}`);
  });
}

start();
