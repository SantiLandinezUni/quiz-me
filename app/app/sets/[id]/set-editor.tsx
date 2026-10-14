"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_FOCUS,
  MAX_MATERIAL,
  MIN_MATERIAL,
  parseAttempts,
  unresolvedMistakes,
  type Attempt,
  type Quiz,
  type QuestionType,
} from "@/lib/quiz";
import { SAMPLE_MATERIAL } from "@/lib/sample-material";
import { SlidesUpload } from "@/components/slides-upload";
import { MaterialSize } from "@/components/material-size";
import { RelativeDate } from "@/components/relative-date";
import { QuizPlayer, type QuizResult, type SaveStatus } from "./quiz-player";

// "Practise my mistakes" uses at most this many questions per round.
const MISTAKES_PER_ROUND = 10;
// Past attempts listed on the page (all of them still count for mistakes).
const ATTEMPTS_SHOWN = 10;
// Above this much material, generating takes longer, so say so.
const LARGE_MATERIAL = 50_000;
const ATTEMPT_COLUMNS =
  "id, score, total, kind, wrong_questions, correct_keys, created_at";

// When the AI is busy, wait this many seconds before each automatic retry.
const BUSY_RETRY_SECONDS = [10, 20, 30];

type GenerateOutcome =
  | { kind: "ok"; quiz: Quiz }
  | { kind: "busy"; message: string }
  | { kind: "error"; message: string }
  | { kind: "cancelled" };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple choice" },
  { value: "open", label: "Open-ended" },
  { value: "mix", label: "Mix" },
];

