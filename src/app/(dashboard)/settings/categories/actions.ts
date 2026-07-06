"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  shopifyCategoryId: z.string().optional(),
  position: z.string().optional(),
});

export type CategoryActionResult =
  | { error: string }
  | { success: string }
  | undefined;

export async function createCategory(
  _prev: CategoryActionResult,
  formData: FormData,
): Promise<CategoryActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await db.category.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing && !existing.deletedAt) {
    return { error: "A category with that name already exists." };
  }

  if (existing?.deletedAt) {
    await db.category.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        shopifyCategoryId: parsed.data.shopifyCategoryId?.trim() || null,
        position: parsed.data.position ? Number(parsed.data.position) : 0,
      },
    });
  } else {
    await db.category.create({
      data: {
        name: parsed.data.name,
        shopifyCategoryId: parsed.data.shopifyCategoryId?.trim() || null,
        position: parsed.data.position ? Number(parsed.data.position) : 0,
      },
    });
  }

  revalidatePath("/settings/categories");
  return { success: `Category "${parsed.data.name}" created.` };
}

export async function updateCategory(
  categoryId: string,
  _prev: CategoryActionResult,
  formData: FormData,
): Promise<CategoryActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await db.category.update({
    where: { id: categoryId },
    data: {
      name: parsed.data.name,
      shopifyCategoryId: parsed.data.shopifyCategoryId?.trim() || null,
      position: parsed.data.position ? Number(parsed.data.position) : 0,
    },
  });

  revalidatePath("/settings/categories");
  return { success: `Category updated.` };
}

export async function deleteCategory(categoryId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return;

  await db.category.update({
    where: { id: categoryId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/categories");
}
