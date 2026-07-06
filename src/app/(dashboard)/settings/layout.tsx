import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Admin-only guard. Individual sub-pages render their own PageHeader so each
// section (Channels, Categories, Pricing, Users) reads clearly on its own.
export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");
  return <>{children}</>;
}
