"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { authenticate, signInWithGoogle } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Signing in..." : "Sign in"}
    </button>
  );
}

function GoogleButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 py-2 rounded font-medium border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285f4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"
          fill="#34a853"
        />
        <path
          d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.11V7.05H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.95l3.66-2.84z"
          fill="#fbbc05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
          fill="#ea4335"
        />
      </svg>
      {pending ? "Redirecting..." : "Sign in with Google"}
    </button>
  );
}

export default function LoginPage() {
  const [errorMessage, formAction] = useActionState(authenticate, undefined);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow w-full max-w-md space-y-4">
        <div>
          <h1 className="text-2xl font-bold">inventory-ags</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to continue</p>
        </div>

        <form action={signInWithGoogle}>
          <GoogleButton />
        </form>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />
          OR
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <form action={formAction} className="space-y-4">
          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            autoComplete="email"
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            autoComplete="current-password"
            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {errorMessage && (
            <p className="text-red-600 text-sm" role="alert">
              {errorMessage}
            </p>
          )}
          <SubmitButton />
        </form>

        <p className="text-xs text-gray-500 text-center pt-2">
          Google sign-in only works if your email has been invited by an admin.
        </p>
      </div>
    </div>
  );
}
