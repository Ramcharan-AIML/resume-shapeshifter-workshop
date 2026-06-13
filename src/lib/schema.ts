import { z } from "zod";

export const TailoringResultSchema = z.object({
  score: z.object({
    original: z.number().int().min(0).max(100),
    tailored: z.number().int().min(0).max(100),
    explanation: z.string().min(10),
  }),
  jdSummary: z.object({
    jobTitle: z.string().min(1),
    company: z.string().default(""),
    requiredSkills: z.array(z.string()).default([]),
    preferredSkills: z.array(z.string()).default([]),
  }),
  candidate: z.object({
    name: z.string().min(1),
    location: z.string().default(""),
    phone: z.string().default(""),
    email: z.string().default(""),
    profile: z.string().min(20),
  }),
  education: z
    .array(
      z.object({
        institution: z.string().min(1),
        degree: z.string().min(1),
        dates: z.string().default(""),
        location: z.string().default(""),
      })
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: z.string().min(1),
        techStack: z.string().default(""),
        bullets: z.array(z.string().min(1)).min(1),
      })
    )
    .default([]),
  skills: z
    .array(
      z.object({
        category: z.string().min(1),
        items: z.array(z.string().min(1)).min(1),
      })
    )
    .default([]),
  certifications: z.array(z.string().min(1)).default([]),
  tailoredBullets: z
    .array(
      z.object({
        original: z.string().min(1),
        tailored: z.string().min(1),
        changeReason: z.string().min(1),
        confidence: z.enum(["high", "medium", "low"]),
      })
    )
    .min(1)
    .max(8),
  gaps: z
    .array(
      z.object({
        name: z.string().min(1),
        importance: z.enum(["high", "medium", "low"]),
        suggestedAction: z.string().min(1),
      })
    )
    .max(6),
});

export type TailoringResult = z.infer<typeof TailoringResultSchema>;

export const AgentLogEntrySchema = z.object({
  kind: z.enum(["info", "warning", "success"]),
  icon: z.string().optional(),
  message: z.string(),
});

export type AgentLogEntry = z.infer<typeof AgentLogEntrySchema>;

export const ApplicationKitSchema = z.object({
  coverLetter: z.object({
    subject: z.string().min(3),
    body: z.string().min(50),
  }),
  coldEmail: z.object({
    subject: z.string().min(3),
    body: z.string().min(30),
  }),
  qualityScore: z.number().int().min(0).max(100),
  agentLog: z.array(AgentLogEntrySchema),
});

export type ApplicationKit = z.infer<typeof ApplicationKitSchema>;
