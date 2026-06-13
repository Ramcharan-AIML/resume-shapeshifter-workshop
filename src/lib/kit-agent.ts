import Groq from "groq-sdk";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "groq-sdk/resources/chat/completions";
import type { TailoringResult, ApplicationKit, AgentLogEntry } from "./schema";
import { checkKitQuality } from "./kit-quality-checker";

const MAX_ITERATIONS = 2;

const KIT_SYSTEM_PROMPT = `You are a career coach who writes cover letters and cold outreach emails that sound like a HUMAN wrote them — never like AI. You work in iterations:

PHASE 1 — DRAFT:
Write a personalized cover letter and a recruiter cold email based on the candidate's resume and the target job description. Use the draft_application_kit tool to submit them.

PHASE 2 — REFINE IF NEEDED:
A recruiter-lens quality checker will scan your drafts. If it flags issues, you'll get a list of specific problems. Rewrite the drafts to fix every single issue, then call draft_application_kit again.

WRITING RULES (CRITICAL — these are recruiter-trained):
1. Cover letter: 200–280 words. Cold email: 80–130 words. STRICT length limits.
2. NEVER use these phrases (they scream AI):
   - "I am writing to express..."
   - "I am thrilled to apply..."
   - "leverage", "synergy", "moreover", "furthermore"
   - "as evidenced by", "in conclusion", "with that said"
   - "I hope this email finds you well"
   - "I came across your job posting"
   - "delve", "tapestry", "dive deep"
   - "enclosed please find"
3. Use contractions (I'm, I've, won't, can't) — humans use them.
4. Mention the company name AT LEAST TWICE in the cover letter, AT LEAST ONCE in the cold email.
5. Open with a SPECIFIC hook — a detail from the job description or a result from the candidate's resume. Never a generic greeting.
6. Reference ONE specific project, employer, or experience from the candidate's actual resume.
7. Use varied sentence rhythm. Short sentences. Then longer ones. Mix it up.
8. Max 3 em-dashes per document.
9. Don't overuse "passionate", "thrilled", "excited". One is fine, three is robotic.
10. End with a direct, specific ask — a 15-minute call, an interview slot, a portfolio review. Not "thank you for your consideration".

NEVER invent skills, employers, technologies, or credentials not in the candidate's resume.

When you draft, use the draft_application_kit tool with:
- coverLetter.subject: the email subject line (e.g., "Frontend Developer role — Ramcharan Yachamaneni")
- coverLetter.body: the full cover letter text
- coldEmail.subject: a snappy cold-outreach subject line
- coldEmail.body: the cold email text

After 2 iterations max, you must finalize.`;

const DRAFT_KIT_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "draft_application_kit",
    description:
      "Submit your drafted cover letter and cold email. The system will run a recruiter-lens quality check and respond with either 'passed' (finalize) or a list of issues (rewrite both).",
    parameters: {
      type: "object",
      properties: {
        coverLetter: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description:
                "Email subject line for sending the cover letter. Keep it specific and direct, e.g. 'Frontend Developer role — Your Name'.",
            },
            body: {
              type: "string",
              description:
                "The cover letter body. 200–280 words. Must NOT contain banned AI-tell phrases.",
            },
          },
          required: ["subject", "body"],
        },
        coldEmail: {
          type: "object",
          properties: {
            subject: {
              type: "string",
              description:
                "Cold-outreach subject line. Snappy, specific, under 60 chars.",
            },
            body: {
              type: "string",
              description: "The cold email body. 80–130 words.",
            },
          },
          required: ["subject", "body"],
        },
      },
      required: ["coverLetter", "coldEmail"],
    },
  },
};

function buildContextSummary(
  tailoring: TailoringResult,
  resumeText: string,
  jdText: string
): string {
  const projectsLine = tailoring.projects
    .slice(0, 3)
    .map((p) => `- ${p.name} (${p.techStack})`)
    .join("\n");
  const skillsLine = tailoring.skills
    .map((s) => `${s.category}: ${s.items.slice(0, 6).join(", ")}`)
    .join("\n");

  return [
    "## CANDIDATE",
    `Name: ${tailoring.candidate.name}`,
    `Profile: ${tailoring.candidate.profile}`,
    "",
    "## RELEVANT PROJECTS",
    projectsLine || "(none parsed)",
    "",
    "## SKILLS",
    skillsLine || "(none parsed)",
    "",
    "## TARGET ROLE",
    `Title: ${tailoring.jdSummary.jobTitle}`,
    `Company: ${tailoring.jdSummary.company || "(not specified — use 'your team' or a sensible fallback)"}`,
    `Required: ${tailoring.jdSummary.requiredSkills.slice(0, 8).join(", ")}`,
    `Preferred: ${tailoring.jdSummary.preferredSkills.slice(0, 6).join(", ")}`,
    "",
    "## FULL JOB DESCRIPTION (for context, find ONE specific detail to reference)",
    jdText.trim().slice(0, 1500),
    "",
    "## CANDIDATE'S ORIGINAL RESUME (source of truth — never invent beyond this)",
    resumeText.trim().slice(0, 2000),
    "",
    "Now draft the cover letter and cold email and submit them via the draft_application_kit tool.",
  ].join("\n");
}

