"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import type { TemplateKind } from "@prisma/client";

const templateSchema = z.object({
  titleTemplate: z.string(),
  descriptionTemplate: z.string(),
  skuTemplate: z.string(),
});

export type TemplateActionResult =
  | { error: string }
  | { success: string }
  | undefined;

async function upsertTemplate(
  categoryId: string,
  kind: TemplateKind,
  body: string,
) {
  const existing = await db.template.findFirst({
    where: { categoryId, channel: null, kind },
  });
  if (existing) {
    await db.template.update({
      where: { id: existing.id },
      data: { body },
    });
  } else {
    await db.template.create({
      data: { categoryId, channel: null, kind, body },
    });
  }
}

export async function saveTemplates(
  categoryId: string,
  _prev: TemplateActionResult,
  formData: FormData,
): Promise<TemplateActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = templateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await upsertTemplate(categoryId, "TITLE", parsed.data.titleTemplate);
  await upsertTemplate(
    categoryId,
    "DESCRIPTION",
    parsed.data.descriptionTemplate,
  );
  await upsertTemplate(categoryId, "SKU", parsed.data.skuTemplate);

  revalidatePath(`/settings/categories/${categoryId}/templates`);
  return { success: "Templates saved." };
}
