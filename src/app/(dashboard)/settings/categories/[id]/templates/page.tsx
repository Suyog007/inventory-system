import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { resolveTokenValues } from "@/lib/templates/render";
import TemplateEditor from "./template-editor";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CategoryTemplatesPage({ params }: Props) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const category = await db.category.findUnique({
    where: { id },
    include: {
      templates: { where: { channel: null } },
      cards: {
        where: { deletedAt: null },
        take: 5,
        include: {
          variants: { where: { deletedAt: null }, take: 1 },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!category || category.deletedAt) notFound();

  const byKind = Object.fromEntries(
    category.templates.map((t) => [t.kind, t.body]),
  );

  const examples = category.cards
    .filter((c) => c.variants.length > 0)
    .map((c) => ({
      id: c.id,
      label: c.title,
      tokens: resolveTokenValues(
        { ...c, category: { name: category.name } },
        c.variants[0],
      ),
    }));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/settings/categories/${category.id}`}
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to category
        </Link>
        <h1 className="text-2xl font-bold mt-2">
          Templates: {category.name}
        </h1>
        <p className="text-gray-600 mt-1">
          These templates run for every channel that doesn&apos;t have its own
          override. Card fields fill in the <code>{"{Token}"}</code>{" "}
          placeholders at push time.
        </p>
      </div>

      <TemplateEditor
        categoryId={category.id}
        defaultTitle={byKind.TITLE ?? ""}
        defaultDescription={byKind.DESCRIPTION ?? ""}
        defaultSku={byKind.SKU ?? ""}
        examples={examples}
      />
    </div>
  );
}
