"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus } from "lucide-react";
import { inviteUser, type InviteResult } from "./actions";
import { Alert, buttonClass } from "@/lib/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass("primary")}
    >
      <UserPlus className="w-4 h-4" />
      {pending ? "Inviting..." : "Invite user"}
    </button>
  );
}

export default function InviteUserForm() {
  const [result, formAction] = useActionState<InviteResult, FormData>(
    inviteUser,
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (result && "success" in result) {
      formRef.current?.reset();
    }
  }, [result]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

  return (
    <form ref={formRef} action={formAction} className="space-y-3 max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
            Name
          </span>
          <input name="name" placeholder="Jane Doe" required className={inputClass} />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
            Role
          </span>
          <select name="role" required defaultValue="STAFF" className={inputClass}>
            <option value="STAFF">Staff</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
      </div>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
          Email
        </span>
        <input
          name="email"
          type="email"
          placeholder="jane@example.com"
          required
          className={inputClass}
        />
      </label>
      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
          Initial password
        </span>
        <input
          name="password"
          type="text"
          placeholder="At least 8 characters"
          required
          minLength={8}
          className={inputClass}
        />
      </label>
      {result && "error" in result && <Alert variant="error">{result.error}</Alert>}
      {result && "success" in result && (
        <Alert variant="success">{result.success}</Alert>
      )}
      <SubmitButton />
    </form>
  );
}
