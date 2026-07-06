import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import Sidebar from "./sidebar";

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

  const signOutSlot = (
    <form action={handleSignOut}>
      <button
        type="submit"
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-all"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </form>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar
        user={{
          email: session.user.email ?? "",
          name: session.user.name,
          role: session.user.role,
        }}
        isAdmin={isAdmin}
        signOutSlot={signOutSlot}
      />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-8">{children}</div>
      </main>
    </div>
  );
}
