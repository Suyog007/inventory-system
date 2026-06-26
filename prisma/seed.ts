import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@inventory-ags.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "changeme";
  const name = process.env.SEED_ADMIN_NAME || "Admin";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user already exists: ${email}`);
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

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
