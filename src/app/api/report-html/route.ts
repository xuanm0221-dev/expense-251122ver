import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

function shouldUseRedis(): boolean {
  if (process.env.VERCEL !== "1") return false;
  const withKv = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  const withUpstash = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  return !!(withKv || withUpstash);
}

function getRedis(): Redis | null {
  if (!shouldUseRedis()) return null;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const REDIS_KEY = "report-html";

function getReportFilePath(): string {
  return path.join(process.cwd(), "data", "report-html.json");
}

function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function readReportHtml(): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(REDIS_KEY);
      if (raw != null && typeof raw === "string" && raw.length > 0) return raw;
    } catch (e: unknown) {
      console.error("report-html Redis 읽기 오류:", e);
    }
    try {
      const filePath = getReportFilePath();
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(content) as { html?: string };
        if (typeof parsed.html === "string" && parsed.html.length > 0) return parsed.html;
      }
    } catch (e: unknown) {
      console.error("report-html 파일 fallback 오류:", e);
    }
    return null;
  }
  try {
    const filePath = getReportFilePath();
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as { html?: string };
    return typeof parsed.html === "string" ? parsed.html : null;
  } catch (e: unknown) {
    console.error("report-html 파일 읽기 오류:", e);
    return null;
  }
}

async function writeReportHtml(html: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(REDIS_KEY, html);
    return;
  }
  const filePath = getReportFilePath();
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify({ html }, null, 2), "utf-8");
}

export async function GET() {
  try {
    const html = await readReportHtml();
    return NextResponse.json({ success: true, html: html ?? null });
  } catch (e: unknown) {
    console.error("report-html 조회 오류:", e);
    return NextResponse.json(
      { error: "보고서 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, html } = body as { password?: string; html?: string };

    if (process.env.VERCEL === "1") {
      const expectedPassword = process.env.EDIT_PASSWORD;
      if (!expectedPassword || password !== expectedPassword) {
        return NextResponse.json(
          { error: "비밀번호가 올바르지 않습니다." },
          { status: 401 }
        );
      }
    }

    const htmlStr = typeof html === "string" ? html : "";
    await writeReportHtml(htmlStr);

    return NextResponse.json({
      success: true,
      message: "보고서가 저장되었습니다.",
    });
  } catch (e: unknown) {
    console.error("report-html 저장 오류:", e);
    return NextResponse.json(
      { error: "보고서 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
