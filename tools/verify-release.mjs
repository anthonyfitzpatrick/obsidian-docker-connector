import { copyFile, mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const stagingDirectory = "dist/community-plugin/docker-connector";
const legacyFiles = ["desktop-transports.js", "desktop-ui.js"];
const forbiddenBundleReferences = ["desktop-transports.js", "desktop-ui.js", "./desktop-transports", "./desktop-ui"];

function fail(message) {
  throw new Error(`Release validation failed: ${message}`);
}

async function expectExactFiles(directory, label) {
  let files;
  try {
    files = (await readdir(directory)).sort();
  } catch {
    fail(`${label} is missing`);
  }
  if (files.join("\n") !== releaseFiles.join("\n")) fail(`${label} must contain exactly ${releaseFiles.join(", ")}; found ${files.join(", ") || "nothing"}`);
}

function checkSyntax(path) {
  const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
  if (result.status !== 0) fail(`${path} is not valid JavaScript: ${result.stderr || result.stdout}`);
}

async function checkMain(path, label) {
  let main;
  try {
    main = await readFile(path, "utf8");
  } catch {
    fail(`${label} is missing`);
  }
  for (const reference of forbiddenBundleReferences) {
    if (main.includes(reference)) fail(`${label} references ${reference}`);
  }
  checkSyntax(path);
}

for (const legacy of legacyFiles) {
  try {
    await stat(legacy);
    fail(`obsolete root artifact ${legacy} is present`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Release validation failed:")) throw error;
  }
}

await expectExactFiles(stagingDirectory, "release staging directory");
const stagedMain = join(stagingDirectory, "main.js");
await checkMain("main.js", "root main.js");
await checkMain(stagedMain, "staged main.js");

const manifest = JSON.parse(await readFile(join(stagingDirectory, "manifest.json"), "utf8"));
if (manifest.id !== "docker-connector") fail("staged manifest has an unexpected plugin ID");
if ((await stat(join(stagingDirectory, "styles.css"))).size === 0) fail("staged stylesheet is empty");

const installation = await mkdtemp(join(tmpdir(), "docker-connector-release-"));
try {
  await Promise.all(releaseFiles.map((file) => copyFile(join(stagingDirectory, file), join(installation, file))));
  await expectExactFiles(installation, "clean installation directory");
  checkSyntax(join(installation, "main.js"));
} finally {
  await rm(installation, { recursive: true, force: true });
}

console.log(`Release validation passed: ${releaseFiles.join(", ")}`);
