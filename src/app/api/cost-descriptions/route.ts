import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// Redis 사용: Vercel 배포 환경이면서 Redis URL/Token이 있을 때만 (로컬은 항상 파일)
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

function redisDescKey(brand: string, ym: string, mode: string, yearType?: string): string {
  const suffix = yearType ? `:${yearType}` : "";
  return `cost-desc:${brand}:${ym}:${mode}${suffix}`;
}
function redisBasisKey(brand: string, ym: string, mode: string, yearType?: string): string {
  const suffix = yearType ? `:${yearType}` : "";
  return `cost-basis:${brand}:${ym}:${mode}${suffix}`;
}
function redisLogKey(brand: string, ym: string, mode: string, yearType?: string): string {
  const suffix = yearType ? `:${yearType}` : "";
  return `cost-desc-logs:${brand}:${ym}:${mode}${suffix}`;
}

// 저장 로그 타입
interface SaveLog {
  timestamp: string;
  accountPath: string;
  oldValue: string;
  newValue: string;
  userIdentifier: string;
}

// 설명 데이터 타입
interface CostDescription {
  brand: string;
  ym: string; // YYYYMM 형식
  mode: "monthly" | "ytd";
  accountPath: string; // 계층 경로 (예: "l1-인건비|l2-기본급")
  description: string;
}

// 파일 경로 생성
function getDescriptionFilePath(brand: string, ym: string, mode: string, yearType?: string): string {
  const dataDir = path.join(process.cwd(), "data", "cost-descriptions");
  const suffix = yearType ? `-${yearType}` : "";
  return path.join(dataDir, `${brand}-${ym}-${mode}${suffix}.json`);
}

function getLogFilePath(brand: string, ym: string, mode: string, yearType?: string): string {
  const logDir = path.join(process.cwd(), "data", "cost-descriptions", "logs");
  const suffix = yearType ? `-${yearType}` : "";
  return path.join(logDir, `${brand}-${ym}-${mode}${suffix}.json`);
}

function getBasisFilePath(brand: string, ym: string, mode: string, yearType?: string): string {
  const dataDir = path.join(process.cwd(), "data", "cost-descriptions");
  const suffix = yearType ? `-${yearType}` : "";
  return path.join(dataDir, `${brand}-${ym}-${mode}${suffix}-basis.json`);
}

// 디렉토리 생성 (없으면)
function ensureDirectoryExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 설명 데이터 읽기 (Redis 우선, 없으면 파일)
async function readDescriptions(
  brand: string,
  ym: string,
  mode: string,
  yearType?: string
): Promise<Record<string, string>> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(redisDescKey(brand, ym, mode, yearType));
      if (raw == null) return {};
      return typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, string>);
    } catch (e: any) {
      console.error("설명 Redis 읽기 오류:", e);
      return {};
    }
  }
  try {
    const filePath = getDescriptionFilePath(brand, ym, mode, yearType);
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    console.error("설명 파일 읽기 오류:", error);
    return {};
  }
}

// 설명 데이터 쓰기 (Redis 우선, 없으면 파일)
async function writeDescriptions(
  brand: string,
  ym: string,
  mode: string,
  descriptions: Record<string, string>,
  yearType?: string
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(redisDescKey(brand, ym, mode, yearType), JSON.stringify(descriptions));
    return;
  }
  const filePath = getDescriptionFilePath(brand, ym, mode, yearType);
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(descriptions, null, 2), "utf-8");
}

async function readBasis(
  brand: string,
  ym: string,
  mode: string,
  yearType?: string
): Promise<Record<string, string>> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(redisBasisKey(brand, ym, mode, yearType));
      if (raw == null) return {};
      return typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, string>);
    } catch (e: any) {
      console.error("계산 근거 Redis 읽기 오류:", e);
      return {};
    }
  }
  try {
    const filePath = getBasisFilePath(brand, ym, mode, yearType);
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    console.error("계산 근거 파일 읽기 오류:", error);
    return {};
  }
}

async function writeBasis(
  brand: string,
  ym: string,
  mode: string,
  basis: Record<string, string>,
  yearType?: string
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(redisBasisKey(brand, ym, mode, yearType), JSON.stringify(basis));
    return;
  }
  const filePath = getBasisFilePath(brand, ym, mode, yearType);
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(basis, null, 2), "utf-8");
}

