import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Tags,
  FileCode2,
  Pencil,
  Plus,
  CheckCircle2,
  CircleDashed,
} from "lucide-react";
import CategoryForm from "./category-form";
import RemoveCategoryButton from "./remove-category-button";
import { Badge, PageHeader, SectionCard } from "@/lib/ui";

export default async function CategoriesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const categories = await db.category.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { cards: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tags}
        title="Categories"
        subtitle="Managed product types with Shopify taxonomy mappings and templates."
      />

      <SectionCard padding="p-0">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Tags className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Category list</h2>
          <span className="text-xs text-gray-500 ml-auto">
            {categories.length} total
          </span>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="p-3 pl-6">Name</th>
              <th className="p-3">Shopify Category</th>
              <th className="p-3">Cards</th>
              <th className="p-3 pr-6"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition">
                <td className="p-3 pl-6">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-semibold">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {c.name}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  {c.shopifyCategoryId ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      mapped
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <CircleDashed className="w-3.5 h-3.5" />
                      unmapped
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant={c._count.cards > 0 ? "info" : "neutral"}>
                    {c._count.cards}
                  </Badge>
                </td>
                <td className="p-3 pr-6 text-right">
                  <div className="inline-flex items-center gap-3">
                    <Link
                      href={`/settings/categories/${c.id}/templates`}
                      className="group inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium transition"
                    >
                      <FileCode2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                      Templates
                    </Link>
                    <Link
                      href={`/settings/categories/${c.id}`}
                      className="group inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium transition"
                    >
                      <Pencil className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
                      Edit
                    </Link>
                    <RemoveCategoryButton
                      categoryId={c.id}
                      categoryName={c.name}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center gap-2 mb-4">
          <Plus className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Add category</h2>
        </div>
        <CategoryForm />
      </SectionCard>
    </div>
  );
}
