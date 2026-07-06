import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import CategoryForm from "./category-form";
import { deleteCategory } from "./actions";

export default async function CategoriesPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const categories = await db.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { cards: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-gray-600 mt-1">
          Categories replace free-typed product types. Each carries a Shopify
          category mapping and title/description/SKU templates.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Name
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Shopify Category GID
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Cards
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Position
              </th>
              <th className="text-left p-3 text-sm font-medium text-gray-700">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 text-sm font-medium">{c.name}</td>
                <td className="p-3 text-xs font-mono text-gray-600">
                  {c.shopifyCategoryId ?? "—"}
                </td>
                <td className="p-3 text-sm">{c._count.cards}</td>
                <td className="p-3 text-sm">{c.position}</td>
                <td className="p-3 text-sm">
                  <div className="flex gap-3">
                    <Link
                      href={`/settings/categories/${c.id}/templates`}
                      className="text-blue-600 hover:underline"
                    >
                      Templates
                    </Link>
                    <Link
                      href={`/settings/categories/${c.id}`}
                      className="text-gray-600 hover:underline"
                    >
                      Edit
                    </Link>
                    <form action={deleteCategory.bind(null, c.id)}>
                      <button
                        type="submit"
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-3">Add category</h2>
        <CategoryForm />
      </div>
    </div>
  );
}
