const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Admin@123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@devboarding.com' },
    update: {},
    create: {
      name: 'Admin',
      email: 'admin@devboarding.com',
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Seed complete: admin@devboarding.com / Admin@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
