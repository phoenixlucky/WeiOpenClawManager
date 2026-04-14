import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_DIR = path.join(ROOT_DIR, "dist", "win");
const EXE_NAME = "OpenClaw-Local-Manager.exe";
const EXE_PATH = path.join(DIST_DIR, EXE_NAME);
const SEA_BLOB_PATH = path.join(DIST_DIR, "sea-prep.blob");
const SEA_CONFIG_PATH = path.join(DIST_DIR, "sea-config.json");
const SEA_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT_DIR,
    stdio: options.captureOutput ? "pipe" : "inherit",
    encoding: options.captureOutput ? "utf8" : undefined,
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(output || `${command} exited with code ${result.status}`);
  }

  return result;
}

function hasNodeFlag(flag) {
  const result = run(process.execPath, ["--help"], { captureOutput: true });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  return output.includes(flag);
}

async function ensureCleanDist() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });
}

async function writeSeaConfig(config) {
  await fs.writeFile(SEA_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function tryRemoveSignature() {
  try {
    run("signtool.exe", ["remove", "/s", EXE_PATH]);
  } catch {
    // Signature removal is optional on Windows. postject may warn if skipped.
  }
}

function resolvePostjectCommand() {
  const candidates = process.platform === "win32"
    ? [
        path.join(ROOT_DIR, "node_modules", ".bin", "postject.cmd"),
        path.join(ROOT_DIR, "node_modules", "postject", "dist", "cli.js")
      ]
    : [
        path.join(ROOT_DIR, "node_modules", ".bin", "postject"),
        path.join(ROOT_DIR, "node_modules", "postject", "dist", "cli.js")
      ];

  return candidates.find((candidate) => existsSync(candidate)) || null;
}

function injectSeaBlob() {
  const postjectCommand = resolvePostjectCommand();
  if (!postjectCommand) {
    throw new Error(
      "postject is required to build with Node versions that do not support --build-sea. Run `npm install` first."
    );
  }

  const isJavaScriptCli = postjectCommand.endsWith(".js");
  const isCmdShim = postjectCommand.endsWith(".cmd");
  const postjectArgs = [EXE_PATH, "NODE_SEA_BLOB", SEA_BLOB_PATH, "--sentinel-fuse", SEA_FUSE];
  const command = isJavaScriptCli
    ? process.execPath
    : isCmdShim
      ? "cmd.exe"
      : postjectCommand;
  const args = isJavaScriptCli
    ? [postjectCommand, ...postjectArgs]
    : isCmdShim
      ? ["/c", postjectCommand, ...postjectArgs]
      : postjectArgs;

  run(command, args);
}

async function writeBundleReadme() {
  const lines = [
    "# OpenClaw Local Manager",
    "",
    "## Windows EXE",
    "",
    `- Double-click \`${EXE_NAME}\` to start the local client.`,
    "- The app will start a local web service and open the browser automatically.",
    "- If port 4173 is already occupied, set PORT before launch.",
    "",
    "## Notes",
    "",
    "- OpenClaw update still relies on local npm global install permissions.",
    "- If the browser does not open automatically, visit http://localhost:4173 manually."
  ];

  await fs.writeFile(path.join(DIST_DIR, "README.txt"), `${lines.join("\r\n")}\r\n`, "utf8");
}

async function buildWithBuildSea() {
  await writeSeaConfig({
    main: path.join(ROOT_DIR, "server.js"),
    output: EXE_PATH,
    disableExperimentalSEAWarning: true,
    assets: {
      "public/index.html": path.join(ROOT_DIR, "public", "index.html"),
      "public/app.js": path.join(ROOT_DIR, "public", "app.js"),
      "public/styles.css": path.join(ROOT_DIR, "public", "styles.css")
    }
  });

  run(process.execPath, ["--build-sea", SEA_CONFIG_PATH]);
}

async function buildWithExperimentalSea() {
  await writeSeaConfig({
    main: path.join(ROOT_DIR, "server.js"),
    output: SEA_BLOB_PATH,
    disableExperimentalSEAWarning: true,
    useSnapshot: false,
    useCodeCache: false,
    assets: {
      "public/index.html": path.join(ROOT_DIR, "public", "index.html"),
      "public/app.js": path.join(ROOT_DIR, "public", "app.js"),
      "public/styles.css": path.join(ROOT_DIR, "public", "styles.css")
    }
  });

  run(process.execPath, ["--experimental-sea-config", SEA_CONFIG_PATH]);
  await fs.copyFile(process.execPath, EXE_PATH);
  tryRemoveSignature();
  injectSeaBlob();
}

async function main() {
  if (process.platform !== "win32") {
    throw new Error("This build script generates a Windows .exe and must be run on Windows.");
  }

  await ensureCleanDist();

  if (hasNodeFlag("--build-sea")) {
    await buildWithBuildSea();
  } else {
    await buildWithExperimentalSea();
  }

  await writeBundleReadme();
  await fs.rm(SEA_BLOB_PATH, { force: true });
  await fs.rm(SEA_CONFIG_PATH, { force: true });

  console.log(`Built Windows client: ${EXE_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
