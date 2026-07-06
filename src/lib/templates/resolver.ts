// Template lookup: finds the right Template row for a given
// (categoryId, channel, kind) triple, with a graceful fallback chain:
//   1. exact match (categoryId, channel, kind)
//   2. category default (categoryId, channel=null, kind)
//   3. null (no template → caller decides fallback)
//
// One DB call per resolve. Cheap enough to run per outbox item.

import type { Channel, TemplateKind } from "@prisma/client";
import { db } from "@/lib/db";

export async function findTemplate(opts: {
  categoryId: string | null;
  channel: Channel;
  kind: TemplateKind;
}): Promise<string | null> {
  if (!opts.categoryId) return null;

  // channelSpecific takes precedence over the null default.
  const rows = await db.template.findMany({
    where: {
      categoryId: opts.categoryId,
      kind: opts.kind,
      OR: [{ channel: opts.channel }, { channel: null }],
    },
  });

  const specific = rows.find((r) => r.channel === opts.channel);
  if (specific) return specific.body;
  const fallback = rows.find((r) => r.channel === null);
  return fallback?.body ?? null;
}
