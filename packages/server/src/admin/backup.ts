/**
 * Backup & Rollback System
 *
 * Creates snapshots of game data (JSON configs, world state)
 * and allows rolling back to previous versions.
 */

import fs from 'node:fs';
import path from 'node:path';

import log from '@kaetram/common/util/log';

export interface BackupEntry {
    id: string;
    timestamp: number;
    description: string;
    files: string[];
    size: number;
}

const BACKUP_DIR = path.resolve(process.cwd(), 'packages/server/data/.backups');
const backupRegistry: BackupEntry[] = [];

function ensureBackupDir(): void {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export function createBackup(description: string, filePaths: string[]): BackupEntry {
    ensureBackupDir();

    const id = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const backupPath = path.join(BACKUP_DIR, id);
    fs.mkdirSync(backupPath, { recursive: true });

    let totalSize = 0;
    const saved: string[] = [];

    for (const fp of filePaths) {
        try {
            if (!fs.existsSync(fp)) continue;
            const content = fs.readFileSync(fp);
            const relative = path.relative(process.cwd(), fp);
            const dest = path.join(backupPath, relative.replace(/[/\\]/g, '__'));
            fs.writeFileSync(dest, content);
            totalSize += content.length;
            saved.push(relative);
        } catch (err) {
            log.error(`[Backup] Failed to backup ${fp}: ${err}`);
        }
    }

    const entry: BackupEntry = {
        id,
        timestamp: Date.now(),
        description,
        files: saved,
        size: totalSize
    };

    backupRegistry.push(entry);
    log.info(`[Backup] Created ${id}: ${saved.length} files, ${(totalSize / 1024).toFixed(1)}KB`);

    return entry;
}

export function listBackups(): BackupEntry[] {
    return [...backupRegistry].reverse();
}

export function rollbackBackup(backupId: string): { success: boolean; restored: string[] } {
    const entry = backupRegistry.find((b) => b.id === backupId);
    if (!entry) return { success: false, restored: [] };

    const backupPath = path.join(BACKUP_DIR, backupId);
    if (!fs.existsSync(backupPath)) return { success: false, restored: [] };

    const restored: string[] = [];

    for (const relative of entry.files) {
        try {
            const backedUpName = relative.replace(/[/\\]/g, '__');
            const src = path.join(backupPath, backedUpName);
            const dest = path.join(process.cwd(), relative);

            if (!fs.existsSync(src)) continue;

            const destDir = path.dirname(dest);
            if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

            fs.copyFileSync(src, dest);
            restored.push(relative);
        } catch (err) {
            log.error(`[Rollback] Failed to restore ${relative}: ${err}`);
        }
    }

    log.info(`[Rollback] Restored ${restored.length} files from ${backupId}`);
    return { success: true, restored };
}
