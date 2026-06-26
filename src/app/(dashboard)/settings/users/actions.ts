"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { hashPassword } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const inviteSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "STAFF"]),
});

export type InviteResult =
  | { error: string }
  | { success: string }
  | undefined;

export async function inviteUser(
  _prevState: InviteResult,
  formData: FormData,
): Promise<InviteResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "A user with this email already exists." };

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await db.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      passwordHash,
      role: parsed.data.role,
      invitedById: session.user.id,
    },
  });

  revalidatePath("/settings/users");
  return { success: `User ${user.email} created.` };
}

export async function removeUser(userId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return;
  if (userId === session.user.id) return; // can't remove yourself

  await db.user.update({
    where: { id: userId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/users");
}
