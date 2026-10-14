"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { StudySet } from "@/lib/quiz";

export function StudySetsManager({
  initialSets,
  loadError,
}: {
  initialSets: StudySet[];
  loadError: string | null;
}) {
  const [sets, setSets] = useState(initialSets);
  const [title, setTitle] = useState("");
  const [material, setMaterial] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(loadError);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Please give your study set a title.");
      return;
    }
    setSaving(true);
    setError(null);

    // Saved straight to Supabase; user_id is filled in by the database (auth.uid()).
    const { data, error } = await createClient()
      .from("study_sets")
      .insert({ title: cleanTitle, material })
      .select("id, title, material, quiz, created_at")
      .single();

    setSaving(false);
    if (error || !data) {
      setError("Could not save the study set. Please try again.");
      return;
    }
    setSets((prev) => [data as StudySet, ...prev]);
    setTitle("");
    setMaterial("");
  }

  async function handleDelete(set: StudySet) {
    if (!window.confirm(`Delete "${set.title}"? This cannot be undone.`)) return;
    const { error } = await createClient()
      .from("study_sets")
      .delete()
      .eq("id", set.id);
    if (error) {
      setError("Could not delete the study set. Please try again.");
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== set.id));
  }

  return (
    <>
      <form
        onSubmit={handleCreate}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label
            htmlFor="set-title"
            className="block text-sm font-medium text-slate-800"
          >
            Study set title
          </label>
          <input
            id="set-title"
            data-testid="core-input"
            type="text"
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Microeconomics midterm – Ch. 1-4"
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 px-3 text-base placeholder:text-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="set-material"
            className="block text-sm font-medium text-slate-800"
          >
            Paste your slides or notes{" "}
            <span className="font-normal text-slate-600">(optional)</span>
          </label>
          <textarea
            id="set-material"
            rows={4}
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-400 px-3 py-2 text-base"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          data-testid="core-submit"
          disabled={saving}
          className="min-h-11 w-full rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60 sm:w-auto"
        >
          {saving ? "Creating…" : "Create study set"}
        </button>
      </form>

      <section aria-labelledby="sets-heading" className="mt-8">
        <h2 id="sets-heading" className="text-lg font-semibold text-slate-900">
          Your study sets
        </h2>
        {sets.length === 0 ? (
          <p className="mt-3 text-slate-700">
            No study sets yet. Create your first one above.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {sets.map((set) => (
              <li
                key={set.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
              >
                <Link
                  href={`/app/sets/${set.id}`}
                  data-testid="core-item"
                  className="min-w-0 flex-1 break-words rounded px-1 py-2 font-medium text-indigo-800 underline-offset-2 hover:underline"
                >
                  {set.title}
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(set)}
                  aria-label={`Delete study set ${set.title}`}
                  className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-medium text-red-800 hover:bg-red-50"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
