import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex">
      <nav className="w-56 bg-gray-900 text-gray-100 p-4 flex flex-col">
        <h2 className="text-lg font-semibold mb-6">inventory-ags</h2>
        <div className="space-y-1 flex-1">
          <Link
            href="/"
            className="block py-2 px-3 rounded hover:bg-gray-800 text-sm"
          >
            Dashboard
          </Link>
          <Link
            href="/cards"
            className="block py-2 px-3 rounded hover:bg-gray-800 text-sm"
          >
            Cards
          </Link>
          <Link
            href="/sync"
            className="block py-2 px-3 rounded hover:bg-gray-800 text-sm"
          >
            Sync
          </Link>
          {isAdmin && (
            <>
              <div className="border-t border-gray-700 mt-4 pt-4 text-xs uppercase tracking-wider text-gray-500 px-3">
                Admin
              </div>
              <Link
                href="/settings/users"
                className="block py-2 px-3 rounded hover:bg-gray-800 text-sm"
              >
                Users
              </Link>
              <Link
                href="/settings/channels"
                className="block py-2 px-3 rounded hover:bg-gray-800 text-sm"
              >
                Channels
              </Link>
            </>
          )}
        </div>
        <div className="border-t border-gray-700 pt-4 mt-4 text-sm">
          <div className="text-xs text-gray-500 px-3 mb-1">
            {session.user.email}
          </div>
          <div className="text-xs text-gray-400 px-3 mb-2">
            {session.user.role}
          </div>
          <form action={handleSignOut}>
            <button
              type="submit"
              className="block w-full text-left py-2 px-3 rounded hover:bg-gray-800"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <main className="flex-1 bg-gray-50 p-8">{children}</main>
    </div>
  );
}
