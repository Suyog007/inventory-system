import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { UserMinus, Users as UsersIcon } from "lucide-react";
import { removeUser } from "./actions";
import InviteUserForm from "./invite-form";
import { Badge, PageHeader, SectionCard } from "@/lib/ui";

export default async function UsersPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const users = await db.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UsersIcon}
        title="Users"
        subtitle="Who can log in and what they're allowed to do."
      />
      <SectionCard padding="p-0">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <UsersIcon className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Team members</h2>
          <span className="text-xs text-gray-500 ml-auto">
            {users.length} active
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="p-3 pl-6">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3 pr-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="p-3 pl-6 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-semibold text-white">
                    {(u.name || u.email).slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {u.name || "—"}
                  </span>
                </td>
                <td className="p-3 text-sm text-gray-700">{u.email}</td>
                <td className="p-3">
                  <Badge variant={u.role === "ADMIN" ? "info" : "neutral"}>
                    {u.role}
                  </Badge>
                </td>
                <td className="p-3 pr-6 text-right">
                  {u.id !== session.user.id && (
                    <form action={removeUser.bind(null, u.id)}>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700 font-medium transition"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        Remove
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Invite a user">
        <InviteUserForm />
      </SectionCard>
    </div>
  );
}
