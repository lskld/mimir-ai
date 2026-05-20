import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const projectRoot = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin Turbopack to this project root so Next stops inferring a parent
  // directory when multiple lockfiles exist on the machine.
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
