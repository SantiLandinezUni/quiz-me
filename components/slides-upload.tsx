"use client";

import { useId, useState } from "react";
import {
  SlidesError,
  UPLOAD_ACCEPT,
  extractSlidesText,
} from "@/lib/extract-slides";
import { fileHeading } from "@/lib/quiz";

type Message = { done: string | null; failed: string[] };

// "Upload slides" button: reads one or more PDF/.pptx files in the browser
// and passes their text to onText, each file under a "--- name ---" heading.
// The files themselves are never uploaded or stored.
export function SlidesUpload({
  onText,
}: {
  onText: (text: string) => void;
}) {
  const inputId = useId();
  const hintId = useId();
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const busy = progress !== null;

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files ?? []);
    // Reset so choosing the same files again still triggers a change.
    input.value = "";
    if (files.length === 0) return;

    setMessage(null);
    const pieces: string[] = [];
    const read: string[] = [];
    const failed: string[] = [];

    // One at a time keeps memory use low with a whole course of slides.
    for (const [i, file] of files.entries()) {
      setProgress(
        files.length === 1
          ? "Reading file…"
          : `Reading file ${i + 1} of ${files.length}…`,
      );
      try {
        const { text, unit, withText, total } = await extractSlidesText(file);
        pieces.push(`${fileHeading(file.name)}\n${text}`);
        // e.g. "12 slides" or "10 of 12 slides"
        read.push(
          withText === total
            ? `${total} ${unit}${total === 1 ? "" : "s"}`
            : `${withText} of ${total} ${unit}s`,
        );
      } catch (err) {
        console.error("Slide text extraction failed:", err);
        failed.push(
          `"${file.name}": ${
            err instanceof SlidesError
              ? err.message
              : "Sorry, we couldn't read this file. Try another file or paste the text instead."
          }`,
        );
      }
    }

    let done: string | null = null;
    if (pieces.length > 0) {
      const text = pieces.join("\n\n");
      onText(text);
      const chars = text.length.toLocaleString("en-US");
      done =
        pieces.length === 1
          ? `Extracted text from ${read[0]} (${chars} characters). Check the text below and edit it if needed.`
          : `Extracted text from ${pieces.length} files (${chars} characters). Each file starts with a "--- file name ---" heading in the box below.`;
    }
    setMessage({ done, failed });
    setProgress(null);
  }

  return (
    <div>
      <input
        id={inputId}
        type="file"
        multiple
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
        {progress ?? "Upload slides"}
      </label>
      <p id={hintId} className="mt-1 text-sm text-slate-600">
        PDF or PowerPoint (.pptx), up to 20 MB each. Select several files at
        once to add a whole course. The text is added to the box below; the
        files themselves aren&apos;t saved.
      </p>
      <div aria-live="polite">
        {message?.done && (
          <p className="mt-2 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">
            {message.done}
          </p>
        )}
        {message && message.failed.length > 0 && (
          <div className="mt-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <p className="font-semibold">
              {message.failed.length === 1
                ? "1 file couldn't be read:"
                : `${message.failed.length} files couldn't be read:`}
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 break-words">
              {message.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
