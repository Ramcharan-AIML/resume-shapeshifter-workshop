import { NextRequest, NextResponse } from "next/server";
import { generateApplicationKit } from "@/lib/kit-agent";
import { TailoringResultSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

interface KitBody {
  tailoringResult?: unknown;
  resumeText?: unknown;
  jdText?: unknown;
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error: "GROQ_API_KEY is missing in .env.local",
      },
      { status: 400 }
    );
  }

  let body: KitBody;
  try {
    body = (await req.json()) as KitBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = TailoringResultSchema.safeParse(body.tailoringResult);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid tailoring result in body." },
      { status: 400 }
    );
  }

  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText : "";
  const jdText = typeof body.jdText === "string" ? body.jdText : "";

  if (resumeText.trim().length < 50 || jdText.trim().length < 50) {
    return NextResponse.json(
      {
        success: false,
        error: "Resume and job description are required.",
      },
      { status: 400 }
    );
  }

  try {
    const kit = await generateApplicationKit({
      tailoringResult: parsed.data,
      resumeText,
      jdText,
    });
    return NextResponse.json({ success: true, data: kit });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Kit generation failed.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
