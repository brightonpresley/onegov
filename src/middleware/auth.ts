import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { institutions, users } from '../db/schema.ts';
import { getOrCreateUser } from '../db/users.ts';
import type { UserRole } from '../lib/onegovRules.ts';

const DEMO_SIGNING_SECRET =
  process.env.DEMO_SESSION_SECRET || 'onegov-zambia-demo-sandbox-hmac-key-2026';

export interface ActorContext {
  uid: string;
  dbUserId: number;
  email: string;
  fullName: string;
  role: UserRole;
  institutionId: number | null;
  institutionCode: string | null;
  isDemo: boolean;
}

export interface AuthRequest extends Request {
  actor?: ActorContext;
}

interface DemoTokenPayload {
  uid: string;
  role: UserRole;
  exp: number;
}

export function signDemoToken(uid: string, role: UserRole): string {
  const payload: DemoTokenPayload = {
    uid,
    role,
    exp: Date.now() + 1000 * 60 * 60 * 24,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', DEMO_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  return `demo.${encoded}.${sig}`;
}

export function verifyDemoToken(token: string): DemoTokenPayload | null {
  if (!token.startsWith('demo.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', DEMO_SIGNING_SECRET)
    .update(encoded)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as DemoTokenPayload;
    if (!parsed.uid || !parsed.role || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  // 1. Check clearly-scoped Demo Sandbox token first if prefixed with demo.
  if (token.startsWith('demo.')) {
    const demoPayload = verifyDemoToken(token);
    if (!demoPayload) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired demo token' });
    }
    try {
      const userRows = await db
        .select()
        .from(users)
        .where(eq(users.uid, demoPayload.uid))
        .limit(1);
      const user = userRows[0];
      if (!user || !user.isDemo) {
        return res.status(401).json({ error: 'Unauthorized: Demo account not found' });
      }
      let institutionCode: string | null = null;
      if (user.institutionId) {
        const instRows = await db
          .select({ code: institutions.code })
          .from(institutions)
          .where(eq(institutions.id, user.institutionId))
          .limit(1);
        institutionCode = instRows[0]?.code ?? null;
      }
      req.actor = {
        uid: user.uid,
        dbUserId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: (user.role as UserRole) || demoPayload.role,
        institutionId: user.institutionId ?? null,
        institutionCode,
        isDemo: true,
      };
      return next();
    } catch (error) {
      console.error('Demo auth lookup error:', error);
      return res.status(500).json({ error: 'Authentication verification failed.' });
    }
  }

  // 2. Verify real Firebase ID token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const dbUser = await getOrCreateUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@onegov.zm`,
      decoded.name || decoded.email?.split('@')[0] || 'Citizen User',
      'citizen',
      false,
    );
    let institutionCode: string | null = null;
    if (dbUser.institutionId) {
      const instRows = await db
        .select({ code: institutions.code })
        .from(institutions)
        .where(eq(institutions.id, dbUser.institutionId))
        .limit(1);
      institutionCode = instRows[0]?.code ?? null;
    }
    req.actor = {
      uid: dbUser.uid,
      dbUserId: dbUser.id,
      email: dbUser.email,
      fullName: dbUser.fullName,
      role: (dbUser.role as UserRole) || 'citizen',
      institutionId: dbUser.institutionId ?? null,
      institutionCode,
      isDemo: dbUser.isDemo,
    };
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid Firebase ID token' });
  }
};
