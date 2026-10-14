"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Shown on every page. When a user is logged in it shows the logout button,
// so data-testid="logout" exists exactly once on every logged-in page.
export function SiteHeader() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    await createClient().auth.signOut();
    // Full reload clears any cached logged-in pages.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link
          href={loggedIn ? "/app" : "/"}
          className="rounded text-lg font-bold text-slate-900"
        >
          Quiz<span className="text-indigo-700">Me</span>
        </Link>

        {loggedIn === true && (
          <nav aria-label="Account" className="flex items-center gap-2">
            <Link
              href="/app"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              My study sets
            </Link>
            <button
              type="button"
              data-testid="logout"
              onClick={handleLogout}
              disabled={loggingOut}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-60"
            >
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}
