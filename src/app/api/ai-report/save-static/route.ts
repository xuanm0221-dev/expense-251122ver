import { NextRequest } from "next/server";
import path from "path";
import fs from "fs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { year, month, yearType, mode, content } = body as {
      year: number;
      month: number;
      yearType: string;
      mode: string;
      content: string;
    };

    if (
      typeof year !== "number" ||
      typeof month !== "number" ||
      typeof content !== "string" ||
      !content.trim()
    ) {
      return Response.json(
        { error: "year, month, yearType, mode, content 필수" },
        { status: 400 }
      );
    }

    const dir = path.join(process.cwd(), "data", "ai-reports");
    const filename = `${year}-${month}-${yearType}-${mode}.txt`;
    const filePath = path.join(dir, filename);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, content.trimEnd() + "\n", "utf-8");

    return Response.json({
      ok: true,
      path: `data/ai-reports/${filename}`,
      message: "저장 완료. git add & commit & push 하세요.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "저장 실패";
    const isVercel = process.env.VERCEL === "1";
    return Response.json(
      {
        error: isVercel
          ? "Vercel에서는 파일 저장 불가. 로컬 개발 환경에서만 사용하세요."
          : msg,
      },
      { status: 500 }
    );
  }
}
