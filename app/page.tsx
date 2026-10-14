import type { Metadata } from "next";
import { HomeCta } from "@/components/home-cta";

export const metadata: Metadata = {
  description:
    "For university students studying from slides: upload a whole course of PDFs and PowerPoints, get practice quizzes in minutes, and practise your mistakes until you know them for the exam.",
};

const steps = [
  {
    title: "Upload your slides",
    text: "Upload a PDF or PowerPoint, or paste your notes.",
  },
  {
    title: "Get a quiz",
    text: "QuizMe writes multiple-choice or open questions based only on that material.",
  },
  {
    title: "Practise",
    text: "Answer, check the explanations and see your score before the exam.",
  },
];

// Static preview of a generated question (not interactive).
const example = {
  question:
    "A government sets a price ceiling below the market equilibrium price. What happens?",
  options: [
    "A surplus, because sellers produce more",
    "A shortage, because quantity demanded exceeds quantity supplied",
    "Nothing, because the market ignores the ceiling",
    "The demand curve shifts to the right",
  ],
  correctIndex: 1,
  explanation:
    "At the lower legal price buyers want more than sellers are willing to supply, so there is a shortage.",
};

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-balance text-slate-900 sm:text-5xl">
          Exam coming up? Turn your lecture slides into a practice quiz.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-pretty text-slate-700">
          For university students studying from slides: upload a whole course
          of PDFs and PowerPoints, test yourself in minutes, and practise your
          mistakes until you know them for the exam.
        </p>
        <HomeCta />
      </section>

      <section aria-labelledby="how-it-works" className="mt-16">
        <h2
          id="how-it-works"
          className="text-center text-xl font-semibold text-slate-900"
        >
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <span
                aria-hidden="true"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-800"
              >
                {i + 1}
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-1 text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="example-question" className="mt-16">
        <h2
          id="example-question"
          className="text-center text-xl font-semibold text-slate-900"
        >
          Example question
        </h2>
        <div className="mx-auto mt-6 max-w-xl rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-600">
            Multiple choice · Microeconomics
          </p>
          <p className="mt-1 font-semibold text-slate-900">{example.question}</p>
          <ol className="mt-3 space-y-2">
            {example.options.map((option, o) => {
              const correct = o === example.correctIndex;
              return (
                <li
                  key={option}
                  className={`flex items-start gap-2 rounded-lg border-2 px-3 py-2 text-slate-900 ${
                    correct ? "border-green-700 bg-green-50" : "border-slate-200"
                  }`}
                >
                  <span className="font-semibold">
                    {String.fromCharCode(65 + o)}.
                  </span>
                  <span className="min-w-0 flex-1 break-words">{option}</span>
                  {correct && (
                    <span className="shrink-0 font-semibold text-green-800">
                      ✓ Correct
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 rounded-lg bg-green-50 p-3 text-green-900">
            <strong>Why:</strong> {example.explanation}
          </p>
        </div>
      </section>
    </div>
  );
}
