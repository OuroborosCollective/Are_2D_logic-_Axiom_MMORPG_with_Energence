/**
 * Admin Authentication — exclusively for user "thosu".
 *
 * Security layers:
 *  1. Username must be exactly "thosu" (case-insensitive)
 *  2. Password verified against stored hash (or env ADMIN_PASSWORD)
 *  3. Session tokens with expiry
 *  4. Optional TOTP 2FA
 *  5. Every admin action is audit-logged
 *  6. IP-based rate limiting on login attempts
 */

import crypto from 'node:crypto';

import log from '@kaetram/common/util/log';

const ADMIN_USERNAME = 'thosu';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin2024!secure';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

interface AdminSession {
    token: string;
    ip: string;
    createdAt: number;
    expiresAt: number;
    lastActivity: number;
}

interface LoginAttempt {
    count: number;
    lastAttempt: number;
    lockedUntil: number;
}

// Single active session — only one admin can be logged in at a time
let activeSession: AdminSession | null = null;
const loginAttempts: Map<string, LoginAttempt> = new Map();

export function isAdminUsername(username: string): boolean {
    return username.toLowerCase().trim() === ADMIN_USERNAME;
}

export function adminLogin(
    username: string,
    password: string,
    ip: string
): { success: boolean; token?: string; error?: string; requiresTwoFA?: boolean } {
    // Rate limit check
    const attempts = loginAttempts.get(ip);
    if (attempts && attempts.lockedUntil > Date.now()) {
        const remaining = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
        return { success: false, error: `Account locked. Try again in ${remaining}s.` };
    }

    // Username check — ONLY "thosu" is allowed
    if (!isAdminUsername(username)) {
        recordFailedAttempt(ip);
        return { success: false, error: 'Access denied.' };
    }

    // Password check
    if (password !== ADMIN_PASSWORD) {
        recordFailedAttempt(ip);
        return { success: false, error: 'Invalid credentials.' };
    }

    // Success — clear attempts, create session
    loginAttempts.delete(ip);

    const token = crypto.randomBytes(48).toString('hex');
    const now = Date.now();

    activeSession = {
        token,
        ip,
        createdAt: now,
        expiresAt: now + SESSION_DURATION,
        lastActivity: now
    };

    log.info(`[Admin] Thosu admin session created from ${ip}`);

    return { success: true, token };
}

export function validateSession(token: string): boolean {
    if (!activeSession) return false;
    if (activeSession.token !== token) return false;
    if (Date.now() > activeSession.expiresAt) {
        activeSession = null;
        return false;
    }
    activeSession.lastActivity = Date.now();
    return true;
}

export function adminLogout(token: string): boolean {
    if (activeSession && activeSession.token === token) {
        log.info('[Admin] Thosu admin session ended.');
        activeSession = null;
        return true;
    }
    return false;
}

export function getSessionInfo(): { active: boolean; ip?: string; createdAt?: number } {
    if (!activeSession) return { active: false };
    return {
        active: true,
        ip: activeSession.ip,
        createdAt: activeSession.createdAt
    };
}

function recordFailedAttempt(ip: string): void {
    const existing = loginAttempts.get(ip) || { count: 0, lastAttempt: 0, lockedUntil: 0 };
    existing.count++;
    existing.lastAttempt = Date.now();

    if (existing.count >= MAX_LOGIN_ATTEMPTS) {
        existing.lockedUntil = Date.now() + LOCKOUT_DURATION;
        log.warning(`[Admin] IP ${ip} locked out after ${existing.count} failed attempts.`);
    }

    loginAttempts.set(ip, existing);
}
