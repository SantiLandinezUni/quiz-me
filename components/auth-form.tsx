"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login";

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (!data.session) {
        // Only happens if "Confirm email" is still on in Supabase.
        setError(
          "Account created, but no session was returned. Email confirmation must be turned off in Supabase.",
        );
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Wrong email or password. Please try again."
            : error.message,
        );
        setLoading(false);
        return;
      }
    }

    // Full page load so the server (proxy + pages) sees the new session cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/app");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">
        {isSignup ? "Create your account" : "Log in"}
      </h1>
      <p className="mt-1 text-slate-700">
        {isSignup
          ? "Start turning your lecture slides into practice quizzes."
          : "Welcome back. Your study sets are waiting."}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <div>
          <label
            htmlFor={`${mode}-email`}
            className="block text-sm font-medium text-slate-800"
          >
            Email
          </label>
          <input
            id={`${mode}-email`}
            data-testid={`${mode}-email`}
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 px-3 text-base"
          />
        </div>
        <div>
          <label
            htmlFor={`${mode}-password`}
            className="block text-sm font-medium text-slate-800"
          >
            Password
          </label>
          <input
            id={`${mode}-password`}
            data-testid={`${mode}-password`}
            type="password"
            name="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={isSignup ? "password-hint" : undefined}
            className="mt-1 block min-h-11 w-full rounded-lg border border-slate-400 px-3 text-base"
          />
          {isSignup && (
            <p id="password-hint" className="mt-1 text-sm text-slate-600">
              At least 6 characters.
            </p>
          )}
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
          data-testid={`${mode}-submit`}
          disabled={loading}
          className="min-h-11 w-full rounded-lg bg-indigo-700 px-4 font-semibold text-white hover:bg-indigo-800 disabled:opacity-60"
        >
          {loading
            ? isSignup
              ? "Creating account…"
              : "Logging in…"
            : isSignup
              ? "Sign up"
              : "Log in"}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-700">
        {isSignup ? "Already have an account? " : "New to QuizMe? "}
        <Link
          href={isSignup ? "/login" : "/signup"}
          className="font-medium text-indigo-700 underline underline-offset-2"
        >
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