export async function generateApplicationKit(input: {
  tailoringResult: TailoringResult;
  resumeText: string;
  jdText: string;
}): Promise<ApplicationKit> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in .env.local");
  }

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const groq = new Groq({ apiKey });

  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: KIT_SYSTEM_PROMPT },
    {
      role: "user",
      content: buildContextSummary(
        input.tailoringResult,
        input.resumeText,
        input.jdText
      ),
    },
  ];

  const agentLog: AgentLogEntry[] = [
    {
      kind: "info",
      icon: "✨",
      message: "Drafting your cover letter and cold email…",
    },
  ];

  let currentKit: {
    coverLetter: { subject: string; body: string };
    coldEmail: { subject: string; body: string };
  } | null = null;
  let finalScore = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const response = await groq.chat.completions.create({
      model,
      messages,
      tools: [DRAFT_KIT_TOOL],
      tool_choice: {
        type: "function",
        function: { name: "draft_application_kit" },
      },
      temperature: 0.75,
      max_tokens: 2500,
    });

    const msg = response.choices?.[0]?.message;
    const tc = msg?.tool_calls?.[0];
    if (!tc || tc.function.name !== "draft_application_kit") {
      throw new Error("Agent failed to call draft_application_kit");
    }

    let args: {
      coverLetter?: { subject?: string; body?: string };
      coldEmail?: { subject?: string; body?: string };
    };
    try {
      args = JSON.parse(tc.function.arguments);
    } catch {
      throw new Error("Agent tool args were not valid JSON");
    }

    const cl = args.coverLetter;
    const ce = args.coldEmail;
    if (
      !cl ||
      typeof cl.subject !== "string" ||
      typeof cl.body !== "string" ||
      !ce ||
      typeof ce.subject !== "string" ||
      typeof ce.body !== "string"
    ) {
      throw new Error("Agent draft was missing required fields");
    }

    currentKit = {
      coverLetter: { subject: cl.subject, body: cl.body },
      coldEmail: { subject: ce.subject, body: ce.body },
    };

    if (iter === 0) {
      agentLog.push({
        kind: "info",
        icon: "👀",
        message:
          "Putting on the recruiter lens… reviewing as if I'm screening 200 applications today",
      });
    } else {
      agentLog.push({
        kind: "info",
        icon: "🔧",
        message:
          "Refining the drafts based on what would make a recruiter hit 'next'…",
      });
      agentLog.push({
        kind: "info",
        icon: "👀",
        message: "Putting the new drafts under the recruiter lens again…",
      });
    }

    const quality = checkKitQuality({
      coverLetter: currentKit.coverLetter,
      coldEmail: currentKit.coldEmail,
      companyName: input.tailoringResult.jdSummary.company,
      jobTitle: input.tailoringResult.jdSummary.jobTitle,
    });

    finalScore = quality.score;

    if (quality.passed) {
      agentLog.push({
        kind: "success",
        icon: "✅",
        message: "Pass: sounds human, right length, personalized, no AI-tells",
      });
      agentLog.push({
        kind: "success",
        icon: "📨",
        message: `Application kit ready (Quality score: ${quality.score}/100)`,
      });
      break;
    }

    for (const issue of quality.issues.slice(0, 6)) {
      agentLog.push({
        kind: "warning",
        message: `${issue.field === "coverLetter" ? "Cover letter" : "Cold email"} — ${issue.message}`,
      });
    }

    if (iter === MAX_ITERATIONS - 1) {
      agentLog.push({
        kind: "success",
        icon: "📨",
        message: `Application kit finalized (Quality score: ${quality.score}/100)`,
      });
      break;
    }

    messages.push({
      role: "assistant",
      content: msg?.content ?? "",
      tool_calls: msg?.tool_calls,
    });
    messages.push({
      role: "tool",
      tool_call_id: tc.id,
      content: JSON.stringify({
        passed: false,
        score: quality.score,
        issues: quality.issues.map(
          (i) =>
            `${i.field === "coverLetter" ? "Cover letter" : "Cold email"}: ${i.message}`
        ),
        instruction:
          "Rewrite BOTH the cover letter and the cold email, addressing every issue above. Use the draft_application_kit tool again.",
      }),
    });
  }

  if (!currentKit) {
    throw new Error("Agent loop ended without producing a kit");
  }

  return {
    coverLetter: currentKit.coverLetter,
    coldEmail: currentKit.coldEmail,
    qualityScore: finalScore,
    agentLog,
  };
}
