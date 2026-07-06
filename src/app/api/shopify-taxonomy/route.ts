// Proxy for Shopify's Standard Product Taxonomy queries.
// Runs server-side so the access token stays out of the client bundle.
//
// GET /api/shopify-taxonomy?q=trading+cards  → search categories
// GET /api/shopify-taxonomy?id=gid://...     → resolve a single category by GID
//
// Admin-only. Requires a Shopify connection to exist.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { ShopifyClient } from "@/lib/channels/shopify/client";

interface TaxonomyCategory {
  id: string;
  name: string;
  fullName: string;
  level: number;
  isLeaf: boolean;
}

const SEARCH_QUERY = /* GraphQL */ `
  query TaxonomySearch($q: String) {
    taxonomy {
      categories(first: 15, search: $q) {
        nodes {
          id
          name
          fullName
          level
          isLeaf
        }
      }
    }
  }
`;

const BY_ID_QUERY = /* GraphQL */ `
  query TaxonomyById($id: ID!) {
    node(id: $id) {
      ... on TaxonomyCategory {
        id
        name
        fullName
        level
        isLeaf
      }
    }
  }
`;

export async function GET(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const id = searchParams.get("id")?.trim();

  const connection = await db.channelConnection.findFirst({
    where: { channel: "SHOPIFY", deletedAt: null },
  });
  if (!connection?.shopDomain) {
    return NextResponse.json(
      { error: "No Shopify connection. Connect one in Settings → Channels." },
      { status: 400 },
    );
  }

  const client = new ShopifyClient(
    connection.shopDomain,
    decryptToken(connection.accessToken),
  );

  try {
    if (id) {
      const data = await client.graphql<{
        node: TaxonomyCategory | null;
      }>(BY_ID_QUERY, { id });
      return NextResponse.json({ result: data.node });
    }
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }
    const data = await client.graphql<{
      taxonomy: { categories: { nodes: TaxonomyCategory[] } };
    }>(SEARCH_QUERY, { q });
    return NextResponse.json({ results: data.taxonomy.categories.nodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[shopify-taxonomy]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
