// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type Plugin } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load all env vars (no prefix) into process.env so server routes can read
// non-VITE_ secrets like SUPABASE_SERVICE_ROLE_KEY.
const serverEnv = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "");
Object.assign(process.env, serverEnv);

// Forbidden server-only module patterns that must never appear in a client bundle.
const FORBIDDEN_PATTERNS: RegExp[] = [
  /\/rbac\.server(\.[tj]sx?)?$/,
  /\/client\.server(\.[tj]sx?)?$/,
  /\.server\.[tj]sx?$/, // any *.server.ts(x) / *.server.js(x)
];

function forbidServerImportsInClient(): Plugin {
  let isClient = false;
  return {
    name: "lovable-forbid-server-imports-in-client",
    apply: "build",
    configResolved(config) {
      // ssr build => server bundle; otherwise it's the client bundle.
      isClient = !config.build?.ssr;
    },
    resolveId(source, importer) {
      if (!isClient || !importer) return null;
      // Ignore imports coming from server-only files themselves.
      if (/\.server\.[tj]sx?$/.test(importer)) return null;
      if (FORBIDDEN_PATTERNS.some((re) => re.test(source))) {
        this.error(
          `[forbid-server-imports] Client bundle imports server-only module "${source}" from "${importer}". ` +
            `Move the logic into a createServerFn handler in a *.functions.ts file.`,
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  vite: {
    plugins: [forbidServerImportsInClient()],
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(__dirname, "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(__dirname, "node_modules/entities/lib/encode.js"),
        "entities": path.resolve(__dirname, "node_modules/entities"),
      },
    },
  },
});
