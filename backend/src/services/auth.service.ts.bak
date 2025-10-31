import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getRedisClient } from '../db/redis';
import { db } from '../db/prisma';

const VERIFICATION_CODE_PREFIX = 'verification_code:';
const VERIFICATION_CODE_TTL = 600;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_change_in_production';
const SESSION_DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS || '30');

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function storeVerificationCode(phoneNumber: string, code: string): Promise<void> {
  const redis = await getRedisClient();
  const key = `${VERIFICATION_CODE_PREFIX}${phoneNumber}`;
  await redis.setEx(key, VERIFICATION_CODE_TTL, code);
}

export async function requestVerificationCode(
  phoneNumber: string,
  workspaceId: string
): Promise<string> {
  const code = generateVerificationCode();
  await storeVerificationCode(phoneNumber, code);
  
  await db.user.upsert({
    where: { phoneNumber },
    update: { 
      lastActive: new Date(),
      workspaceId 
    },
    create: {
      phoneNumber,
      workspaceId,
    },
  });

  return code;
}

export async function verifyCode(phoneNumber: string, code: string): Promise<boolean> {
  const redis = await getRedisClient();
  const key = `${VERIFICATION_CODE_PREFIX}${phoneNumber}`;
  const storedCode = await redis.get(key);
  
  if (!storedCode || storedCode !== code) {
    return false;
  }
  
  await redis.del(key);
  return true;
}

export function generateJWTToken(userId: string, phoneNumber: string): string {
  return jwt.sign(
    { 
      userId, 
      phoneNumber,
      type: 'session'
    },
    JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_DAYS}d` }
  );
}

export async function createSession(userId: string, token: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
  
  const session = await db.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });
  
  await db.user.update({
    where: { id: userId },
    data: { lastActive: new Date() },
  });
  
  return session;
}

export async function verifyCodeAndCreateSession(
  phoneNumber: string,
  code: string
): Promise<{ token: string; userId: string; expiresAt: Date } | null> {
  const isValid = await verifyCode(phoneNumber, code);
  if (!isValid) {
    return null;
  }
  
  const user = await db.user.findUnique({
    where: { phoneNumber },
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const token = generateJWTToken(user.id, user.phoneNumber);
  const session = await createSession(user.id, token);
  
  return {
    token: session.token,
    userId: user.id,
    expiresAt: session.expiresAt,
  };
}

export async function validateSession(token: string): Promise<{ valid: boolean; userId?: string; phoneNumber?: string }> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; phoneNumber: string; type: string };
    
    if (decoded.type !== 'session') {
      return { valid: false };
    }
    
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    
    if (!session) {
      return { valid: false };
    }
    
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { id: session.id } });
      return { valid: false };
    }
    
    await db.user.update({
      where: { id: session.userId },
      data: { lastActive: new Date() },
    });
    
    return {
      valid: true,
      userId: decoded.userId,
      phoneNumber: decoded.phoneNumber,
    };
  } catch (error) {
    return { valid: false };
  }
}

export async function revokeSession(token: string): Promise<boolean> {
  try {
    const session = await db.session.findUnique({
      where: { token },
    });
    
    if (!session) {
      return false;
    }
    
    await db.session.delete({
      where: { id: session.id },
    });
    
    return true;
  } catch (error) {
    console.error('Error revoking session:', error);
    return false;
  }
}

export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await db.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
    
    return result.count;
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return 0;
  }
}
