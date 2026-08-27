import esbuild from "esbuild";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import process from "process";

const production = process.argv[2] === "production";
const stagingDirectory = "dist/community-plugin/docker-connector";

await Promise.all([rm("desktop-transports.js", { force: true }), rm("desktop-ui.js", { force: true })]);

await esbuild.build({
  entryPoints: { main: "src/main.ts" },
  bundle: true,
  platform: "node",
  // "*.node" keeps ssh2's optional native binding a runtime require, so the
  // bundle is identical whether or not the build host compiled it. ssh2
  // already falls back to its pure JavaScript crypto when it is absent.
  external: ["obsidian", "electron", "cpu-features", "*.node", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outdir: ".",
  minify: production
});

if (production) {
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });
  await Promise.all(["main.js", "manifest.json", "styles.css"].map((file) => copyFile(file, join(stagingDirectory, file))));
}
