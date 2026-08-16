import esbuild from "esbuild";
import process from "process";

const production = process.argv[2] === "production";

await esbuild.build({
  entryPoints: { main: "src/main.ts", "desktop-transports": "src/connections/DesktopTransportFactory.ts", "desktop-ui": "src/platform/DesktopUiServices.ts" },
  bundle: true,
  platform: "node",
  external: ["obsidian", "electron", "cpu-features", "@codemirror/autocomplete", "@codemirror/collab", "@codemirror/commands", "@codemirror/language", "@codemirror/lint", "@codemirror/search", "@codemirror/state", "@codemirror/view", "@lezer/common", "@lezer/highlight", "@lezer/lr"],
  format: "cjs",
  target: "es2022",
  logLevel: "info",
  sourcemap: production ? false : "inline",
  treeShaking: true,
  outdir: ".",
  minify: production
});
