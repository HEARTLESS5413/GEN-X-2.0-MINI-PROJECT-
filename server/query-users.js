const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      passwordHash: true,
      createdAt: true,
    }
  });

  console.log('\n=== REGISTERED USERS ===\n');
  users.forEach((u, i) => {
    console.log(`${i + 1}. ${u.name} (@${u.username})`);
    console.log(`   ID:       ${u.id}`);
    console.log(`   Email:    ${u.email}`);
    console.log(`   Password: ${u.passwordHash}`);
    console.log(`   Joined:   ${u.createdAt}`);
    console.log('');
  });
  console.log(`Total users: ${users.length}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
