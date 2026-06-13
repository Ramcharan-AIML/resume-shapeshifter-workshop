import Groq from "groq-sdk";
import { TailoringResult, TailoringResultSchema } from "./schema";

const SYSTEM_PROMPT = `You are an expert resume coach AND resume parser. Given a candidate's resume and a target job description, you will:

(1) PARSE the resume into structured sections (name, contact, profile, education, projects, skills, certifications).
(2) TAILOR the profile summary AND project bullets to better match the job description.
(3) SCORE the match and identify gaps.
(4) Output everything as STRICT JSON matching the schema below.

ABSOLUTE RULES:
1. NEVER invent skills, technologies, employers, certifications, metrics, or experience that are not in the resume.
2. candidate.name, candidate.location, candidate.phone, candidate.email must be extracted EXACTLY as written in the resume.
3. candidate.profile must be a TAILORED 2-4 sentence summary emphasizing JD-relevant experience the candidate actually has. Rewrite the original profile/summary to better match the JD without inventing content.
4. Each project in projects[] must include name, techStack (comma-separated), and 2-4 TAILORED bullets. Rewrite bullets to highlight JD-relevant aspects while staying truthful.
5. Education entries: extract institution, degree, dates, location exactly as in the resume.
6. Skills: GROUP into natural categories (e.g., "Frontend", "Backend", "Tools", "UI Libraries", "Languages", "Cloud", "Databases"). Use the categories the resume uses, or sensible defaults based on the items.
7. Certifications: extract each as one entry in the array, including the issuer when present.
8. tailoredBullets[] is a separate side-by-side view for the UI. Pick the 4-6 most impactful project-bullet rewrites (with original vs tailored vs reason vs confidence).
9. Keep gaps to the top 4 most important.
10. Score honestly out of 100. The tailored score should beat the original by 10+ points when the tailoring is meaningful.
11. Output ONLY a JSON object. No markdown fences. No prose before or after.

OUTPUT SCHEMA (return JSON with EXACTLY these fields):
{
  "score": {
    "original": <int 0-100>,
    "tailored": <int 0-100>,
    "explanation": "<2-3 sentences>"
  },
  "jdSummary": {
    "jobTitle": "<string>",
    "company": "<string or empty>",
    "requiredSkills": ["..."],
    "preferredSkills": ["..."]
  },
  "candidate": {
    "name": "<full name from resume>",
    "location": "<city, state or empty>",
    "phone": "<phone or empty>",
    "email": "<email or empty>",
    "profile": "<TAILORED 2-4 sentence summary>"
  },
  "education": [
    {
      "institution": "<school name>",
      "degree": "<degree title>",
      "dates": "<start - end>",
      "location": "<city, state or empty>"
    }
  ],
  "projects": [
    {
      "name": "<project name>",
      "techStack": "<comma separated technologies>",
      "bullets": ["<tailored bullet 1>", "<tailored bullet 2>"]
    }
  ],
  "skills": [
    { "category": "Frontend", "items": ["..."] },
    { "category": "Backend", "items": ["..."] }
  ],
  "certifications": ["<cert name and issuer>", "..."],
  "tailoredBullets": [
    {
      "original": "<original bullet from resume>",
      "tailored": "<rewritten bullet>",
      "changeReason": "<brief why>",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "gaps": [
    {
      "name": "<gap topic>",
      "importance": "high" | "medium" | "low",
      "suggestedAction": "<actionable suggestion>"
    }
  ]
}

Output ONLY the JSON object. No markdown fences. No prose.`;

function buildUserPrompt(resumeText: string, jdText: string): string {
  return [
    "## CANDIDATE RESUME",
    "",
    resumeText.trim(),
    "",
    "## TARGET JOB DESCRIPTION",
    "",
    jdText.trim(),
    "",
    "Now parse the resume, tailor it to the JD, and output the full JSON object.",
  ].join("\n");
}

export async function tailorResume(
  resumeText: string,
  jdText: string
): Promise<TailoringResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is missing in .env.local");
  }

  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";
  const client = new Groq({ apiKey });
  const userPrompt = buildUserPrompt(resumeText, jdText);

  for (let attempt = 1; attempt <= 2; attempt++) {
    const extraSystem =
      attempt === 1
        ? ""
        : "\n\nYour previous response failed schema validation. Output STRICT JSON only this time, matching the schema exactly. Every required field must be present and correctly typed.";

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT + extraSystem },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 5000,
      response_format: { type: "json_object" },
    });

    const raw = response.choices?.[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (attempt === 2) {
        throw new Error("Groq returned non-JSON output twice.");
      }
      continue;
    }

    const result = TailoringResultSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    if (attempt === 2) {
      throw new Error(
        "Groq response failed schema validation twice. " +
          result.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
      );
    }
  }

  throw new Error("Unexpected exit from Groq retry loop.");
}
