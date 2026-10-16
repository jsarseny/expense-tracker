import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(new URL("../apps/api/package.json", import.meta.url), "utf8"),
);
await build({
  absWorkingDir: root,
  entryPoints: ["apps/api/src/index.ts"],
  outfile: "apps/api/dist/index.js",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  external: Object.keys(manifest.dependencies).filter(
    (name) => name !== "@tracker/shared",
  ),
  logLevel: "info",
});
