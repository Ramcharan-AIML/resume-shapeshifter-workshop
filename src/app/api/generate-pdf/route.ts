import { NextRequest, NextResponse } from "next/server";
import { renderTailoredResumeBuffer } from "@/lib/pdf-templates";
import { TailoringResultSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const maxDuration = 60;

interface GeneratePdfBody {
  result?: unknown;
  resumeText?: unknown;
}

export async function POST(req: NextRequest) {
  let body: GeneratePdfBody;
  try {
    body = (await req.json()) as GeneratePdfBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = TailoringResultSchema.safeParse(body.result);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid tailoring result in body." },
      { status: 400 }
    );
  }
  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText : "";

  try {
    const buffer = await renderTailoredResumeBuffer(parsed.data, resumeText);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          'attachment; filename="Tailored_Resume.pdf"',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PDF render failed.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
