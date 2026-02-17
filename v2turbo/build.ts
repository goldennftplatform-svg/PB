// Bun Build Script
// JS bundling with Bun, CSS with Tailwind CLI

import { $ } from "bun";

// Defaults so Vercel build works without configuring env vars in the dashboard
const DEFAULTS = {
  VITE_TAROBASE_APP_ID: "697010c4c6f87869899205a3",
  VITE_ENV: "PREVIEW",
  VITE_CHAIN: "offchain",
  VITE_RPC_URL: "https://celestia-cegncv-fast-mainnet.helius-rpc.com",
  VITE_WS_API_URL: "wss://api.tarobase.com/ws/v2",
  VITE_API_URL: "https://api.tarobase.com",
  VITE_AUTH_API_URL: "https://auth.tarobase.com",
};

const VITE_ENV = process.env.VITE_ENV || DEFAULTS.VITE_ENV;
const BUILD_PROFILE = process.env.BUILD_PROFILE;
const isProduction = BUILD_PROFILE === "production";

// Production config for title and favicon (passed via environment variables during mainnet deploy)
const PROD_TITLE = process.env.VITE_PROD_TITLE || "";
const PROD_FAVICON = process.env.VITE_PROD_FAVICON || "";

console.log(`Building for ${VITE_ENV} (production: ${isProduction})`);

// Step 1: Clean
await $`rm -rf ./dist && mkdir -p ./dist`.quiet();

// Step 2: Copy static assets first (so generated files take precedence)
await $`cp -r ./public/* ./dist/ 2>/dev/null || true`.quiet();
await $`cp ./component-inspector.js ./dist/`.quiet();
await $`cp ./console-shim.js ./dist/`.quiet();

// Step 3: Build CSS with Tailwind CLI (parallel)
console.log("Building CSS...");
await Promise.all([
  $`bunx tailwindcss -i ./src/globals.css -o ./dist/globals.css ${isProduction ? "--minify" : ""}`.quiet(),
  $`bunx tailwindcss -i ./src/styles/base.css -o ./dist/base.css ${isProduction ? "--minify" : ""}`.quiet(),
  $`bunx tailwindcss -i ./src/poof-styling.css -o ./dist/poof-styling.css ${isProduction ? "--minify" : ""}`.quiet(),
]);

// Step 4: Bundle JS with Bun
console.log("Bundling JS...");
const result = await Bun.build({
  entrypoints: ["./src/main.tsx"],
  outdir: "./dist",
  target: "browser",
  conditions: ["browser", "import"],  // Force ESM resolution to avoid CJS conversion bugs
  minify: isProduction,
  splitting: false,
  sourcemap: isProduction ? "none" : "linked",
  // Ignore CSS imports - CSS is handled separately by Tailwind CLI
  plugins: [{
    name: "ignore-css",
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, () => ({
        contents: "",
        loader: "js",
      }));
    },
  }],
  define: {
    "import.meta.env": JSON.stringify({
      VITE_ENV: VITE_ENV,
      MODE: isProduction ? "production" : "development",
      DEV: !isProduction,
      PROD: isProduction,
      VITE_TAROBASE_APP_ID: process.env.VITE_TAROBASE_APP_ID || DEFAULTS.VITE_TAROBASE_APP_ID,
      VITE_PARTYSERVER_URL: process.env.VITE_PARTYSERVER_URL || "",
      VITE_CHAIN: process.env.VITE_CHAIN || DEFAULTS.VITE_CHAIN,
      VITE_RPC_URL: process.env.VITE_RPC_URL || DEFAULTS.VITE_RPC_URL,
      VITE_AUTH_METHOD: process.env.VITE_AUTH_METHOD || "",
      VITE_WS_API_URL: process.env.VITE_WS_API_URL || DEFAULTS.VITE_WS_API_URL,
      VITE_API_URL: process.env.VITE_API_URL || DEFAULTS.VITE_API_URL,
      VITE_AUTH_API_URL: process.env.VITE_AUTH_API_URL || DEFAULTS.VITE_AUTH_API_URL,
      VITE_DEPLOYMENT_TIER: process.env.VITE_DEPLOYMENT_TIER || "preview",
    }),
    "process.env.NODE_ENV": JSON.stringify(isProduction ? "production" : "development"),
  },
  naming: {
    entry: "[name]-[hash].js",
    chunk: "chunk-[hash].js",
    asset: "assets/[name]-[hash].[ext]",
  },
  loader: {
    ".png": "file",
    ".jpg": "file",
    ".svg": "file",
    ".gif": "file",
    ".webp": "file",
    ".woff": "file",
    ".woff2": "file",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    // Properly extract error message from BuildMessage object
    const message = log.text || log.message || JSON.stringify(log);
    console.error(`  ${message}`);
    if (log.location) {
      console.error(`    at ${log.location.file}:${log.location.line}:${log.location.column}`);
    }
  }
  process.exit(1);
}

// Step 4.5: Fix asset paths - convert relative to absolute
// This ensures images load correctly on nested routes (e.g., /profile/xyz)
// Without this fix, "./assets/..." resolves to "/profile/xyz/assets/..." which 404s
console.log("Fixing asset paths...");
const jsFiles = result.outputs.filter((o: { kind: string }) => o.kind === "entry-point" || o.kind === "chunk");
for (const jsOutput of jsFiles) {
  const jsPath = jsOutput.path;
  let content = await Bun.file(jsPath).text();
  // Replace relative asset paths with absolute paths
  // Matches: "./assets/filename.ext" or './assets/filename.ext'
  content = content.replace(/(['"])\.\/assets\//g, '$1/assets/');
  await Bun.write(jsPath, content);
}

// Step 5: Generate index.html
const entryFile = result.outputs.find((o: { kind: string }) => o.kind === "entry-point")?.path.split("/").pop();

// Use production config if provided, otherwise use defaults
const faviconUrl = PROD_FAVICON || "https://assets.poof.new/preview.ico";
const pageTitle = PROD_TITLE || "Poof Preview App";

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="${faviconUrl}" />
  <title>${pageTitle}</title>
  <link rel="stylesheet" href="/globals.css" />
  <link rel="stylesheet" href="/base.css" />
  <link rel="stylesheet" href="/poof-styling.css" />
  <script>window.__VITE_ENV__ = '${VITE_ENV}';</script>
  <script src="/console-shim.js"></script>
  <script src="/component-inspector.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/${entryFile}"></script>
</body>
</html>`;
await Bun.write("./dist/index.html", html);

console.log("Build succeeded!");
for (const o of result.outputs) console.log(`  - ${(o as { path: string }).path.split("/").pop()}`);
