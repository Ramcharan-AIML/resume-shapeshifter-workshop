import { NextRequest, NextResponse } from "next/server";
import {
  runInterviewTurn,
  type InterviewMessage,
} from "@/lib/interview-agent";

export const runtime = "nodejs";
export const maxDuration = 60;

interface InterviewBody {
  resumeText?: unknown;
  jdText?: unknown;
  conversation?: unknown;
}

function isInterviewMessage(value: unknown): value is InterviewMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.role === "agent" || v.role === "user") &&
    typeof v.content === "string" &&
    v.content.length > 0
  );
}

export async function POST(req: NextRequest) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      {
        success: false,
        error:
          "GROQ_API_KEY is missing in .env.local. Get a free key from https://console.groq.com/keys and restart the dev server.",
      },
      { status: 400 }
    );
  }

  let body: InterviewBody;
  try {
    body = (await req.json()) as InterviewBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const resumeText =
    typeof body.resumeText === "string" ? body.resumeText : "";
  const jdText = typeof body.jdText === "string" ? body.jdText : "";
  const conversation = Array.isArray(body.conversation)
    ? body.conversation.filter(isInterviewMessage)
    : [];

  if (resumeText.trim().length < 50 || jdText.trim().length < 50) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Resume and job description are missing or too short. Return to the results page and re-run analysis.",
      },
      { status: 400 }
    );
  }

  try {
    const turn = await runInterviewTurn(resumeText, jdText, conversation);
    return NextResponse.json({ success: true, data: turn });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Interview agent failed.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
