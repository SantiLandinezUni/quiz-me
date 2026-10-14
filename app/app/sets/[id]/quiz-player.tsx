"use client";

import { useRef, useState } from "react";
import {
  questionKey,
  type Question,
  type Quiz,
  type WrongAnswer,
} from "@/lib/quiz";

export type QuizResult = {
  score: number;
  total: number;
  wrong: WrongAnswer[];
  correctKeys: string[];
};

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type Picks = Record<number, number>;
type Marks = Record<number, boolean>;

const isCorrect = (q: Question, i: number, picks: Picks, marks: Marks) =>
  q.type === "mcq" ? picks[i] === q.correctIndex : marks[i] === true;

// Multiple choice is done once picked; open-ended once self-marked.
const isDone = (q: Question, i: number, picks: Picks, marks: Marks) =>
  q.type === "mcq" ? i in picks : i in marks;

export function QuizPlayer({
  quiz,
  mode,
  generating,
  saveStatus,
  onFinished,
  onRetake,
  onGenerateNew,
}: {
  quiz: Quiz;
  mode: "quiz" | "mistakes";
  generating: boolean;
  saveStatus: SaveStatus;
  onFinished: (result: QuizResult) => void;
  onRetake: () => void;
  onGenerateNew: () => void;
}) {
  // Index of the option picked for each multiple-choice question.
  const [picks, setPicks] = useState<Picks>({});
  // Open-ended questions whose model answer has been shown.
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  // Open-ended questions the student marked themselves (true = got it right).
  const [marks, setMarks] = useState<Marks>({});
  // Report the result only once per attempt.
  const reported = useRef(false);

  const total = quiz.questions.length;
  const answeredCount = quiz.questions.filter((q, i) => isDone(q, i, picks, marks)).length;
  const finished = answeredCount === total;
  const score = quiz.questions.filter((q, i) => isCorrect(q, i, picks, marks)).length;
  const hasOpen = quiz.questions.some((q) => q.type === "open");

  // Called after every answer: once all questions are done, report the result.
  function checkFinished(nextPicks: Picks, nextMarks: Marks) {
    if (reported.current) return;
    if (!quiz.questions.every((q, i) => isDone(q, i, nextPicks, nextMarks))) return;
    reported.current = true;
    const wrong: WrongAnswer[] = [];
    const correctKeys: string[] = [];
    quiz.questions.forEach((q, i) => {
      if (isCorrect(q, i, nextPicks, nextMarks)) correctKeys.push(questionKey(q));
      else wrong.push(q.type === "mcq" ? { question: q, picked: nextPicks[i] } : { question: q });
    });
    onFinished({ score: correctKeys.length, total, wrong, correctKeys });
  }

  function pick(i: number, option: number) {
    const next = { ...picks, [i]: option };
    setPicks(next);
    checkFinished(next, marks);
  }

  function mark(i: number, gotIt: boolean) {
    const next = { ...marks, [i]: gotIt };
    setMarks(next);
    checkFinished(picks, next);
  }

  return (
    <section aria-labelledby="quiz-heading" className="mt-6">
      <h2
        id="quiz-heading"
        tabIndex={-1}
        className="scroll-mt-4 text-lg font-semibold text-slate-900"
      >
        {mode === "mistakes" ? "Practising your mistakes" : "Your practice quiz"}
      </h2>
      {mode === "mistakes" ? (
        <p className="mt-1 text-slate-700">
          Questions you got wrong before. Answer them right to clear them from
          your mistakes.
        </p>
      ) : (
        quiz.focus && (
          <p className="mt-1 break-words text-slate-700">Focus: {quiz.focus}</p>
        )
      )}
      <ol className="mt-3 space-y-4">
        {quiz.questions.map((q, i) => (
          <li
            key={i}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="break-words text-sm font-medium text-slate-600">
              Question {i + 1} of {total} ·{" "}
              {q.type === "mcq" ? "Multiple choice" : "Open-ended"}
              {q.source && ` · From ${q.source}`}
            </p>
            {q.type === "mcq" ? (
              <McqQuestion
                index={i}
                question={q}
                picked={picks[i]}
                onPick={(opt) => pick(i, opt)}
              />
            ) : (
              <OpenQuestion
                index={i}
                question={q}
                revealed={Boolean(revealed[i])}
                onReveal={() => setRevealed((prev) => ({ ...prev, [i]: true }))}
                mark={marks[i]}
                onMark={(gotIt) => mark(i, gotIt)}
              />
            )}
          </li>
        ))}
      </ol>

      <div
        role="status"
        className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-950"
      >
        {finished ? (
          <>
            <p className="text-lg font-semibold">
              Your score: {score} / {total}
            </p>
            {hasOpen && (
              <p className="mt-1 text-sm">
                Open-ended answers count as you marked them.
              </p>
            )}
            {saveStatus !== "idle" && (
              <p className="mt-1 text-sm">
                {saveStatus === "saving" && "Saving to your history…"}
                {saveStatus === "saved" && "✓ Saved to your history."}
                {saveStatus === "error" &&
                  "This attempt couldn't be saved to your history."}
              </p>
            )}
          </>
        ) : (
          <p>
            Answered {answeredCount} of {total} questions. Your score appears
            when you finish.
          </p>
        )}
      </div>

      {finished && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
          <p className="font-semibold text-slate-900">
            Quiz finished. What next?
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onRetake}
              disabled={generating}
              className="min-h-11 rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
            >
              Retake quiz
            </button>
            <button
              type="button"
              onClick={onGenerateNew}
              disabled={generating}
              className="min-h-11 rounded-lg border border-indigo-700 px-4 font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-60"
            >
              {generating ? "Generating new questions…" : "Generate new questions"}
            </button>
          </div>
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
          const isRight = o === question.correctIndex;
          const isPicked = o === picked;
          let style = "border-slate-300 hover:bg-slate-50";
          if (answered && isRight) style = "border-green-700 bg-green-50";
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
              {answered && isRight && (
                <span className="font-semibold text-green-800">✓ Correct answer</span>
              )}
              {answered && isPicked && !isRight && (
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
  revealed,
  onReveal,
  mark,
  onMark,
}: {
  index: number;
  question: Extract<Question, { type: "open" }>;
  revealed: boolean;
  onReveal: () => void;
  mark: boolean | undefined;
  onMark: (gotIt: boolean) => void;
}) {
  const [answer, setAnswer] = useState("");
  const inputId = `open-answer-${index}`;
  const marked = mark !== undefined;

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
          onClick={onReveal}
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

          <fieldset className="mt-4">
            <legend className="font-semibold text-slate-900">
              How did your answer compare?
            </legend>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onMark(true)}
                disabled={marked}
                aria-pressed={mark === true}
                className={`min-h-11 rounded-lg border-2 px-4 font-medium text-slate-900 disabled:cursor-default ${mark === true ? "border-green-700 bg-green-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                ✓ I got it right
              </button>
              <button
                type="button"
                onClick={() => onMark(false)}
                disabled={marked}
                aria-pressed={mark === false}
                className={`min-h-11 rounded-lg border-2 px-4 font-medium text-slate-900 disabled:cursor-default ${mark === false ? "border-red-700 bg-red-50" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                ✗ I missed something
              </button>
            </div>
            {marked && (
              <p className="mt-2 text-sm text-slate-700">
                {mark
                  ? "Marked as right."
                  : "Marked as a mistake. You can practise it later with \"Practise my mistakes\"."}
              </p>
            )}
          </fieldset>
        </div>
      )}
    </div>
  );
}
