import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import CategoryForm from "../category-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: Props) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const { id } = await params;
  const category = await db.category.findUnique({ where: { id } });
  if (!category || category.deletedAt) notFound();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link
          href="/settings/categories"
          className="text-sm text-gray-600 hover:underline"
        >
          ← Back to categories
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit category</h1>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <CategoryForm category={category} />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-1">Templates</h2>
        <p className="text-sm text-gray-500 mb-3">
          Title, description and SKU templates for cards in this category.
        </p>
        <Link
          href={`/settings/categories/${category.id}/templates`}
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
        >
          Edit templates
        </Link>
      </div>
    </div>
  );
}
