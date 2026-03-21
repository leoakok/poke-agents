import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Monorepo: `next` is hoisted to the repo root `node_modules`. */
const workspaceRoot = path.join(__dirname, "..");

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    root: workspaceRoot,
  },
};

export default nextConfig;
