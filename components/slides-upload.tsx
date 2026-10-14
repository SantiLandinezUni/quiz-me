"use client";

import { useId, useState } from "react";
import {
  SlidesError,
  UPLOAD_ACCEPT,
  extractSlidesText,
} from "@/lib/extract-slides";

// "Upload slides" button: reads a PDF/.pptx in the browser and passes the
// text to onText. The file itself is never uploaded or stored.
export function SlidesUpload({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    // Reset so choosing the same file again still triggers a change.
    input.value = "";
    if (!file) return;

    setBusy(true);
    setMessage(null);
    try {
      const { text, unit, withText, total } = await extractSlidesText(file);
      onText(text);
      // e.g. "Extracted text from 12 slides" or "from 10 of 12 slides".
      const counted =
        withText === total
          ? `${total} ${unit}${total === 1 ? "" : "s"}`
          : `${withText} of ${total} ${unit}s`;
      setMessage({
        kind: "ok",
        text: `Extracted text from ${counted} (${text.length.toLocaleString()} characters) in "${file.name}". Check the text below and edit it if needed.`,
      });
    } catch (err) {
      console.error("Slide text extraction failed:", err);
      setMessage({
        kind: "error",
        text:
          err instanceof SlidesError
            ? err.message
            : "Sorry, we couldn't read that file. Try another file or paste the text instead.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input
        id={inputId}
        type="file"
        accept={UPLOAD_ACCEPT}
        onChange={handleChange}
        disabled={busy}
        aria-describedby={hintId}
        className="peer sr-only"
      />
      <label
        htmlFor={inputId}
        aria-busy={busy}
        className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 font-medium text-slate-800 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo-700 ${busy ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-slate-100"}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        {busy ? "Reading file…" : "Upload slides"}
      </label>
      <p id={hintId} className="mt-1 text-sm text-slate-600">
        PDF or PowerPoint (.pptx), up to 20 MB. The text is added to the box
        below; the file itself isn&apos;t saved.
      </p>
      <div aria-live="polite">
        {message && (
          <p
            className={`mt-2 rounded-lg border p-3 text-sm ${
              message.kind === "ok"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-red-300 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}
