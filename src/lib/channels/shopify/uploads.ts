// Upload a file to Shopify's CDN via stagedUploadsCreate + multipart POST.
//
// Flow:
//   1. Call stagedUploadsCreate → Shopify returns a target URL + params + resourceUrl
//   2. POST the file (multipart) to the target URL with the given params
//   3. resourceUrl is now a public, fetchable image hosted by Shopify
//
// The resourceUrl can be displayed in our UI as the image thumbnail AND passed
// to productCreateMedia.originalSource — Shopify will then attach a CDN copy
// to the product when we sync.

import { ShopifyClient } from "./client";
import { STAGED_UPLOADS_CREATE } from "./mutations";

export interface StagedUploadResult {
  resourceUrl: string;
}

export async function stageImageUpload(
  client: ShopifyClient,
  file: { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> },
): Promise<StagedUploadResult> {
  const stageData = await client.graphql<{
    stagedUploadsCreate: {
      stagedTargets: Array<{
        url: string;
        resourceUrl: string;
        parameters: Array<{ name: string; value: string }>;
      }>;
      userErrors: Array<{ field: string[]; message: string }>;
    };
  }>(STAGED_UPLOADS_CREATE, {
    input: [
      {
        filename: file.name,
        mimeType: file.type,
        resource: "IMAGE",
        fileSize: String(file.size),
        httpMethod: "POST",
      },
    ],
  });

  if (stageData.stagedUploadsCreate.userErrors.length) {
    throw new Error(
      `Shopify stagedUploadsCreate: ${JSON.stringify(
        stageData.stagedUploadsCreate.userErrors,
      )}`,
    );
  }

  const target = stageData.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new Error("Shopify stagedUploadsCreate returned no target");
  }

  // Multipart POST to the staged URL. Order matters for some cloud providers
  // (parameters first, then the file), so we append in the order Shopify gave us.
  const form = new FormData();
  for (const p of target.parameters) {
    form.append(p.name, p.value);
  }
  const buffer = await file.arrayBuffer();
  form.append("file", new Blob([buffer], { type: file.type }), file.name);

  const uploadRes = await fetch(target.url, { method: "POST", body: form });
  if (!uploadRes.ok) {
    const text = await uploadRes.text().catch(() => "(no body)");
    throw new Error(
      `Shopify staged upload POST failed (${uploadRes.status}): ${text.slice(0, 500)}`,
    );
  }

  return { resourceUrl: target.resourceUrl };
}
