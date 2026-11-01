"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function GoogleSignInButton({
  error,
  callbackPath = "/auth/callback",
  buttonLabel = "Continue with Google",
}: {
  error?: string;
  callbackPath?: string;
  buttonLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function signInWithGoogle() {
    setPending(true);
    setErrorMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}${callbackPath}`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in could not be started. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signInWithGoogle}
        disabled={pending}
        className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-5 py-4 text-sm font-bold text-[#111] shadow-[0_14px_50px_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5 hover:bg-white/90 hover:shadow-[0_18px_60px_rgba(255,255,255,0.17)] active:translate-y-0 disabled:cursor-wait disabled:opacity-70"
      >
        {pending ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3A12 12 0 1 1 32 15.1l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5Z"
            />
            <path
              fill="#FF3D00"
              d="m6.3 14.8 6.6 4.8A12 12 0 0 1 32 15.1l5.7-5.7A20 20 0 0 0 6.3 14.8Z"
            />
            <path
              fill="#4CAF50"
              d="M24 44a20 20 0 0 0 13.4-5.1l-6.2-5.2A12 12 0 0 1 12.9 28l-6.5 5A20 20 0 0 0 24 44Z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.7l6.2 5.2A20 20 0 0 0 44 24c0-1.2-.1-2.4-.4-3.5Z"
            />
          </svg>
        )}
        {pending ? "Connecting to Google..." : buttonLabel}
      </button>
      {error === "not-admin" ? (
        <p role="alert" className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100/80">
          This Google account is not on the Nexus Suppliers administrator list. Sign in
          with dirksfj@gmail.com or dirksfinn43@gmail.com.
        </p>
      ) : null}
      {error === "oauth" ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm text-red-100/80">
          Google sign-in could not be completed. Check that the app URL is on
          the Supabase redirect allow list and try again from the same browser
          address you started with.
        </p>
      ) : null}
      {errorMessage ? (
        <p role="alert" className="mt-4 rounded-xl border border-red-300/15 bg-red-300/[0.06] px-4 py-3 text-sm text-red-100/80">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
