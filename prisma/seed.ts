import "dotenv/config";
import { PrismaClient, Channel, TemplateKind } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ─────────────────────────────────────────────────────────────
// Seed data — idempotent; safe to re-run on every deploy.
// ─────────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: Array<{
  name: string;
  position: number;
  titleTemplate: string;
  descriptionTemplate: string;
  skuTemplate: string;
}> = [
  {
    name: "Sports Cards",
    position: 0,
    titleTemplate:
      "{Year} {Manufacturer} {Set} {Player} #{CardNumber} {Parallel} {Grader} {Grade}",
    descriptionTemplate:
      "<p>You are purchasing a {Year} {Manufacturer} {Set} {Player} #{CardNumber} {Parallel} {Grader} {Grade}.</p>" +
      "<p>You will receive the exact item in the photographs. Thank you for looking.</p>" +
      "<ul>" +
      "<li>Player - {Player}</li>" +
      "<li>Card Number - {CardNumber}</li>" +
      "<li>Set - {Set}</li>" +
      "<li>Grader - {Grader}</li>" +
      "<li>Grade - {Grade}</li>" +
      "<li>Certification Number - {CertificationNumber}</li>" +
      "<li>Grade Population - {Population}</li>" +
      "<li>Sport - {Sport}</li>" +
      "<li>League - {League}</li>" +
      "<li>Team - {Team}</li>" +
      "</ul>",
    skuTemplate: "{CertificationNumber}",
  },
  {
    name: "TCG/CCG",
    position: 1,
    titleTemplate:
      "{Year} {Game} {Set} {Player} #{CardNumber} {Rarity} {Grader} {Grade}",
    descriptionTemplate:
      "<p>You are purchasing a {Year} {Game} {Set} #{CardNumber} {Rarity} {Grader} {Grade}.</p>" +
      "<p>You will receive the exact item in the photographs. Thank you for looking.</p>" +
      "<ul>" +
      "<li>Game - {Game}</li>" +
      "<li>Set - {Set}</li>" +
      "<li>Card Number - {CardNumber}</li>" +
      "<li>Rarity - {Rarity}</li>" +
      "<li>Grader - {Grader}</li>" +
      "<li>Grade - {Grade}</li>" +
      "<li>TCGplayer ID - {TCGplayerID}</li>" +
      "</ul>",
    skuTemplate: "{CertificationNumber}",
  },
  {
    name: "Sealed Boxes",
    position: 2,
    titleTemplate: "{Year} {Manufacturer} {Set} {Parallel} Sealed Box",
    descriptionTemplate:
      "<p>Factory sealed {Year} {Manufacturer} {Set} {Parallel} box.</p>" +
      "<p>You will receive the exact item in the photographs. Thank you for looking.</p>",
    skuTemplate: "",
  },
  {
    name: "Comics",
    position: 3,
    titleTemplate: "{Year} {Manufacturer} {Set} #{CardNumber} {Grader} {Grade}",
    descriptionTemplate:
      "<p>{Year} {Manufacturer} {Set} #{CardNumber} {Grader} {Grade}.</p>" +
      "<p>You will receive the exact item in the photographs. Thank you for looking.</p>",
    skuTemplate: "{CertificationNumber}",
  },
  {
    name: "Non-Sports Cards",
    position: 4,
    titleTemplate:
      "{Year} {Manufacturer} {Set} {Player} #{CardNumber} {Grader} {Grade}",
    descriptionTemplate:
      "<p>You are purchasing a {Year} {Manufacturer} {Set} {Player} #{CardNumber} {Grader} {Grade}.</p>" +
      "<p>You will receive the exact item in the photographs. Thank you for looking.</p>",
    skuTemplate: "{CertificationNumber}",
  },
  {
    name: "Legacy",
    position: 99,
    titleTemplate: "{Title}",
    descriptionTemplate: "{DescriptionHtml}",
    skuTemplate: "",
  },
];

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@inventory-ags.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme";
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin user already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, role: "ADMIN" },
  });

  console.log(`✓ Created admin user: ${user.email} (id: ${user.id})`);
  console.log(`  Password: ${password}`);
  console.log(`  ⚠  Change this password on first login.`);
}

async function seedCategoriesAndTemplates() {
  for (const cat of DEFAULT_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { name: cat.name },
      create: { name: cat.name, position: cat.position },
      update: {},
    });

    // Default templates: channel=null applies to any channel unless overridden.
    for (const [kind, body] of [
      [TemplateKind.TITLE, cat.titleTemplate],
      [TemplateKind.DESCRIPTION, cat.descriptionTemplate],
      [TemplateKind.SKU, cat.skuTemplate],
    ] as const) {
      const existing = await prisma.template.findFirst({
        where: { categoryId: category.id, channel: null, kind },
      });
      if (!existing) {
        await prisma.template.create({
          data: { categoryId: category.id, channel: null, kind, body },
        });
      }
    }

    console.log(`✓ Category: ${category.name}`);
  }
}

async function seedDefaultPricingProfile() {
  const existing = await prisma.pricingProfile.findFirst({
    where: { isDefault: true },
  });
  const profile =
    existing ??
    (await prisma.pricingProfile.create({
      data: {
        name: "Default",
        isDefault: true,
        minOfferEnabled: false,
        minOfferPercent: -15,
      },
    }));

  // Ensure a 0% rule exists for every Channel enum value.
  for (const channel of Object.values(Channel)) {
    const rule = await prisma.pricingProfileRule.findUnique({
      where: {
        profileId_channel: { profileId: profile.id, channel },
      },
    });
    if (!rule) {
      await prisma.pricingProfileRule.create({
        data: { profileId: profile.id, channel, priceAdjustPercent: 0 },
      });
    }
  }

  console.log(`✓ Default pricing profile: ${profile.name}`);
  return profile;
}

async function backfillExistingCards(defaultProfileId: string) {
  const legacy = await prisma.category.findUniqueOrThrow({
    where: { name: "Legacy" },
  });

  // Map existing productType strings → category id, falling back to Legacy.
  const nameToId = Object.fromEntries(
    (await prisma.category.findMany()).map((c) => [c.name.toLowerCase(), c.id]),
  );

  const uncategorized = await prisma.card.findMany({
    where: { categoryId: null, deletedAt: null },
    select: { id: true, productType: true },
  });

  for (const card of uncategorized) {
    const key = (card.productType ?? "").toLowerCase().trim();
    const matched = nameToId[key];
    await prisma.card.update({
      where: { id: card.id },
      data: { categoryId: matched ?? legacy.id },
    });
  }
  if (uncategorized.length > 0) {
    console.log(
      `✓ Backfilled ${uncategorized.length} card(s) with categoryId`,
    );
  }

  // Assign default pricing profile to any card that doesn't have one.
  const noProfile = await prisma.card.updateMany({
    where: { pricingProfileId: null, deletedAt: null },
    data: { pricingProfileId: defaultProfileId },
  });
  if (noProfile.count > 0) {
    console.log(`✓ Backfilled ${noProfile.count} card(s) with default pricing profile`);
  }
}

async function main() {
  await seedAdmin();
  await seedCategoriesAndTemplates();
  const profile = await seedDefaultPricingProfile();
  await backfillExistingCards(profile.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
