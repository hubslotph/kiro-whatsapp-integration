import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Generate a JWT-like token for testing
 */
function generateTestToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Seed database with test data for development
 */
async function main() {
  console.log('Starting database seed...');

  // Clean existing data in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Cleaning existing data...');
    await prisma.auditLog.deleteMany();
    await prisma.session.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.user.deleteMany();
  }

  // Create test users
  console.log('Creating test users...');
  
  const user1 = await prisma.user.create({
    data: {
      phoneNumber: '+1234567890',
      workspaceId: 'workspace-test-001',
      lastActive: new Date(),
    },
  });

  const user2 = await prisma.user.create({
    data: {
      phoneNumber: '+0987654321',
      workspaceId: 'workspace-test-002',
      lastActive: new Date(),
    },
  });

  console.log(`Created users: ${user1.id}, ${user2.id}`);

  // Create sessions for users
  console.log('Creating test sessions...');
  
  const session1 = await prisma.session.create({
    data: {
      userId: user1.id,
      token: generateTestToken(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  const session2 = await prisma.session.create({
    data: {
      userId: user2.id,
      token: generateTestToken(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  console.log(`Created sessions: ${session1.id}, ${session2.id}`);

  // Create settings for users
  console.log('Creating user settings...');
  
  await prisma.settings.create({
    data: {
      userId: user1.id,
      notificationEnabled: true,
      notificationTypes: ['BUILD_COMPLETE', 'ERROR', 'GIT_OPERATION'],
      accessibleDirectories: ['/src', '/tests', '/docs'],
      readOnlyMode: true,
    },
  });

  await prisma.settings.create({
    data: {
      userId: user2.id,
      notificationEnabled: true,
      notificationTypes: ['ERROR'],
      accessibleDirectories: ['/src'],
      readOnlyMode: true,
    },
  });

  console.log('Created settings for users');

  // Create sample audit logs
  console.log('Creating sample audit logs...');
  
  await prisma.auditLog.createMany({
    data: [
      {
        userId: user1.id,
        commandType: 'FILE_READ',
        commandPayload: { path: '/src/index.ts' },
        status: 'success',
      },
      {
        userId: user1.id,
        commandType: 'FILE_LIST',
        commandPayload: { directory: '/src' },
        status: 'success',
      },
      {
        userId: user1.id,
        commandType: 'SEARCH',
        commandPayload: { query: 'function', pattern: 'regex' },
        status: 'success',
      },
      {
        userId: user2.id,
        commandType: 'FILE_READ',
        commandPayload: { path: '/src/nonexistent.ts' },
        status: 'error',
        errorMessage: 'File not found',
      },
      {
        userId: user2.id,
        commandType: 'STATUS',
        commandPayload: {},
        status: 'success',
      },
    ],
  });

  console.log('Created sample audit logs');

  console.log('Database seed completed successfully!');
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
