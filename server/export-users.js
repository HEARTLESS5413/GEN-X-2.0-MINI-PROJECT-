const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

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

  let output = '# Registered Users (' + users.length + ' Total)\n\n';
  output += '| Username | Name | Email | Password Hash | ID | Joined Date |\n';
  output += '|---|---|---|---|---|---|\n';
  
  users.forEach((u) => {
    output += `| @${u.username} | ${u.name} | ${u.email} | \`${u.passwordHash.substring(0, 15)}...\` | \`${u.id}\` | ${new Date(u.createdAt).toLocaleString()} |\n`;
  });

  // Save as an artifact
  const dest = 'C:\\Users\\abhij\\.gemini\\antigravity\\brain\\23302716-b265-42f6-8e78-75382719974d\\user_database_export.md';
  fs.writeFileSync(dest, output, 'utf8');
  console.log(`Successfully exported ${users.length} users to ${dest}`);
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); prisma.$disconnect(); });
