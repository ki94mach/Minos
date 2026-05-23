/**
 * Production bundle against local Flask API (F10 local test).
 * Sets REACT_APP_API_URL for the child `react-scripts build` process.
 */
const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

if (!process.env.REACT_APP_API_URL) {
  process.env.REACT_APP_API_URL = "http://localhost:5000";
}

execSync("node scripts/verify-production-env.js --allow-localhost", {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});

execSync("react-scripts build", {
  stdio: "inherit",
  env: process.env,
  cwd: root,
});
