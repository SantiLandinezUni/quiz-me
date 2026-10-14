import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StudySetSummary } from "@/lib/quiz";
import { StudySetsManager } from "./study-sets-manager";

export const metadata: Metadata = { title: "My study sets – QuizMe" };

export default function AppPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">My study sets</h1>
      <p className="mt-1 text-slate-700">
        Create a set for each exam, then paste your slides inside it to
        generate a practice quiz.
      </p>
      <Suspense
        fallback={<p className="mt-6 text-slate-700">Loading your study sets…</p>}
      >
        <StudySetsLoader />
      </Suspense>
    </div>
  );
}

async function StudySetsLoader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS already limits rows to this user; the filter just makes it explicit.
  const { data, error } = await supabase
    .from("study_sets")
    // Only what the list shows: material and quizzes can be large.
    .select("id, title, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <StudySetsManager
      initialSets={(data ?? []) as StudySetSummary[]}
      loadError={error ? "Could not load your study sets. Please refresh." : null}
    />
  );
}
