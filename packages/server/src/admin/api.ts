/**
 * Admin API — Express router mounted on the game server.
 *
 * ALL routes require valid admin session token via Authorization header.
 * Only the user "thosu" can obtain a session token.
 *
 * Endpoints:
 *   POST   /admin/login              — authenticate
 *   POST   /admin/logout             — end session
 *   GET    /admin/session             — session status
 *
 *   GET    /admin/dashboard           — overview stats
 *   GET    /admin/performance         — server performance metrics
 *   GET    /admin/errors              — recent error log
 *   GET    /admin/audit               — audit log
 *
 *   GET    /admin/heuristics          — current heuristic state
 *   POST   /admin/heuristics/impulse  — inject heuristic impulse
 *
 *   GET    /admin/nations             — all nations + villages
 *   GET    /admin/social              — social wave state
 *
 *   GET    /admin/data/:type          — read game data file
 *   PUT    /admin/data/:type          — update game data (preview mode)
 *   POST   /admin/data/:type/publish  — publish previewed changes
 *
 *   GET    /admin/files               — list server source files
 *   GET    /admin/files/:path         — read a source file
 *   PUT    /admin/files/:path         — write to a source file (preview)
 *   POST   /admin/files/:path/publish — publish file change
 *
 *   GET    /admin/backups             — list backups
 *   POST   /admin/backups             — create a backup
 *   POST   /admin/backups/:id/rollback— rollback to a backup
 *
 *   GET    /admin/players             — online player list
 *   GET    /admin/npcs                — NPC list + memory
 *   GET    /admin/mobs                — mob data
 *   GET    /admin/items               — item data
 *   GET    /admin/quests              — quest data
 *   GET    /admin/stores              — store data
 *   GET    /admin/world               — world generator state
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { adminLogin, adminLogout, validateSession, getSessionInfo } from './auth';
import { logAudit, getAuditLog, getAuditStats } from './audit';
import { createBackup, listBackups, rollbackBackup } from './backup';
import { HNode } from '../game/arelogic/heuristic.engine';

import log from '@kaetram/common/util/log';

import type World from '../game/world';
import type { Request, Response, NextFunction } from 'express';

const DATA_ROOT = path.resolve(process.cwd(), 'packages/server/data');
const SRC_ROOT = path.resolve(process.cwd(), 'packages/server/src');

// Preview store: staged changes not yet published
const previews: Map<string, string> = new Map();

export default function createAdminRouter(world: World): Router {
    const router = Router();

    // ─── Auth middleware (skip for /login) ────────────────────────
    function requireAuth(req: Request, res: Response, next: NextFunction): void {
        if (req.path === '/login') return next();

        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validateSession(token)) {
            res.status(401).json({ error: 'Unauthorized — admin session required.' });
            return;
        }
        next();
    }

    router.use(requireAuth);

    // ─── AUTH ─────────────────────────────────────────────────────
    router.post('/login', (req: Request, res: Response) => {
        const { username, password } = req.body || {};
        const ip = req.ip || req.socket.remoteAddress || 'unknown';

        const result = adminLogin(username, password, ip);

        logAudit(
            'login',
            'auth',
            `Login attempt by "${username}" — ${result.success ? 'SUCCESS' : result.error}`,
            ip,
            result.success
        );

        if (result.success) {
            res.json({ success: true, token: result.token });
        } else {
            res.status(403).json({ success: false, error: result.error });
        }
    });

    router.post('/logout', (req: Request, res: Response) => {
        const token = req.headers.authorization?.replace('Bearer ', '') || '';
        adminLogout(token);
        logAudit('logout', 'auth', 'Admin logged out', req.ip || 'unknown');
        res.json({ success: true });
    });

    router.get('/session', (_req: Request, res: Response) => {
        res.json(getSessionInfo());
    });

    // ─── DASHBOARD ────────────────────────────────────────────────
    router.get('/dashboard', (_req: Request, res: Response) => {
        const h = world.heuristics;
        res.json({
            server: {
                name: 'Kaetram',
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                population: world.getPopulation(),
                maxPlayers: 200
            },
            heuristics: {
                main: h.main,
                nodes: h.getAll()
            },
            nations: {
                count: world.nationSystem.getAllNations().length,
                villages: world.nationSystem.getAllVillages().length
            },
            social: {
                bonds: world.socialWave.bonds.size,
                parties: world.socialWave.parties.size
            },
            audit: getAuditStats(),
            watchdog: world.watchdog.getLastReport()
        });
    });

    // ─── PERFORMANCE ──────────────────────────────────────────────
    router.get('/performance', (_req: Request, res: Response) => {
        const mem = process.memoryUsage();
        res.json({
            uptime: process.uptime(),
            memory: {
                rss: (mem.rss / 1024 / 1024).toFixed(1) + ' MB',
                heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + ' MB',
                heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + ' MB',
                external: (mem.external / 1024 / 1024).toFixed(1) + ' MB'
            },
            cpu: process.cpuUsage(),
            population: world.getPopulation(),
            entities: {
                players: Object.keys(world.entities.players).length,
                npcMemories: world.npcMemories.size
            }
        });
    });

    // ─── ERROR LOG ────────────────────────────────────────────────
    router.get('/errors', (_req: Request, res: Response) => {
        // Return watchdog reports as error log
        const reports = world.watchdog.getReports().slice(-50);
        res.json({
            reports,
            total: reports.length
        });
    });

    // ─── AUDIT LOG ────────────────────────────────────────────────
    router.get('/audit', (req: Request, res: Response) => {
        const category = req.query.category as string | undefined;
        const limit = parseInt(req.query.limit as string) || 200;
        res.json(getAuditLog({ category: category as any, limit }));
    });

    // ─── HEURISTICS ───────────────────────────────────────────────
    router.get('/heuristics', (_req: Request, res: Response) => {
        res.json({
            nodes: world.heuristics.getAll(),
            main: world.heuristics.main,
            history: world.heuristics.getHistory().slice(-50)
        });
    });

    router.post('/heuristics/impulse', (req: Request, res: Response) => {
        const { node, amount } = req.body || {};
        if (node === undefined || amount === undefined) {
            res.status(400).json({ error: 'node and amount required' });
            return;
        }
        world.heuristics.impulse(node as HNode, parseFloat(amount));
        logAudit('heuristic_impulse', 'world', `Node ${node} impulse ${amount}`, req.ip || 'unknown');
        res.json({ success: true, nodes: world.heuristics.getAll() });
    });

    // ─── NATIONS ──────────────────────────────────────────────────
    router.get('/nations', (_req: Request, res: Response) => {
        res.json({
            nations: world.nationSystem.getAllNations(),
            villages: world.nationSystem.getAllVillages(),
            relations: world.nationSystem.relations
        });
    });

    // ─── SOCIAL ───────────────────────────────────────────────────
    router.get('/social', (_req: Request, res: Response) => {
        res.json({
            bonds: [...world.socialWave.bonds.values()].slice(0, 100),
            parties: [...world.socialWave.parties.values()],
            familyCount: world.socialWave.families.size
        });
    });

    // ─── GAME DATA FILES (npcs.json, mobs.json, items.json, etc.) ─
    router.get('/data/:type', (req: Request, res: Response) => {
        const filePath = resolveDataFile(req.params.type);
        if (!filePath || !fs.existsSync(filePath)) {
            res.status(404).json({ error: 'Data file not found' });
            return;
        }
        try {
            const preview = previews.get(filePath);
            const content = preview || fs.readFileSync(filePath, 'utf-8');
            res.json({
                content: JSON.parse(content),
                hasPreview: !!preview,
                filePath: path.relative(process.cwd(), filePath)
            });
        } catch (err) {
            res.status(500).json({ error: `Failed to read: ${err}` });
        }
    });

    router.put('/data/:type', (req: Request, res: Response) => {
        const filePath = resolveDataFile(req.params.type);
        if (!filePath) {
            res.status(404).json({ error: 'Unknown data type' });
            return;
        }
        try {
            const content = JSON.stringify(req.body.content, null, 4);
            previews.set(filePath, content);
            logAudit('data_preview', 'content', `Staged changes for ${req.params.type}`, req.ip || 'unknown');
            res.json({ success: true, message: 'Changes staged for preview. POST /publish to apply.' });
        } catch (err) {
            res.status(500).json({ error: `Failed to stage: ${err}` });
        }
    });

    router.post('/data/:type/publish', (req: Request, res: Response) => {
        const filePath = resolveDataFile(req.params.type);
        if (!filePath) {
            res.status(404).json({ error: 'Unknown data type' });
            return;
        }
        const staged = previews.get(filePath);
        if (!staged) {
            res.status(400).json({ error: 'No staged changes to publish' });
            return;
        }
        try {
            // Backup before publish
            createBackup(`Pre-publish ${req.params.type}`, [filePath]);

            fs.writeFileSync(filePath, staged, 'utf-8');
            previews.delete(filePath);
            logAudit('data_publish', 'content', `Published changes to ${req.params.type}`, req.ip || 'unknown');
            res.json({ success: true, message: 'Changes published.' });
        } catch (err) {
            res.status(500).json({ error: `Failed to publish: ${err}` });
        }
    });

    // ─── SOURCE FILE MANAGEMENT ───────────────────────────────────
    router.get('/files', (_req: Request, res: Response) => {
        try {
            const files = listFiles(SRC_ROOT, SRC_ROOT);
            res.json({ files, root: 'packages/server/src' });
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    router.get('/files/*', (req: Request, res: Response) => {
        const relativePath = req.params[0];
        const filePath = path.resolve(SRC_ROOT, relativePath);

        // Security: prevent directory traversal
        if (!filePath.startsWith(SRC_ROOT)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: 'File not found' });
            return;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const preview = previews.get(filePath);
            res.json({
                path: relativePath,
                content: preview || content,
                hasPreview: !!preview,
                size: content.length
            });
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    router.put('/files/*', (req: Request, res: Response) => {
        const relativePath = req.params[0];
        const filePath = path.resolve(SRC_ROOT, relativePath);

        if (!filePath.startsWith(SRC_ROOT)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        try {
            previews.set(filePath, req.body.content);
            logAudit('file_preview', 'code', `Staged edits to ${relativePath}`, req.ip || 'unknown');
            res.json({ success: true, message: 'File changes staged.' });
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    router.post('/files/*/publish', (req: Request, res: Response) => {
        const rawPath = req.path.replace('/files/', '').replace('/publish', '');
        const filePath = path.resolve(SRC_ROOT, rawPath);

        if (!filePath.startsWith(SRC_ROOT)) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const staged = previews.get(filePath);
        if (!staged) {
            res.status(400).json({ error: 'No staged changes' });
            return;
        }

        try {
            createBackup(`Pre-publish ${rawPath}`, [filePath]);
            fs.writeFileSync(filePath, staged, 'utf-8');
            previews.delete(filePath);
            logAudit('file_publish', 'code', `Published ${rawPath}`, req.ip || 'unknown');
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── BACKUPS ──────────────────────────────────────────────────
    router.get('/backups', (_req: Request, res: Response) => {
        res.json(listBackups());
    });

    router.post('/backups', (req: Request, res: Response) => {
        const { description } = req.body || {};
        const dataFiles = [
            'packages/server/data/npcs.json',
            'packages/server/data/mobs.json',
            'packages/server/data/items.json',
            'packages/server/data/stores.json',
            'packages/server/data/achievements.json'
        ].map((f) => path.resolve(process.cwd(), f));

        const entry = createBackup(description || 'Manual backup', dataFiles);
        logAudit('backup_create', 'backup', `Created backup ${entry.id}`, req.ip || 'unknown');
        res.json(entry);
    });

    router.post('/backups/:id/rollback', (req: Request, res: Response) => {
        const result = rollbackBackup(req.params.id);
        logAudit('rollback', 'rollback', `Rollback to ${req.params.id}: ${result.success}`, req.ip || 'unknown');
        res.json(result);
    });

    // ─── PLAYERS ──────────────────────────────────────────────────
    router.get('/players', (_req: Request, res: Response) => {
        const players: any[] = [];
        world.entities.forEachPlayer((player) => {
            players.push({
                username: player.username,
                instance: player.instance,
                x: player.x,
                y: player.y,
                level: 1,
                hitPoints: player.hitPoints?.getHitPoints?.() || 0,
                rank: player.rank
            });
        });
        res.json(players);
    });

    // ─── NPCs ─────────────────────────────────────────────────────
    router.get('/npcs', (_req: Request, res: Response) => {
        try {
            const npcDataPath = path.resolve(DATA_ROOT, 'npcs.json');
            const data = JSON.parse(fs.readFileSync(npcDataPath, 'utf-8'));
            const memories: any[] = [];
            for (const [id, mem] of world.npcMemories) {
                memories.push({ id, ...(mem as any).serialize() });
            }
            res.json({ definitions: data, memories, totalMemories: memories.length });
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── MOBS ─────────────────────────────────────────────────────
    router.get('/mobs', (_req: Request, res: Response) => {
        try {
            const data = JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, 'mobs.json'), 'utf-8'));
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── ITEMS ────────────────────────────────────────────────────
    router.get('/items', (_req: Request, res: Response) => {
        try {
            const data = JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, 'items.json'), 'utf-8'));
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── QUESTS ───────────────────────────────────────────────────
    router.get('/quests', (_req: Request, res: Response) => {
        try {
            const questDir = path.resolve(DATA_ROOT, 'quests');
            const files = fs.readdirSync(questDir).filter((f) => f.endsWith('.json'));
            const quests: Record<string, any> = {};
            for (const file of files) {
                const key = file.replace('.json', '');
                quests[key] = JSON.parse(fs.readFileSync(path.join(questDir, file), 'utf-8'));
            }
            res.json(quests);
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── STORES ───────────────────────────────────────────────────
    router.get('/stores', (_req: Request, res: Response) => {
        try {
            const data = JSON.parse(fs.readFileSync(path.resolve(DATA_ROOT, 'stores.json'), 'utf-8'));
            res.json(data);
        } catch (err) {
            res.status(500).json({ error: `${err}` });
        }
    });

    // ─── WORLD GENERATOR STATE ────────────────────────────────────
    router.get('/world', (_req: Request, res: Response) => {
        res.json({
            generatedRegions: world.worldGenerator.getGeneratedRegions(),
            nations: world.nationSystem.getAllNations(),
            villages: world.nationSystem.getAllVillages()
        });
    });

    return router;
}

function resolveDataFile(type: string): string | null {
    const safe = type.replace(/[^a-zA-Z0-9_-]/g, '');
    const candidates = [
        path.resolve(DATA_ROOT, `${safe}.json`),
        path.resolve(DATA_ROOT, 'quests', `${safe}.json`),
        path.resolve(DATA_ROOT, 'crafting', `${safe}.json`)
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) return c;
    }
    return null;
}

function listFiles(dir: string, root: string, result: string[] = []): string[] {
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                listFiles(full, root, result);
            } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.json')) {
                result.push(path.relative(root, full));
            }
        }
    } catch {
        // skip unreadable dirs
    }
    return result;
}
