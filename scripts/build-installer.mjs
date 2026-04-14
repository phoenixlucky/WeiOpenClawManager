import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DIST_WIN_DIR = path.join(ROOT_DIR, "dist", "win");
const INSTALLER_DIR = path.join(ROOT_DIR, "dist", "installer");
const STAGING_DIR = path.join(INSTALLER_DIR, "staging");
const SETUP_EXE_PATH = path.join(INSTALLER_DIR, "OpenClaw-Local-Manager-Setup.exe");
const SED_PATH = path.join(INSTALLER_DIR, "installer.sed");

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

async function ensureWinBuild() {
  const exePath = path.join(DIST_WIN_DIR, "OpenClaw-Local-Manager.exe");
  await fs.access(exePath).catch(() => {
    run(process.execPath, [path.join(ROOT_DIR, "scripts", "build-win-exe.mjs")]);
  });
}

async function prepareStaging() {
  await fs.rm(INSTALLER_DIR, { recursive: true, force: true });
  await fs.mkdir(STAGING_DIR, { recursive: true });

  const filesToCopy = [
    path.join(DIST_WIN_DIR, "OpenClaw-Local-Manager.exe"),
    path.join(DIST_WIN_DIR, "README.txt"),
    path.join(ROOT_DIR, "scripts", "installer", "install.cmd"),
    path.join(ROOT_DIR, "scripts", "installer", "create-shortcuts.ps1"),
    path.join(ROOT_DIR, "scripts", "installer", "write-uninstaller.ps1")
  ];

  for (const file of filesToCopy) {
    await fs.copyFile(file, path.join(STAGING_DIR, path.basename(file)));
  }
}

async function writeSedFile() {
  const escapedTarget = SETUP_EXE_PATH.replaceAll("\\", "\\\\");
  const escapedSource = STAGING_DIR.replaceAll("\\", "\\\\");

  const sed = [
    "[Version]",
    "Class=IEXPRESS",
    "SEDVersion=3",
    "[Options]",
    "PackagePurpose=InstallApp",
    "ShowInstallProgramWindow=0",
    "HideExtractAnimation=0",
    "UseLongFileName=1",
    "InsideCompressed=0",
    "CAB_FixedSize=0",
    "CAB_ResvCodeSigning=0",
    "RebootMode=N",
    "InstallPrompt=",
    "DisplayLicense=",
    "FinishMessage=OpenClaw Local Manager installation finished.",
    `TargetName=${escapedTarget}`,
    "FriendlyName=OpenClaw Local Manager Setup",
    "AppLaunched=install.cmd",
    "PostInstallCmd=<None>",
    "AdminQuietInstCmd=install.cmd",
    "UserQuietInstCmd=install.cmd",
    "SourceFiles=SourceFiles",
    "[SourceFiles]",
    `SourceFiles0=${escapedSource}`,
    "[SourceFiles0]",
    "%FILE0%= ",
    "%FILE1%= ",
    "%FILE2%= ",
    "%FILE3%= ",
    "%FILE4%= ",
    "[Strings]",
    'FILE0="OpenClaw-Local-Manager.exe"',
    'FILE1="README.txt"',
    'FILE2="install.cmd"',
    'FILE3="create-shortcuts.ps1"',
    'FILE4="write-uninstaller.ps1"'
  ].join("\r\n");

  await fs.writeFile(SED_PATH, `${sed}\r\n`, "ascii");
}

async function buildInstaller() {
  run("iexpress.exe", ["/N", SED_PATH]);
}

async function writeInstallerReadme() {
  const content = [
    "# OpenClaw Setup",
    "",
    "- Installer: OpenClaw-Local-Manager-Setup.exe",
    "- Install path: %LOCALAPPDATA%\\Programs\\OpenClaw Local Manager",
    "- Shortcuts: Desktop and Start Menu",
    "- Uninstaller: Uninstall OpenClaw Local Manager.cmd"
  ].join("\r\n");

  await fs.writeFile(path.join(INSTALLER_DIR, "README.txt"), `${content}\r\n`, "ascii");
}

async function main() {
  await ensureWinBuild();
  await prepareStaging();
  await writeSedFile();
  await buildInstaller();
  await writeInstallerReadme();
  console.log(`Built installer: ${SETUP_EXE_PATH}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
