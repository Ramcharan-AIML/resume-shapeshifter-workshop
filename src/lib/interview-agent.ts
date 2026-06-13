import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import { z } from "zod";

export const InterviewAssessmentSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  verdict: z.enum(["ready", "not_ready"]),
  summary: z.string().min(20),
  strengths: z.array(z.string().min(3)).min(2).max(4),
  areas_to_improve: z.array(z.string().min(3)).min(2).max(4),
});

export type InterviewAssessment = z.infer<typeof InterviewAssessmentSchema>;

export interface InterviewMessage {
  role: "agent" | "user";
  content: string;
}

export type InterviewTurnResult =
  | { type: "question"; message: string; questionNumber: number }
  | { type: "final"; message: string; assessment: InterviewAssessment };

const INTERVIEW_SYSTEM_PROMPT = `You are an experienced interview coach conducting a mock job interview. You are interviewing a candidate for a specific role.

ABSOLUTE RULES — NEVER VIOLATE:
1. You may ONLY ask questions about content present in the candidate's resume.
2. You may NEVER ask about technologies, projects, employers, certifications, or experience not mentioned in the resume.
3. You will ask EXACTLY 5 questions total. No more, no less.
4. After receiving the answer to question 5, you MUST call the submit_final_assessment function. Do NOT ask a 6th question.

QUESTION STRATEGY:
- Question 1: A warm-up question grounded in their strongest experience.
- Question 2: A technical deep-dive on a specific project or skill they list.
- Question 3: Adaptive — probe deeper into an interesting point from their previous answer.
- Question 4: A scenario question tied to the JD requirements they CAN address from their actual resume.
- Question 5: A motivation / fit question.

CONVERSATION STYLE:
- Friendly but professional.
- Number every question explicitly, e.g., "Question 2 of 5: ...".
- For your FIRST message: greet them warmly (use their name if visible in the resume), briefly explain the format (5 questions based on their resume + the JD), then ask Question 1.
- After answers 1, 2, 3, and 4: give a brief 1-2 sentence acknowledgment, then ask the next question.
- After answer 5: do NOT ask any more questions. Call submit_final_assessment immediately.

Be honest. Don't inflate scores. A candidate who gave vague, generic answers should not score above 60. A candidate who gave specific, structured, evidence-backed answers should score 80+.`;

const SUBMIT_ASSESSMENT_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "submit_final_assessment",
    description:
      "Submit the final evaluation after the candidate has answered all 5 questions. Call this ONLY after question 5 has been answered.",
    parameters: {
      type: "object",
      properties: {
        overall_score: {
          type: "number",
          description: "Honest 0-100 overall interview score.",
        },
        verdict: {
          type: "string",
          enum: ["ready", "not_ready"],
          description: "'ready' if overall_score >= 75, otherwise 'not_ready'.",
        },
        summary: {
          type: "string",
          description: "3-4 sentence synthesis of the candidate's overall performance.",
        },
        strengths: {
          type: "array",
          items: { type: "string" },
          description: "2 to 3 specific things the candidate did well.",
        },
        areas_to_improve: {
          type: "array",
          items: { type: "string" },
          description: "2 to 3 specific things to work on before the real interview.",
        },
      },
      required: [
        "overall_score",
        "verdict",
        "summary",
        "strengths",
        "areas_to_improve",
      ],
    },
  },
};

function buildContextSummary(resumeText: string, jdText: string): string {
  return [
    "## TARGET ROLE (JOB DESCRIPTION)",
    jdText.trim(),
    "",
    "## CANDIDATE RESUME (source of truth — every question must be grounded in this)",
    resumeText.trim(),
    "",
    "Begin the mock interview now. Open with a warm greeting and Question 1 of 5.",
  ].join("\n");
}

function isRateLimit(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = (err as { message?: string }).message ?? "";
  const status = (err as { status?: number }).status;
  if (status === 429) return true;
  return (
    msg.includes("429") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("too many requests") ||
    msg.toLowerCase().includes("quota")
  );
}

function friendlyRateLimitMessage(originalErr: unknown): string {
  const msg = originalErr instanceof Error ? originalErr.message : "";
  let retryAfter = 30;
  const m = msg.match(/retry.*?(\d+)\s*s/i);
  if (m) retryAfter = parseInt(m[1], 10) || 30;
  return [
    "Groq is rate-limited right now (too many requests in a short burst).",
    "",
    `Two things to try:`,
    `1. Wait ~${retryAfter} seconds and click Restart on the interview page.`,
    `2. If this keeps happening, check your free quota at https://console.groq.com (free tier = 30 requests/minute, 14400/day per key).`,
  ].join("\n");
}

async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRateLimit(err) || attempt === maxRetries) break;
      const backoffMs = 1500 * Math.pow(2, attempt) + Math.floor(Math.random() * 500);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  if (isRateLimit(lastErr)) {
    throw new Error(friendlyRateLimitMessage(lastErr));
  }
  throw lastErr instanceof Error ? lastErr : new Error("Groq call failed.");
}

export async function runInterviewTurn(
  resumeText: string,
  jdText: string,
  conversation: InterviewMessage[]
): Promise<InterviewTurnResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing in .env.local. Get a free key from https://console.groq.com/keys and restart the dev server."
    );
  }

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const groq = new Groq({ apiKey });

  const agentQuestionsAsked = conversation.filter(
    (m) => m.role === "agent"
  ).length;
  const userAnswersGiven = conversation.filter(
    (m) => m.role === "user"
  ).length;

  const shouldForceFinalize =
    agentQuestionsAsked >= 5 && userAnswersGiven >= 5;

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: INTERVIEW_SYSTEM_PROMPT },
    { role: "user", content: buildContextSummary(resumeText, jdText) },
    ...conversation.map<ChatCompletionMessageParam>((m) =>
      m.role === "agent"
        ? { role: "assistant", content: m.content }
        : { role: "user", content: m.content }
    ),
  ];

  const response = await callWithRetry(() =>
    groq.chat.completions.create({
      model,
      messages,
      tools: [SUBMIT_ASSESSMENT_TOOL],
      tool_choice: shouldForceFinalize
        ? {
            type: "function",
            function: { name: "submit_final_assessment" },
          }
        : "auto",
      temperature: 0.5,
      max_tokens: 1200,
    })
  );

  const msg = response.choices?.[0]?.message;
  if (!msg) {
    throw new Error("Empty response from Groq.");
  }

  const toolCall = msg.tool_calls?.[0];
  if (toolCall && toolCall.function.name === "submit_final_assessment") {
    let parsedArgs: unknown;
    try {
      parsedArgs = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Final assessment had malformed JSON arguments.");
    }
    const validated = InterviewAssessmentSchema.safeParse(parsedArgs);
    if (!validated.success) {
      throw new Error(
        "Final assessment failed validation: " +
          validated.error.issues.map((i) => i.message).join("; ")
      );
    }
    return {
      type: "final",
      message:
        msg.content?.trim() ||
        "Thank you. Here is your final assessment based on all five answers.",
      assessment: validated.data,
    };
  }

  const content = (msg.content ?? "").trim();
  if (!content) {
    throw new Error("Agent returned an empty question.");
  }

  return {
    type: "question",
    message: content,
    questionNumber: agentQuestionsAsked + 1,
  };
}