// 로그 읽기 (Redis 우선, 없으면 파일)
async function readLogs(
  brand: string,
  ym: string,
  mode: string,
  yearType?: string
): Promise<SaveLog[]> {
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(redisLogKey(brand, ym, mode, yearType));
      if (raw == null) return [];
      const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(arr) ? arr : [];
    } catch (e: any) {
      console.error("로그 Redis 읽기 오류:", e);
      return [];
    }
  }
  try {
    const filePath = getLogFilePath(brand, ym, mode, yearType);
    if (!fs.existsSync(filePath)) return [];
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  } catch (error: any) {
    console.error("로그 파일 읽기 오류:", error);
    return [];
  }
}

// 로그 쓰기 (Redis 우선, 없으면 파일)
async function writeLogs(
  brand: string,
  ym: string,
  mode: string,
  log: SaveLog,
  yearType?: string
): Promise<void> {
  const logs = await readLogs(brand, ym, mode, yearType);
  logs.unshift(log);
  const recentLogs = logs.slice(0, 100);

  const redis = getRedis();
  if (redis) {
    await redis.set(redisLogKey(brand, ym, mode, yearType), JSON.stringify(recentLogs));
    return;
  }
  const filePath = getLogFilePath(brand, ym, mode, yearType);
  ensureDirectoryExists(filePath);
  fs.writeFileSync(filePath, JSON.stringify(recentLogs, null, 2), "utf-8");
}

// GET: 설명 조회 (공개)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const brand = searchParams.get("brand") || "ALL";
    const ym = searchParams.get("ym");
    const mode = searchParams.get("mode") || "monthly";
    const yearType = searchParams.get("yearType") || undefined;

    if (!ym) {
      return NextResponse.json(
        { error: "ym 파라미터가 필요합니다 (YYYYMM 형식)" },
        { status: 400 }
      );
    }

    const descriptions = await readDescriptions(brand, ym, mode, yearType);
    const basis = await readBasis(brand, ym, mode, yearType);

    return NextResponse.json({
      success: true,
      data: descriptions || {},
      basis: basis || {},
    });
  } catch (error: any) {
    console.error("설명 조회 오류:", error);
    return NextResponse.json(
      { error: error.message || "설명 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

// POST: 설명 또는 계산 근거(basis) 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand, ym, mode, accountPath, description, basis: basisValue, yearType, password } = body;

    const expectedPassword = process.env.EDIT_PASSWORD;
    if (!expectedPassword || password !== expectedPassword) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (!brand || !ym || !mode || !accountPath) {
      return NextResponse.json(
        { error: "필수 파라미터가 누락되었습니다." },
        { status: 400 }
      );
    }

    if (typeof basisValue !== "undefined") {
      const existingBasis = await readBasis(brand, ym, mode, yearType);
      const newBasis: Record<string, string> = {
        ...existingBasis,
        [accountPath]: typeof basisValue === "string" ? basisValue : "",
      };
      if (!newBasis[accountPath]?.trim()) delete newBasis[accountPath];
      await writeBasis(brand, ym, mode, newBasis, yearType);
      return NextResponse.json({
        success: true,
        message: "계산 근거가 저장되었습니다.",
      });
    }

    const existingDescriptions = await readDescriptions(brand, ym, mode, yearType);
    const oldValue = existingDescriptions[accountPath] || "";
    const newDescriptions: Record<string, string> = {
      ...existingDescriptions,
      [accountPath]: description || "",
    };
    if (!description || description.trim() === "") {
      delete newDescriptions[accountPath];
    }
    await writeDescriptions(brand, ym, mode, newDescriptions, yearType);

    const newLog: SaveLog = {
      timestamp: new Date().toISOString(),
      accountPath,
      oldValue,
      newValue: description || "",
      userIdentifier: request.headers.get("x-user-identifier") || "anonymous",
    };
    await writeLogs(brand, ym, mode, newLog, yearType);

    return NextResponse.json({
      success: true,
      message: "설명이 저장되었습니다.",
    });
  } catch (error: any) {
    console.error("설명 저장 오류:", error);
    return NextResponse.json(
      { error: error.message || "설명 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
