import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseQuiz } from "@/lib/quiz";
import { SetEditor } from "./set-editor";

export const metadata: Metadata = { title: "Study set – QuizMe" };

export default function StudySetPage({ params }: PageProps<"/app/sets/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/app"
        className="inline-flex min-h-11 items-center rounded text-sm font-medium text-indigo-700 underline underline-offset-2"
      >
        ← Back to my study sets
      </Link>
      <Suspense fallback={<p className="mt-4 text-slate-700">Loading study set…</p>}>
        {params.then(({ id }) => (
          <StudySetLoader id={id} />
        ))}
      </Suspense>
    </div>
  );
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function StudySetLoader({ id }: { id: string }) {
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: set } = await supabase
    .from("study_sets")
    .select("id, title, material, quiz")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!set) notFound();

  return (
    <SetEditor
      id={set.id}
      title={set.title}
      initialMaterial={set.material}
      initialQuiz={parseQuiz(set.quiz)}
    />
  );
}
