"use client";

import { useState } from "react";
import type { Question, Quiz } from "@/lib/quiz";

export function QuizPlayer({ quiz }: { quiz: Quiz }) {
  // Index of the option picked for each multiple-choice question.
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const mcqIndexes = quiz.questions
    .map((q, i) => (q.type === "mcq" ? i : -1))
    .filter((i) => i >= 0);
  const answeredCount = mcqIndexes.filter((i) => i in answers).length;
  const score = mcqIndexes.filter((i) => {
    const q = quiz.questions[i];
    return q.type === "mcq" && answers[i] === q.correctIndex;
  }).length;
  const allAnswered = mcqIndexes.length > 0 && answeredCount === mcqIndexes.length;

  return (
    <section aria-labelledby="quiz-heading" className="mt-6">
      <h2 id="quiz-heading" className="text-lg font-semibold text-slate-900">
        Your practice quiz
      </h2>
      <ol className="mt-3 space-y-4">
        {quiz.questions.map((q, i) => (
          <li
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-600">
              Question {i + 1} of {quiz.questions.length} ·{" "}
              {q.type === "mcq" ? "Multiple choice" : "Open-ended"}
            </p>
            {q.type === "mcq" ? (
              <McqQuestion
                index={i}
                question={q}
                picked={answers[i]}
                onPick={(opt) => setAnswers((prev) => ({ ...prev, [i]: opt }))}
              />
            ) : (
              <OpenQuestion index={i} question={q} />
            )}
          </li>
        ))}
      </ol>

      {mcqIndexes.length > 0 && (
        <div
          role="status"
          className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-950"
        >
          {allAnswered ? (
            <p className="text-lg font-semibold">
              Your score: {score} / {mcqIndexes.length}
              {mcqIndexes.length < quiz.questions.length &&
                " multiple-choice questions"}
            </p>
          ) : (
            <p>
              Answered {answeredCount} of {mcqIndexes.length} multiple-choice
              questions. Your score appears when you finish.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function McqQuestion({
  index,
  question,
  picked,
  onPick,
}: {
  index: number;
  question: Extract<Question, { type: "mcq" }>;
  picked: number | undefined;
  onPick: (option: number) => void;
}) {
  const answered = picked !== undefined;
  const correct = picked === question.correctIndex;

  return (
    <fieldset className="mt-1">
      <legend className="font-semibold text-slate-900">{question.question}</legend>
      <div className="mt-3 space-y-2">
        {question.options.map((opt, o) => {
          const isCorrect = o === question.correctIndex;
          const isPicked = o === picked;
          let style = "border-slate-300 hover:bg-slate-50";
          if (answered && isCorrect) style = "border-green-700 bg-green-50";
          else if (answered && isPicked) style = "border-red-700 bg-red-50";
          else if (answered) style = "border-slate-200";

          return (
            <button
              key={o}
              type="button"
              disabled={answered}
              onClick={() => onPick(o)}
              aria-pressed={isPicked}
              className={`flex min-h-11 w-full items-start gap-2 rounded-lg border-2 px-3 py-2 text-left text-slate-900 ${style}`}
            >
              <span className="font-semibold">{String.fromCharCode(65 + o)}.</span>
              <span className="min-w-0 flex-1 break-words">{opt}</span>
              {answered && isCorrect && (
                <span className="font-semibold text-green-800">✓ Correct answer</span>
              )}
              {answered && isPicked && !isCorrect && (
                <span className="font-semibold text-red-800">✗ Your answer</span>
              )}
            </button>
          );
        })}
      </div>
      <div aria-live="polite" id={`feedback-${index}`}>
        {answered && (
          <p
            className={`mt-3 rounded-lg p-3 ${correct ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
          >
            <strong>{correct ? "Correct!" : "Incorrect."}</strong>{" "}
            {question.explanation}
          </p>
        )}
      </div>
    </fieldset>
  );
}

function OpenQuestion({
  index,
  question,
}: {
  index: number;
  question: Extract<Question, { type: "open" }>;
}) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const inputId = `open-answer-${index}`;

  return (
    <div className="mt-1">
      <p className="font-semibold text-slate-900">{question.question}</p>
      <label
        htmlFor={inputId}
        className="mt-3 block text-sm font-medium text-slate-800"
      >
        Your answer
      </label>
      <textarea
        id={inputId}
        rows={4}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-2 text-base"
      />
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="mt-3 min-h-11 rounded-lg border border-indigo-700 px-4 font-medium text-indigo-800 hover:bg-indigo-50"
        >
          Show model answer
        </button>
      ) : (
        <div aria-live="polite" className="mt-3 rounded-lg bg-slate-100 p-4">
          <p className="font-semibold text-slate-900">Model answer</p>
          <p className="mt-1 text-slate-800">{question.modelAnswer}</p>
          <p className="mt-3 font-semibold text-slate-900">
            Key points to compare against
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-800">
            {question.keyPoints.map((point, k) => (
              <li key={k}>{point}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
