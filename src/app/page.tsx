"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  RotateCcw,
  Sparkles,
  Download,
  Mail,
  Send,
  Copy,
  Check,
  Eye,
  ShieldCheck,
  AlertTriangle,
  MessageSquare,
} from "lucide-react";
import { useHasHydrated, useShapeshifterStore } from "@/lib/store";
import type {
  AgentLogEntry,
  ApplicationKit,
  TailoringResult,
} from "@/lib/schema";

type UiState = "input" | "loading" | "results" | "error";

const confidenceColors: Record<"high" | "medium" | "low", string> = {
  high: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-rose-100 text-rose-700",
};

const importanceDot: Record<"high" | "medium" | "low", string> = {
  high: "bg-rose-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
};

export default function Page() {
  const router = useRouter();
  const hydrated = useHasHydrated();
  const {
    result,
    resumeText,
    jdText,
    applicationKit,
    setResult,
    setApplicationKit,
    clear,
  } = useShapeshifterStore();

  const [uiState, setUiState] = useState<UiState>("input");
  const [resumeInput, setResumeInput] = useState("");
  const [jdInput, setJdInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const [kitGenerating, setKitGenerating] = useState(false);
  const [kitError, setKitError] = useState<string | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showCards, setShowCards] = useState(false);
  const justGeneratedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (result) {
      setUiState("results");
    } else {
      setResumeInput(resumeText);
      setJdInput(jdText);
    }
  }, [hydrated, result, resumeText, jdText]);

  useEffect(() => {
    if (!applicationKit) {
      setRevealedCount(0);
      setShowCards(false);
      return;
    }
    if (!justGeneratedRef.current) {
      setRevealedCount(applicationKit.agentLog.length);
      setShowCards(true);
      return;
    }
    setRevealedCount(0);
    setShowCards(false);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      if (count <= applicationKit.agentLog.length) {
        setRevealedCount(count);
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setShowCards(true);
          justGeneratedRef.current = false;
        }, 500);
      }
    }, 750);
    return () => clearInterval(timer);
  }, [applicationKit]);

  if (!hydrated) {
    return <div className="min-h-screen" />;
  }

  const canAnalyze =
    resumeInput.trim().length >= 50 && jdInput.trim().length >= 50;

  async function handleAnalyze() {
    setError(null);
    setUiState("loading");
    try {
      const res = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: resumeInput.trim(),
          jdText: jdInput.trim(),
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: TailoringResult }
        | { success: false; error: string };
      if (!json.success) {
        setError(json.error);
        setUiState("error");
        return;
      }
      setResult(json.data, resumeInput.trim(), jdInput.trim());
      setUiState("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setUiState("error");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result, resumeText }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(j?.error ?? "PDF generation failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Tailored_Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  async function handleGenerateKit() {
    if (!result) return;
    setKitError(null);
    setKitGenerating(true);
    justGeneratedRef.current = true;
    try {
      const res = await fetch("/api/generate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoringResult: result,
          resumeText,
          jdText,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: ApplicationKit }
        | { success: false; error: string };
      if (!json.success) {
        setKitError(json.error);
        justGeneratedRef.current = false;
        return;
      }
      setApplicationKit(json.data);
    } catch (err) {
      setKitError(
        err instanceof Error ? err.message : "Kit generation failed."
      );
      justGeneratedRef.current = false;
    } finally {
      setKitGenerating(false);
    }
  }

  function handleRegenerateKit() {
    setApplicationKit(null);
    setTimeout(handleGenerateKit, 100);
  }

  function handleStartOver() {
    clear();
    setResumeInput("");
    setJdInput("");
    setError(null);
    setKitError(null);
    setUiState("input");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-10">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-600" />
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Resume Shapeshifter
          </h1>
        </div>
        {uiState === "results" && (
          <button
            onClick={handleStartOver}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" /> Start Over
          </button>
        )}
      </header>

      <p className="mt-1 text-sm text-slate-500">
        Powered by Groq (tailoring + kit) and Gemini (interview). Free keys at{" "}
        <a
          href="https://console.groq.com/keys"
          target="_blank"
          rel="noreferrer"
          className="text-indigo-600 hover:underline"
        >
          console.groq.com/keys
        </a>{" "}
        and{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-emerald-600 hover:underline"
        >
          aistudio.google.com/apikey
        </a>
        .
      </p>

      {uiState === "input" && (
        <section className="mt-10 fade-in">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Paste your resume
              </label>
              <textarea
                value={resumeInput}
                onChange={(e) => setResumeInput(e.target.value)}
                rows={14}
                placeholder="Name, contact info, experience bullets, projects, skills…"
                className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700">
                Paste the job description
              </label>
              <textarea
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
                rows={14}
                placeholder="Job title, company, requirements, responsibilities…"
                className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>
          <div className="mt-8 flex justify-center">
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none"
            >
              <Sparkles className="h-5 w-5" />
              Analyze with AI
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </section>
      )}

      {uiState === "loading" && (
        <section className="mt-24 flex flex-col items-center text-center fade-in">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
          <p className="mt-6 text-lg font-medium text-slate-700">
            AI is tailoring your resume…
          </p>
          <p className="mt-1 text-sm text-slate-500">
            This usually takes 20–35 seconds.
          </p>
        </section>
      )}

      {uiState === "error" && (
        <section className="mt-20 flex flex-col items-center fade-in">
          <div className="max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
            <p className="font-semibold">Something went wrong.</p>
            <p className="mt-2 whitespace-pre-wrap">{error}</p>
          </div>
          <button
            onClick={() => setUiState("input")}
            className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Try again
          </button>
        </section>
      )}

      {uiState === "results" && result && (
        <section className="mt-10 space-y-8 fade-in">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-slate-500">
                  Original
                </p>
                <p className="text-4xl font-bold text-slate-700">
                  {result.score.original}
                  <span className="text-xl text-slate-400">/100</span>
                </p>
              </div>
              <ArrowRight className="h-8 w-8 text-indigo-500" />
              <div className="text-center">
                <p className="text-xs uppercase tracking-wider text-indigo-600">
                  Tailored
                </p>
                <p className="text-4xl font-bold text-indigo-600">
                  {result.score.tailored}
                  <span className="text-xl text-indigo-300">/100</span>
                </p>
              </div>
            </div>
            <p className="mx-auto mt-4 max-w-3xl text-center text-sm text-slate-600">
              {result.score.explanation}
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              {result.jdSummary.jobTitle}
            </h2>
            {result.jdSummary.company && (
              <p className="text-sm text-slate-500">
                {result.jdSummary.company}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.jdSummary.requiredSkills.map((s) => (
                <span
                  key={`r-${s}`}
                  className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
                >
                  {s}
                </span>
              ))}
              {result.jdSummary.preferredSkills.map((s) => (
                <span
                  key={`p-${s}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Tailored Bullets
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              {result.tailoredBullets.map((b, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Original
                  </p>
                  <p className="mt-1 text-sm text-slate-500 line-through">
                    {b.original}
                  </p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    Tailored
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">
                    {b.tailored}
                  </p>
                  <p className="mt-3 text-xs italic text-slate-500">
                    Why: {b.changeReason}
                  </p>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceColors[b.confidence]}`}
                    >
                      {b.confidence} confidence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {result.gaps.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-semibold text-slate-900">
                Gaps to Address
              </h3>
              <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
                {result.gaps.map((g, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 border-b border-slate-100 p-3 last:border-b-0"
                  >
                    <span
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${importanceDot[g.importance]}`}
                    />
                    <div className="text-sm">
                      <span className="font-semibold text-slate-900">
                        {g.name}
                      </span>
                      <span className="text-slate-600">
                        {" "}
                        — {g.suggestedAction}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <KitSection
            kit={applicationKit}
            generating={kitGenerating}
            error={kitError}
            revealedCount={revealedCount}
            showCards={showCards}
            onGenerate={handleGenerateKit}
            onRegenerate={handleRegenerateKit}
          />

          <div className="flex flex-col items-center gap-3 pt-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              onClick={() => router.push("/interview")}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-200 transition hover:from-emerald-700 hover:to-teal-700"
            >
              <MessageSquare className="h-5 w-5" />
              Take Mock Interview
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 text-base font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:bg-slate-100"
            >
              {downloading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              Download Tailored Resume PDF
            </button>
          </div>

          {error && (
            <p className="text-center text-sm text-rose-600">{error}</p>
          )}
        </section>
      )}
    </main>
  );
}

function KitSection({
  kit,
  generating,
  error,
  revealedCount,
  showCards,
  onGenerate,
  onRegenerate,
}: {
  kit: ApplicationKit | null;
  generating: boolean;
  error: string | null;
  revealedCount: number;
  showCards: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}) {
  if (!kit && !generating && !error) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-8 shadow-sm">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Generate Your Application Kit
            </h3>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              An AI agent drafts a personalized cover letter and recruiter cold
              email — then a second pass scans for AI-tells, length issues, and
              missing personalization, and rewrites if anything would make a
              recruiter skip your application.
            </p>
          </div>
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-emerald-600 px-7 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-200 transition hover:from-indigo-700 hover:to-emerald-700"
          >
            <Sparkles className="h-5 w-5" />
            Generate Application Kit
          </button>
        </div>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium text-slate-700">
          The Recruiter Lens Agent is working…
        </p>
        <p className="text-xs text-slate-500">
          Drafting, checking, refining if needed. Usually 10–20 seconds.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm font-semibold text-rose-800">
          Application kit generation failed
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm text-rose-700">
          {error}
        </p>
        <button
          onClick={onRegenerate}
          className="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!kit) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">
            Recruiter Lens Agent — Live Log
          </h3>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Quality {kit.qualityScore}/100
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {kit.agentLog.slice(0, revealedCount).map((entry, i) => (
            <LogRow key={i} entry={entry} />
          ))}
          {revealedCount < kit.agentLog.length && (
            <li className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              thinking…
            </li>
          )}
        </ul>
      </div>

      {showCards && (
        <div className="grid gap-5 fade-in lg:grid-cols-2">
          <ArtifactCard
            title="Cover Letter"
            subject={kit.coverLetter.subject}
            body={kit.coverLetter.body}
            icon={<Mail className="h-4 w-4" />}
            accentClass="from-indigo-500 to-blue-600"
          />
          <ArtifactCard
            title="Cold Email to Recruiter"
            subject={kit.coldEmail.subject}
            body={kit.coldEmail.body}
            icon={<Send className="h-4 w-4" />}
            accentClass="from-emerald-500 to-teal-600"
          />
        </div>
      )}

      {showCards && (
        <div className="flex justify-center">
          <button
            onClick={onRegenerate}
            className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-indigo-600 hover:underline"
          >
            ↻ Regenerate application kit
          </button>
        </div>
      )}
    </div>
  );
}

function LogRow({ entry }: { entry: AgentLogEntry }) {
  const color =
    entry.kind === "warning"
      ? "text-amber-700"
      : entry.kind === "success"
        ? "text-emerald-700"
        : "text-slate-700";
  const Icon =
    entry.kind === "warning"
      ? AlertTriangle
      : entry.kind === "success"
        ? ShieldCheck
        : Eye;
  return (
    <li className={`fade-in flex items-start gap-2 text-sm ${color}`}>
      {entry.icon ? (
        <span className="text-base leading-tight">{entry.icon}</span>
      ) : (
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="leading-relaxed">{entry.message}</span>
    </li>
  );
}

function ArtifactCard({
  title,
  subject,
  body,
  icon,
  accentClass,
}: {
  title: string;
  subject: string;
  body: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    const text = `Subject: ${subject}\n\n${body}`;
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div
        className={`flex items-center gap-2 bg-gradient-to-r ${accentClass} px-5 py-3 text-white`}
      >
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="space-y-3 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Subject
          </p>
          <p className="mt-1 text-sm font-medium text-slate-900">{subject}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Body
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {body}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-emerald-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy to clipboard
            </>
          )}
        </button>
      </div>
    </div>
  );
}
