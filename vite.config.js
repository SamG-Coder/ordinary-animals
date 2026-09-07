import { defineConfig } from "vite";
import { readFileSync, mkdirSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
export default defineConfig({
  base: "./",
  publicDir: "game-assets",
  plugins: [
    {
      name: "catalog-only-assets",
      closeBundle() {
        const catalog = JSON.parse(
          readFileSync("game-assets/asset-catalog.json", "utf8"),
        );
        const lighting = JSON.parse(
          readFileSync("game-assets/world-lighting.json", "utf8"),
        );
        for (const file of [
          "asset-catalog.json",
          "bedroom-layout.json",
          "world-lighting.json",
          "texture-hashes.json",
          lighting.environment,
          ...Object.values(catalog).map((a) => a.model),
        ]) {
          const target = resolve("dist", file);
          mkdirSync(dirname(target), { recursive: true });
          copyFileSync(resolve("game-assets", file), target);
        }
      },
    },
  ],
  build: {
    copyPublicDir: false,
    chunkSizeWarningLimit: 750,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: "three", test: /node_modules\/three/ }],
        },
      },
    },
  },
});
