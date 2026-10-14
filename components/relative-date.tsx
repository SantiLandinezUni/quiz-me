"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// "today", "yesterday", "3 days ago"... Rendered only in the browser: the
// server doesn't know the user's timezone, so its answer could differ.
export function RelativeDate({ iso }: { iso: string }) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);
  if (!isClient) return null;

  const date = new Date(iso);
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);

  const label =
    days > -7
      ? new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day")
      : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <time dateTime={iso} title={date.toLocaleString("en-GB")}>
      {label}
    </time>
  );
}
