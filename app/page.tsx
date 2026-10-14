import Link from "next/link";

const steps = [
  {
    title: "Paste your slides",
    text: "Copy the text from your professor's lecture slides or your notes.",
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

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-20">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          University students: turn your lecture slides into practice quizzes
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-700">
          Paste what your professor gave you and test yourself in minutes, so
          you walk into the exam knowing what you know.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex min-h-12 items-center justify-center rounded-lg bg-indigo-700 px-8 text-lg font-semibold text-white hover:bg-indigo-800"
          >
            Sign up
          </Link>
          <p className="text-sm text-slate-700">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-indigo-700 underline underline-offset-2"
            >
              Log in
            </Link>
          </p>
        </div>
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
    </div>
  );
}
