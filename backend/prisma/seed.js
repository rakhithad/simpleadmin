const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // 1. Check if admin already exists to avoid duplicates
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@company.com' }
  });

  if (existingUser) {
    console.log('✅ Admin user already exists.');
    return;
  }

  // 2. Hash the password (NEVER store plain text)
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 3. Create the Super Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@company.com',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      team: 'IT',
      title: 'MR'
    },
  });

  console.log(`✅ Created Super Admin: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });