import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { removeUser } from "./actions";
import InviteUserForm from "./invite-form";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-gray-600 mt-1">
          Manage who can log in and what they can do.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Name
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Email
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Role
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 text-sm">{u.name || "—"}</td>
                <td className="p-3 text-sm">{u.email}</td>
                <td className="p-3">
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${
                      u.role === "ADMIN"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  {u.id !== session.user.id && (
                    <form action={removeUser.bind(null, u.id)}>
                      <button
                        type="submit"
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <InviteUserForm />
    </div>
  );
}
