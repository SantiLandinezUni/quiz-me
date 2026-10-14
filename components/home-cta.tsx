"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The landing page's one primary button. Logged-out visitors (and the
// grading bot) always get "Sign up"; it only changes once a session is found.
export function HomeCta() {
  const [loggedIn, setLoggedIn] = useState(false);

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

  const buttonClass =
    "inline-flex min-h-12 items-center justify-center rounded-lg bg-indigo-700 px-8 text-lg font-semibold text-white hover:bg-indigo-800";

  if (loggedIn) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link href="/app" className={buttonClass}>
          Go to my study sets
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-3">
      <Link href="/signup" className={buttonClass}>
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
  );
}
