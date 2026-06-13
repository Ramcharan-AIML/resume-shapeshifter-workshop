const AI_TELL_PHRASES: readonly string[] = [
  "i am writing to express",
  "i am writing to apply",
  "i am thrilled",
  "i am excited to apply",
  "i am delighted",
  "i'm thrilled to apply",
  "leverage",
  "leveraging",
  "synergy",
  "synergies",
  "moreover",
  "furthermore",
  "as evidenced by",
  "in conclusion",
  "with that said",
  "i hope this email finds you well",
  "i hope this finds you well",
  "i came across your job",
  "i recently came across",
  "enclosed please find",
  "elated",
  "dive deep",
  "dive deeper",
  "spearheaded",
  "tapestry",
  "delve",
];

const GENERIC_OPENERS: readonly string[] = [
  "i hope this email finds you well",
  "i hope this finds you well",
  "i came across your job",
  "i am writing to apply",
  "i am writing to express",
  "i'm reaching out because",
  "i recently came across",
];

const EMPTY_PLATITUDES: readonly string[] = [
  "passionate",
  "thrilled",
  "excited",
  "delighted",
  "amazing",
  "incredible",
  "fantastic",
];

export interface KitQualityIssue {
  field: "coverLetter" | "coldEmail";
  message: string;
}

export interface KitQualityResult {
  passed: boolean;
  issues: KitQualityIssue[];
  score: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countMatches(text: string, phrase: string): number {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escaped}\\b`, "gi");
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

export function checkKitQuality(input: {
  coverLetter: { subject: string; body: string };
  coldEmail: { subject: string; body: string };
  companyName: string;
  jobTitle: string;
}): KitQualityResult {
  const issues: KitQualityIssue[] = [];
  const company = (input.companyName || "").trim();

  const cl = input.coverLetter.body;
  const clLower = cl.toLowerCase();
  const clWords = countWords(cl);

  if (clWords < 180) {
    issues.push({
      field: "coverLetter",
      message: `Cover letter is ${clWords} words — too short (target 200–280)`,
    });
  } else if (clWords > 310) {
    issues.push({
      field: "coverLetter",
      message: `Cover letter is ${clWords} words — too long for a recruiter scan (target 200–280)`,
    });
  }

  for (const phrase of AI_TELL_PHRASES) {
    if (clLower.includes(phrase)) {
      issues.push({
        field: "coverLetter",
        message: `AI-tell phrase: "${phrase}"`,
      });
    }
  }

  if (company.length > 0 && !clLower.includes(company.toLowerCase())) {
    issues.push({
      field: "coverLetter",
      message: `Company name "${company}" not mentioned — not personalized enough`,
    });
  }

  const clEmDashes = (cl.match(/—/g) || []).length;
  if (clEmDashes > 3) {
    issues.push({
      field: "coverLetter",
      message: `${clEmDashes} em-dashes — overuse signals AI`,
    });
  }

  let platitudeCount = 0;
  for (const p of EMPTY_PLATITUDES) {
    platitudeCount += countMatches(cl, p);
  }
  if (platitudeCount > 2) {
    issues.push({
      field: "coverLetter",
      message: `${platitudeCount} empty platitudes (passionate, thrilled, excited) — recruiters tune out`,
    });
  }

  const clOpener = clLower.slice(0, 100);
  for (const opener of GENERIC_OPENERS) {
    if (clOpener.includes(opener)) {
      issues.push({
        field: "coverLetter",
        message: `Generic opener: "${opener}" — recruiters skip these`,
      });
      break;
    }
  }

  const ce = input.coldEmail.body;
  const ceLower = ce.toLowerCase();
  const ceWords = countWords(ce);

  if (ceWords < 70) {
    issues.push({
      field: "coldEmail",
      message: `Cold email is ${ceWords} words — too short (target 80–130)`,
    });
  } else if (ceWords > 150) {
    issues.push({
      field: "coldEmail",
      message: `Cold email is ${ceWords} words — too long for a cold outreach (target 80–130)`,
    });
  }

  for (const phrase of AI_TELL_PHRASES) {
    if (ceLower.includes(phrase)) {
      issues.push({
        field: "coldEmail",
        message: `AI-tell phrase in cold email: "${phrase}"`,
      });
    }
  }

  if (company.length > 0 && !ceLower.includes(company.toLowerCase())) {
    issues.push({
      field: "coldEmail",
      message: `Cold email doesn't mention "${company}"`,
    });
  }

  const ceOpener = ceLower.slice(0, 100);
  for (const opener of GENERIC_OPENERS) {
    if (ceOpener.includes(opener)) {
      issues.push({
        field: "coldEmail",
        message: `Cold email opens with generic phrase: "${opener}"`,
      });
      break;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - issues.length * 9));
  const passed = issues.length === 0;
  return { passed, issues, score };
}
