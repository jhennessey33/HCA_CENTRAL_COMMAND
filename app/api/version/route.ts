import { execSync } from "node:child_process";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function getGitBranch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

export async function GET() {
  return NextResponse.json({
    app: "HCA Central Command",
    version: "local",
    gitCommit: getGitCommit(),
    gitBranch: getGitBranch(),
    timestamp: new Date().toISOString(),
  });
}
