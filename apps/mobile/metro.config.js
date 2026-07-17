// Monorepo Metro config: lets the Expo app import the shared engine (`src/`) and
// backend (`backend/`) that live at the repo root — the RN analogue of the web
// app's Vite `fs.allow: ['..']`. No code is moved.
//
// Metro is stricter than TypeScript about imports that climb above the app's
// project root, so instead of deep `../../` paths we expose the shared trees as
// named modules via `extraNodeModules` (mirrored by tsconfig `paths`).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the repo root so Metro can read the shared trees, and resolve modules
// from both node_modules. `goalgrid-core` / `goalgrid-backend` are linked into
// this app's node_modules (see scripts/link-core.sh) as packages pointing at
// ../../src and ../../backend, which Metro follows like any workspace package.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
