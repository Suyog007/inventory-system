"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { inviteUser, type InviteResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
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

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Invite a new user</h2>
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 max-w-md"
      >
        <input
          name="name"
          placeholder="Name"
          required
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full p-2 border border-gray-300 rounded"
        />
        <input
          name="password"
          type="text"
          placeholder="Initial password (min 8 chars)"
          required
          minLength={8}
          className="w-full p-2 border border-gray-300 rounded"
        />
        <select
          name="role"
          required
          defaultValue="STAFF"
          className="w-full p-2 border border-gray-300 rounded bg-white"
        >
          <option value="STAFF">Staff</option>
          <option value="ADMIN">Admin</option>
        </select>
        {result && "error" in result && (
          <p className="text-red-600 text-sm" role="alert">
            {result.error}
          </p>
        )}
        {result && "success" in result && (
          <p className="text-green-600 text-sm" role="status">
            {result.success}
          </p>
        )}
        <SubmitButton />
      </form>
    </div>
  );
}
