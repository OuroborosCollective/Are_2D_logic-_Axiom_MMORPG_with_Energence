/**
 * Audit Log — records every admin action with timestamp, IP, details.
 * Persisted in memory with optional file-based backup.
 */

import log from '@kaetram/common/util/log';

export interface AuditEntry {
    id: number;
    timestamp: number;
    action: string;
    category: AuditCategory;
    details: string;
    ip: string;
    success: boolean;
}

export type AuditCategory =
    | 'auth'
    | 'asset'
    | 'code'
    | 'content'
    | 'spawn'
    | 'config'
    | 'backup'
    | 'rollback'
    | 'world'
    | 'system';

const auditLog: AuditEntry[] = [];
let nextId = 1;
const MAX_ENTRIES = 10_000;

export function logAudit(
    action: string,
    category: AuditCategory,
    details: string,
    ip: string,
    success = true
): AuditEntry {
    const entry: AuditEntry = {
        id: nextId++,
        timestamp: Date.now(),
        action,
        category,
        details,
        ip,
        success
    };

    auditLog.push(entry);
    if (auditLog.length > MAX_ENTRIES) auditLog.shift();

    log.debug(`[Audit] ${category}/${action}: ${details} (${success ? 'OK' : 'FAIL'}) from ${ip}`);

    return entry;
}

export function getAuditLog(
    filter?: { category?: AuditCategory; limit?: number; since?: number }
): AuditEntry[] {
    let entries = auditLog;

    if (filter?.category) entries = entries.filter((e) => e.category === filter.category);
    if (filter?.since) entries = entries.filter((e) => e.timestamp >= filter.since!);

    const limit = filter?.limit || 200;
    return entries.slice(-limit);
}

export function getAuditStats(): {
    total: number;
    byCategory: Record<string, number>;
    last24h: number;
} {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;

    const byCategory: Record<string, number> = {};
    let last24h = 0;

    for (const entry of auditLog) {
        byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
        if (entry.timestamp >= dayAgo) last24h++;
    }

    return { total: auditLog.length, byCategory, last24h };
}
