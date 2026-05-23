/**
 * F10 — Ensure production SPA builds bake a real API host (not localhost).
 * Runs before `react-scripts build`. Loads .env.production when present.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const env = {};
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const allowLocalhostFlag = process.argv.includes("--allow-localhost");

const fileEnv = loadEnvFile(path.join(root, ".env.production"));
const env = { ...fileEnv, ...process.env };

if (allowLocalhostFlag && !env.REACT_APP_API_URL) {
  env.REACT_APP_API_URL = "http://localhost:5000";
}

const apiUrl = (env.REACT_APP_API_URL || "").trim();
const allowLocalhost =
  allowLocalhostFlag ||
  (env.REACT_APP_ALLOW_LOCALHOST_API || "").toLowerCase() === "true";

const isLocalhost =
  !apiUrl ||
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(apiUrl);

if (!apiUrl) {
  console.error(
    "\n[F10] REACT_APP_API_URL is missing for production build.\n" +
      "  cp .env.production.example .env.production\n" +
      "  Set REACT_APP_API_URL to your deployed Flask API origin.\n"
  );
  process.exit(1);
}

if (isLocalhost && !allowLocalhost) {
  console.error(
    `\n[F10] REACT_APP_API_URL must not be localhost for production build (got: ${apiUrl}).\n` +
      "  Use .env.production with your staging/prod API URL.\n" +
      "  For a local production bundle test only: REACT_APP_ALLOW_LOCALHOST_API=true npm run build\n"
  );
  process.exit(1);
}

console.log(`[F10] Production build API base URL: ${apiUrl}`);