export function SetEditor({
  id,
  title,
  initialMaterial,
  initialQuiz,
  initialAttempts,
  initialAttemptCount,
  historyError,
}: {
  id: string;
  title: string;
  initialMaterial: string;
  initialQuiz: Quiz | null;
  initialAttempts: Attempt[];
  initialAttemptCount: number;
  historyError: boolean;
}) {
  const [material, setMaterial] = useState(initialMaterial);
  const [savedMaterial, setSavedMaterial] = useState(initialMaterial);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [count, setCount] = useState<5 | 10>(5);
  const [focus, setFocus] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);
  // Bumped by "Retake quiz" to restart the same questions with answers cleared.
  const [attempt, setAttempt] = useState(0);
  // Set while waiting to retry because the AI was busy.
  const [busyRetry, setBusyRetry] = useState<{
    retry: number;
    secondsLeft: number | null; // null = the retry request is running now
  } | null>(null);
  // Each generation run gets an id; Cancel (or leaving the page) bumps it,
  // which makes the running loop stop.
  const runIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // Past attempts (newest first) and the total number ever made.
  const [attempts, setAttempts] = useState(initialAttempts);
  const [attemptCount, setAttemptCount] = useState(initialAttemptCount);
  const mistakes = useMemo(() => unresolvedMistakes(attempts), [attempts]);
  // A "Practise my mistakes" round; while set, it's shown instead of the quiz.
  const [practice, setPractice] = useState<Quiz | null>(null);
  const activeQuiz = practice ?? quiz;
  // Whether the current attempt was saved. Bumping the token when a new
  // attempt starts stops a slow save from updating the wrong attempt.
  const [attemptSave, setAttemptSave] = useState<SaveStatus>("idle");
  const saveTokenRef = useRef(0);

  useEffect(
    () => () => {
      runIdRef.current += 1;
      abortRef.current?.abort();
    },
    [],
  );

  const length = material.trim().length;
  const unsaved = material !== savedMaterial;
  const waitMessage =
    length > LARGE_MATERIAL
      ? "Generating your quiz… with this much material it can take up to a minute"
      : "Generating your quiz… this can take up to 30 seconds";

  // Called whenever a new attempt starts (retake, new quiz, mistakes round).
  function startNewAttempt() {
    saveTokenRef.current += 1;
    setAttemptSave("idle");
    setAttempt((a) => a + 1);
  }

  function scrollToQuiz() {
    // Wait for the fresh quiz to render, then bring the user to the top of it.
    requestAnimationFrame(() => {
      const heading = document.getElementById("quiz-heading");
      heading?.scrollIntoView({ behavior: "smooth", block: "start" });
      heading?.focus({ preventScroll: true });
    });
  }

  // Save a finished attempt; its wrong answers feed "Practise my mistakes".
  async function handleFinished(result: QuizResult) {
    const token = saveTokenRef.current;
    setAttemptSave("saving");
    const { data, error } = await createClient()
      .from("quiz_attempts")
      .insert({
        study_set_id: id,
        kind: practice ? "mistakes" : "quiz",
        score: result.score,
        total: result.total,
        wrong_questions: result.wrong,
        correct_keys: result.correctKeys,
      })
      .select(ATTEMPT_COLUMNS)
      .single();
    const saved = !error && data ? parseAttempts([data]) : [];
    if (saved.length > 0) {
      setAttempts((prev) => [saved[0], ...prev]);
      setAttemptCount((c) => c + 1);
    }
    if (token === saveTokenRef.current) {
      setAttemptSave(saved.length > 0 ? "saved" : "error");
    }
  }

  function handlePractiseMistakes() {
    setPractice({
      questionType: "mix",
      generatedAt: new Date().toISOString(),
      questions: mistakes.slice(0, MISTAKES_PER_ROUND),
    });
    startNewAttempt();
    scrollToQuiz();
  }

  function handleBackToQuiz() {
    setPractice(null);
    startNewAttempt();
    scrollToQuiz();
  }

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    const { error } = await createClient()
      .from("study_sets")
      .update({ material })
      .eq("id", id);
    setSaving(false);
    if (error) {
      setSaveStatus("Could not save the material. Please try again.");
      return;
    }
    setSavedMaterial(material);
    setSaveStatus("Material saved.");
  }

  function handleRetake() {
    startNewAttempt();
    scrollToQuiz();
  }

  function handleGenerateNew() {
    // Show the options and progress message while the new quiz is generated.
    document
      .getElementById("generate-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    handleGenerate();
  }

  // One request to the quiz route.
  async function requestQuiz(): Promise<GenerateOutcome> {
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(`/api/sets/${id}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          material,
          questionType,
          count,
          focus: focus.trim() || undefined,
        }),
        signal: controller.signal,
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.quiz) return { kind: "ok", quiz: body.quiz as Quiz };
      const message =
        body?.error ??
        "Sorry, we couldn't generate a quiz right now. Please try again in a moment.";
      return body?.code === "ai_busy" || res.status === 429
        ? { kind: "busy", message }
        : { kind: "error", message };
    } catch {
      if (controller.signal.aborted) return { kind: "cancelled" };
      return {
        kind: "error",
        message:
          "Sorry, we couldn't reach the quiz generator. Check your connection and try again.",
      };
    }
  }

  async function handleGenerate() {
    setGenError(null);
    if (length < MIN_MATERIAL) {
      setGenError(
        `Please add at least ${MIN_MATERIAL} characters of material (you have ${length}).`,
      );
      return;
    }
    if (length > MAX_MATERIAL) {
      setGenError(
        `That's too much material at once: the limit is ${MAX_MATERIAL.toLocaleString()} characters (you have ${length.toLocaleString()}). Split it into smaller study sets.`,
      );
      return;
    }

    const runId = ++runIdRef.current;
    const cancelled = () => runIdRef.current !== runId;
    setGenerating(true);
    try {
      for (let retry = 0; ; retry++) {
        const outcome = await requestQuiz();
        if (cancelled() || outcome.kind === "cancelled") return;

        if (outcome.kind === "ok") {
          setQuiz(outcome.quiz);
          setPractice(null);
          startNewAttempt();
          // The route also saves the material it used.
          setSavedMaterial(material);
          return;
        }
        if (outcome.kind === "error" || retry >= BUSY_RETRY_SECONDS.length) {
          setGenError(outcome.message);
          return;
        }

        // AI busy: count down, then try again automatically.
        for (let left = BUSY_RETRY_SECONDS[retry]; left > 0; left--) {
          setBusyRetry({ retry: retry + 1, secondsLeft: left });
          await sleep(1000);
          if (cancelled()) return;
        }
        setBusyRetry({ retry: retry + 1, secondsLeft: null });
      }
    } finally {
      if (!cancelled()) {
        setGenerating(false);
        setBusyRetry(null);
      }
    }
  }

  function handleCancelRetry() {
    runIdRef.current += 1;
    abortRef.current?.abort();
    setGenerating(false);
    setBusyRetry(null);
    setGenError(
      "Automatic retrying was cancelled. You can click \"Generate quiz\" again whenever you like.",
    );
  }

  return (
    <>
      <h1 className="mt-2 break-words text-2xl font-bold text-slate-900">
        {title}
      </h1>

      <section
        aria-labelledby="material-heading"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 id="material-heading" className="text-lg font-semibold">
          Lecture material
        </h2>
        <div className="mt-3">
          <SlidesUpload
            onText={(text) => {
              setMaterial((prev) =>
                prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text,
              );
              setSaveStatus(null);
            }}
          />
        </div>
        <label
          htmlFor="material"
          className="mt-3 block text-sm font-medium text-slate-800"
        >
          Paste your slides or notes
        </label>
        <textarea
          id="material"
          rows={12}
          value={material}
          onChange={(e) => {
            setMaterial(e.target.value);
            setSaveStatus(null);
          }}
          aria-describedby="material-help"
          className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-2 text-base"
        />
        <MaterialSize
          id="material-help"
          material={material}
          extra={unsaved ? " · unsaved changes" : ""}
        />

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 rounded-lg bg-slate-800 px-4 font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save material"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMaterial(SAMPLE_MATERIAL);
              setSaveStatus(null);
            }}
            className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-800 hover:bg-slate-100"
          >
            Load sample material
          </button>
        </div>
        <p role="status" className="mt-2 text-sm text-slate-700">
          {saveStatus}
        </p>
      </section>

      <section
        id="generate-section"
        aria-labelledby="generate-heading"
        className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
      >
        <h2 id="generate-heading" className="text-lg font-semibold">
          Generate a practice quiz
        </h2>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="text-sm font-medium text-slate-800">
              Question type
            </legend>
            <div className="mt-1 space-y-1">
              {TYPE_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex min-h-11 cursor-pointer items-center gap-2"
                >
                  <input
                    type="radio"
                    name="questionType"
                    value={opt.value}
                    checked={questionType === opt.value}
                    onChange={() => setQuestionType(opt.value)}
                    className="h-5 w-5 accent-indigo-700"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="count"
              className="block text-sm font-medium text-slate-800"
            >
              Number of questions
            </label>
            <select
              id="count"
              value={count}
              onChange={(e) => setCount(Number(e.target.value) as 5 | 10)}
              className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-base"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label
            htmlFor="focus"
            className="block text-sm font-medium text-slate-800"
          >
            Focus on{" "}
            <span className="font-normal text-slate-600">(optional)</span>
          </label>
          <input
            id="focus"
            type="text"
            maxLength={MAX_FOCUS}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            placeholder="e.g. Lectures 5-8, or elasticity"
            aria-describedby="focus-help"
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 px-3 text-base placeholder:text-slate-500"
          />
          <p id="focus-help" className="mt-1 text-sm text-slate-600">
            Leave empty to cover all your material evenly.
          </p>
        </div>

        {genError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {genError}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          className="mt-4 min-h-11 w-full rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60 sm:w-auto"
        >
          {generating
            ? "Generating quiz…"
            : quiz
              ? "Generate a new quiz"
              : "Generate quiz"}
        </button>
        {quiz && !generating && (
          <p className="mt-2 text-sm text-slate-600">
            Generating again replaces the current quiz.
          </p>
        )}
        {busyRetry ? (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
            <p aria-hidden="true" className="font-medium">
              {busyRetry.secondsLeft !== null
                ? `The AI is busy right now — retrying in ${busyRetry.secondsLeft} second${busyRetry.secondsLeft === 1 ? "" : "s"}…`
                : "Retrying now…"}
            </p>
            <p aria-hidden="true" className="mt-1 text-sm">
              Automatic retry {busyRetry.retry} of {BUSY_RETRY_SECONDS.length}
            </p>
            <button
              type="button"
              onClick={handleCancelRetry}
              className="mt-2 min-h-11 rounded-lg border border-amber-700 bg-white px-4 font-medium text-amber-950 hover:bg-amber-100"
            >
              Cancel
            </button>
          </div>
        ) : (
          generating && (
            <p aria-hidden="true" className="mt-2 font-medium text-indigo-900">
              {waitMessage}
            </p>
          )
        )}
        {/* Always present so screen readers announce changes. It only changes
            once per phase, not every second of the countdown. */}
        <p role="status" className="sr-only">
          {busyRetry
            ? busyRetry.secondsLeft !== null
              ? `The AI is busy right now. Retry ${busyRetry.retry} of ${BUSY_RETRY_SECONDS.length} will start automatically in ${BUSY_RETRY_SECONDS[busyRetry.retry - 1]} seconds.`
              : `Retrying now, attempt ${busyRetry.retry} of ${BUSY_RETRY_SECONDS.length}.`
            : generating
              ? waitMessage
              : ""}
        </p>
      </section>

      {(quiz || attempts.length > 0 || historyError) && (
        <section
          aria-labelledby="progress-heading"
          className="mt-6 rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 id="progress-heading" className="text-lg font-semibold">
            Your progress
          </h2>
          {historyError ? (
            <p className="mt-2 text-slate-700">
              Your past attempts couldn&apos;t be loaded right now. Quizzes
              still work.
            </p>
          ) : attempts.length === 0 ? (
            <p className="mt-2 text-slate-700">
              No attempts yet. Finish a quiz and your score will appear here.
            </p>
          ) : (
            <>
              <ol className="mt-2 divide-y divide-slate-100">
                {attempts.slice(0, ATTEMPTS_SHOWN).map((a, i) => (
                  <li key={a.id} className="py-2 text-slate-800">
                    <span className="font-medium">
                      Attempt {attemptCount - i}
                    </span>{" "}
                    · {a.score}/{a.total} · <RelativeDate iso={a.created_at} />
                    {a.kind === "mistakes" && (
                      <span className="text-slate-600"> · mistakes practice</span>
                    )}
                  </li>
                ))}
              </ol>
              {attemptCount > ATTEMPTS_SHOWN && (
                <p className="mt-1 text-sm text-slate-600">
                  Showing your {ATTEMPTS_SHOWN} most recent attempts.
                </p>
              )}
            </>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {practice ? (
              <button
                type="button"
                onClick={handleBackToQuiz}
                disabled={!quiz}
                className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
              >
                Back to the full quiz
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePractiseMistakes}
                disabled={mistakes.length === 0 || generating}
                aria-describedby="mistakes-help"
                className="min-h-11 rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:bg-slate-200 disabled:text-slate-700"
              >
                Practise my mistakes
                {mistakes.length > 0 &&
                  ` (${Math.min(mistakes.length, MISTAKES_PER_ROUND)})`}
              </button>
            )}
          </div>
          <p id="mistakes-help" className="mt-1 text-sm text-slate-600">
            {mistakes.length === 0
              ? "Questions you get wrong are saved here so you can practise them later."
              : `${mistakes.length} question${mistakes.length === 1 ? "" : "s"} you got wrong and haven't answered right since${mistakes.length > MISTAKES_PER_ROUND ? `, practised ${MISTAKES_PER_ROUND} at a time` : ""}.`}
          </p>
        </section>
      )}

      {activeQuiz && (
        <QuizPlayer
          // A new key remounts the player, which resets all answers.
          key={`${activeQuiz.generatedAt}-${attempt}`}
          quiz={activeQuiz}
          mode={practice ? "mistakes" : "quiz"}
          generating={generating}
          saveStatus={attemptSave}
          onFinished={handleFinished}
          onRetake={handleRetake}
          onGenerateNew={handleGenerateNew}
        />
      )}
    </>
  );
}
