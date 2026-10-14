"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_MATERIAL,
  MIN_MATERIAL,
  type Quiz,
  type QuestionType,
} from "@/lib/quiz";
import { SAMPLE_MATERIAL } from "@/lib/sample-material";
import { SlidesUpload } from "@/components/slides-upload";
import { QuizPlayer } from "./quiz-player";

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
}: {
  id: string;
  title: string;
  initialMaterial: string;
  initialQuiz: Quiz | null;
}) {
  const [material, setMaterial] = useState(initialMaterial);
  const [savedMaterial, setSavedMaterial] = useState(initialMaterial);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [count, setCount] = useState<5 | 10>(5);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(initialQuiz);

  const length = material.trim().length;
  const unsaved = material !== savedMaterial;

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

    setGenerating(true);
    try {
      const res = await fetch(`/api/sets/${id}/quiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, questionType, count }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.quiz) {
        setGenError(
          body?.error ??
            "Sorry, we couldn't generate a quiz right now. Please try again in a moment.",
        );
        return;
      }
      setQuiz(body.quiz as Quiz);
      // The route also saves the material it used.
      setSavedMaterial(material);
    } catch {
      setGenError(
        "Sorry, we couldn't reach the quiz generator. Check your connection and try again.",
      );
    } finally {
      setGenerating(false);
    }
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
        <p id="material-help" className="mt-1 text-sm text-slate-600">
          {length.toLocaleString()} / {MAX_MATERIAL.toLocaleString()} characters
          · at least {MIN_MATERIAL} needed to generate a quiz
          {unsaved && " · unsaved changes"}
        </p>

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
        <p role="status" className="sr-only">
          {generating ? "Generating your quiz, this can take a few seconds." : ""}
        </p>
      </section>

      {quiz && <QuizPlayer key={quiz.generatedAt} quiz={quiz} />}
    </>
  );
}
