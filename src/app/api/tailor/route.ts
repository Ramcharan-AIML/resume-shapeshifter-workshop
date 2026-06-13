import { NextRequest, NextResponse } from "next/server";
import { tailorResume } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TailorRequestBody {
  resumeText?: unknown;
  jdText?: unknown;
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Add your Groq API key to .env.local (GROQ_API_KEY). Get a free key at https://console.groq.com/keys and restart the dev server.",
      },
      { status: 400 }
    );
  }

  let body: TailorRequestBody;
  try {
    body = (await req.json()) as TailorRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const resumeText = typeof body.resumeText === "string" ? body.resumeText : "";
  const jdText = typeof body.jdText === "string" ? body.jdText : "";

  if (resumeText.trim().length < 50 || jdText.trim().length < 50) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Please paste a real resume and job description (at least 50 characters each).",
      },
      { status: 400 }
    );
  }

  try {
    const result = await tailorResume(resumeText, jdText);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
