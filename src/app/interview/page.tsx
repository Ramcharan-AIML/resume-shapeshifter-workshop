"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bot,
  Send,
  Loader2,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Target,
} from "lucide-react";
import { useHasHydrated, useShapeshifterStore } from "@/lib/store";
import type {
  InterviewAssessment,
  InterviewMessage,
  InterviewTurnResult,
} from "@/lib/interview-agent";

type Status =
  | "loading_first"
  | "user_turn"
  | "agent_thinking"
  | "complete"
  | "error";

const TOTAL_QUESTIONS = 5;

export default function InterviewPage() {
  const router = useRouter();
  const hydrated = useHasHydrated();
  const { result, resumeText, jdText } = useShapeshifterStore();

  const [conversation, setConversation] = useState<InterviewMessage[]>([]);
  const [questionsAsked, setQuestionsAsked] = useState<number>(0);
  const [userInput, setUserInput] = useState("");
  const [status, setStatus] = useState<Status>("loading_first");
  const [assessment, setAssessment] = useState<InterviewAssessment | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startedRef = useRef(false);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchTurn = useCallback(
    async (history: InterviewMessage[]): Promise<InterviewTurnResult> => {
      const res = await fetch("/api/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jdText,
          conversation: history,
        }),
      });
      const json = (await res.json()) as
        | { success: true; data: InterviewTurnResult }
        | { success: false; error: string };
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    [resumeText, jdText]
  );

  const startInterview = useCallback(async () => {
    setStatus("loading_first");
    setErrorMessage(null);
    setConversation([]);
    setQuestionsAsked(0);
    setAssessment(null);
    try {
      const turn = await fetchTurn([]);
      if (turn.type === "question") {
        setConversation([{ role: "agent", content: turn.message }]);
        setQuestionsAsked(turn.questionNumber);
        setStatus("user_turn");
      } else {
        setAssessment(turn.assessment);
        setStatus("complete");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to start interview."
      );
      setStatus("error");
    }
  }, [fetchTurn]);

  useEffect(() => {
    if (!hydrated) return;
    if (!result) {
      router.replace("/");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void startInterview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useLayoutEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, status, assessment]);

  useEffect(() => {
    if (status === "user_turn") {
      textareaRef.current?.focus();
    }
  }, [status]);

  async function handleSend() {
    const trimmed = userInput.trim();
    if (!trimmed || status !== "user_turn") return;

    const newUserMsg: InterviewMessage = { role: "user", content: trimmed };
    const newConv = [...conversation, newUserMsg];
    setConversation(newConv);
    setUserInput("");
    setStatus("agent_thinking");

    try {
      const turn = await fetchTurn(newConv);
      if (turn.type === "question") {
        setConversation((prev) => [
          ...prev,
          { role: "agent", content: turn.message },
        ]);
        setQuestionsAsked(turn.questionNumber);
        setStatus("user_turn");
      } else {
        if (turn.message) {
          setConversation((prev) => [
            ...prev,
            { role: "agent", content: turn.message },
          ]);
        }
        setAssessment(turn.assessment);
        setStatus("complete");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Agent failed.");
      setStatus("error");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void handleSend();
    }
  }

  if (!hydrated || !result) {
    return <div className="min-h-screen" />;
  }

  const filledDots = Math.min(
    TOTAL_QUESTIONS,
    Math.max(0, questionsAsked - (status === "user_turn" ? 1 : 0))
  );
  const visualProgress =
    status === "complete"
      ? TOTAL_QUESTIONS
      : Math.min(TOTAL_QUESTIONS, questionsAsked);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-emerald-600" />
          <span className="font-semibold text-slate-900">Mock Interview</span>
        </div>
        <button
          onClick={() => void startInterview()}
          disabled={status === "loading_first" || status === "agent_thinking"}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restart
        </button>
      </header>

      <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {result.jdSummary.jobTitle}
            {result.jdSummary.company
              ? ` · ${result.jdSummary.company}`
              : ""}
          </p>
          <p className="text-xs font-medium text-slate-500">
            Question {Math.min(visualProgress, TOTAL_QUESTIONS)} of{" "}
            {TOTAL_QUESTIONS}
          </p>
        </div>
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i < filledDots
                  ? "bg-emerald-600"
                  : i === filledDots && status !== "complete"
                    ? "bg-emerald-300"
                    : "bg-slate-200"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Powered by Gemini 2.0 Flash
        </p>
      </div>

      <section className="mt-6 flex-1 space-y-4">
        {status === "loading_first" && conversation.length === 0 && (
          <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-6">
            <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            <span className="text-sm text-slate-600">
              Preparing your interview…
            </span>
          </div>
        )}

        {conversation.map((m, i) => (
          <Bubble key={i} message={m} />
        ))}

        {status === "agent_thinking" && (
          <div className="fade-in flex max-w-[85%] items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"
                style={{ animationDelay: "300ms" }}
              />
            </div>
            <span className="text-xs text-slate-500">
              {questionsAsked >= TOTAL_QUESTIONS
                ? "Evaluating your answers…"
                : "Thinking…"}
            </span>
          </div>
        )}

        {status === "complete" && assessment && (
          <AssessmentCard assessment={assessment} />
        )}

        {status === "error" && (
          <div className="fade-in flex flex-col items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-5">
            <div className="flex items-center gap-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-semibold">Something went wrong</span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-rose-700">
              {errorMessage ?? "Unknown error."}
            </p>
            <p className="text-xs text-rose-600">
              Check your GEMINI_API_KEY in .env.local and ensure the server has been restarted.
            </p>
            <button
              onClick={() => void startInterview()}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
            >
              Try again
            </button>
          </div>
        )}

        <div ref={scrollAnchorRef} />
      </section>

      {status === "user_turn" && (
        <div className="sticky bottom-0 mt-6 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type your answer… (Cmd/Ctrl + Enter to send)"
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!userInput.trim()}
              className="inline-flex h-12 items-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:bg-slate-300"
            >
              <Send className="h-4 w-4" />
              Send
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Bubble({ message }: { message: InterviewMessage }) {
  if (message.role === "agent") {
    return (
      <div className="fade-in flex w-full justify-start">
        <div className="flex max-w-[85%] gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Bot className="h-4 w-4" />
          </div>
          <div className="rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm">
            <p className="whitespace-pre-wrap leading-relaxed">
              {message.content}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="fade-in flex w-full justify-end">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-tr-sm bg-emerald-600 px-4 py-3 text-sm text-white shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}

function AssessmentCard({
  assessment,
}: {
  assessment: InterviewAssessment;
}) {
  const isReady = assessment.verdict === "ready";
  return (
    <div className="fade-in space-y-4">
      <div
        className={`rounded-3xl border p-6 shadow-sm ${
          isReady
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
              isReady
                ? "bg-emerald-600 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {isReady ? (
              <CheckCircle2 className="h-7 w-7" />
            ) : (
              <Target className="h-7 w-7" />
            )}
          </div>
          <div className="flex-1">
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                isReady ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {isReady ? "Verdict: Ready" : "Verdict: Needs Practice"}
            </p>
            <p
              className={`mt-1 text-5xl font-extrabold ${
                isReady ? "text-emerald-700" : "text-amber-700"
              }`}
            >
              {assessment.overall_score}
              <span
                className={`text-2xl ${
                  isReady ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                /100
              </span>
            </p>
            <p
              className={`mt-3 text-sm leading-relaxed ${
                isReady ? "text-emerald-900" : "text-amber-900"
              }`}
            >
              {assessment.summary}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700">
              Strengths
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {assessment.strengths.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-800"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-700">
              Areas to Improve
            </h3>
          </div>
          <ul className="mt-3 space-y-2">
            {assessment.areas_to_improve.map((a, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm text-slate-800"
              >
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
