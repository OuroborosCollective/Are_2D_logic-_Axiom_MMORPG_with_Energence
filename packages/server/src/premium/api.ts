/**
 * Premium API — Express router for PayPal payments and premium features.
 *
 * Public endpoints (no game auth required, PayPal handles payment auth):
 *   POST  /premium/create-order        — start PayPal checkout
 *   POST  /premium/capture-order       — complete payment + activate premium
 *   GET   /premium/status/:username    — check premium status
 *   GET   /premium/config              — get pricing and PayPal config
 *
 * Authenticated endpoints (requires admin token):
 *   GET   /premium/all                 — list all premium users
 *   POST  /premium/grant/:username     — manually grant premium
 *   POST  /premium/textures/:username/:id/approve — approve a texture
 *
 * Player endpoints (identified by username in body):
 *   POST  /premium/housing/create      — create a house
 *   POST  /premium/housing/texture     — assign texture to house
 *   POST  /premium/housing/furniture   — add furniture
 *   POST  /premium/textures/upload     — upload custom texture metadata
 */

import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';

import { createOrder, captureOrder, getPayPalConfig } from './paypal';
import {
    activatePremium,
    getPremiumData,
    getAllPremiumData,
    isPremium,
    createHouse,
    updateHouseTexture,
    addFurniture,
    validateTextureUpload,
    registerTexture,
    approveTexture,
    getHouseSizes
} from './premium';
import { validateSession } from '../admin/auth';
import { logAudit } from '../admin/audit';

import log from '@kaetram/common/util/log';
import { Modules } from '@kaetram/common/network';

import type World from '../game/world';
import type { Request, Response } from 'express';

const TEXTURE_UPLOAD_DIR = path.resolve(process.cwd(), 'packages/server/data/textures/uploads');

export default function createPremiumRouter(world: World): Router {
    const router = Router();

    // Ensure upload directory exists
    if (!fs.existsSync(TEXTURE_UPLOAD_DIR)) {
        fs.mkdirSync(TEXTURE_UPLOAD_DIR, { recursive: true });
    }

    // ─── PUBLIC: PayPal Config ────────────────────────────────────
    router.get('/config', (_req: Request, res: Response) => {
        const config = getPayPalConfig();
        res.json({
            ...config,
            benefits: [
                '150% XP on all experience gains',
                'Player housing with custom interior',
                'Custom texture uploads for character and house',
                'Gold Premium badge in chat',
                'Priority support'
            ],
            houseSizes: getHouseSizes()
        });
    });

    // ─── PUBLIC: Create PayPal Order ──────────────────────────────
    router.post('/create-order', async (req: Request, res: Response) => {
        const { username } = req.body || {};
        if (!username) {
            res.status(400).json({ error: 'Username required.' });
            return;
        }

        try {
            const order = await createOrder(username);
            logAudit('paypal_order_created', 'system', `Order ${order.id} for ${username}`, req.ip || 'unknown');
            res.json(order);
        } catch (err: any) {
            log.error(`[PayPal] Create order error: ${err.message}`);
            res.status(500).json({
                error: 'Payment system unavailable. Please ensure PayPal credentials are configured.',
                details: err.message
            });
        }
    });

    // ─── PUBLIC: Capture PayPal Order ─────────────────────────────
    router.post('/capture-order', async (req: Request, res: Response) => {
        const { orderId, username } = req.body || {};
        if (!orderId || !username) {
            res.status(400).json({ error: 'orderId and username required.' });
            return;
        }

        try {
            const capture = await captureOrder(orderId);

            if (capture.status === 'COMPLETED') {
                // Activate premium for this player
                const premiumData = activatePremium(username, orderId, capture.payerEmail);

                // Update player rank if they're online
                const player = world.getPlayerByName(username);
                if (player) {
                    player.rank = Modules.Ranks.Premium;
                    player.notify('Premium activated! You now earn 150% XP, can own a house, and upload custom textures.', '#ffd700');
                }

                logAudit('premium_activated', 'system',
                    `${username} activated premium via PayPal ${orderId} (${capture.payerEmail})`,
                    req.ip || 'unknown');

                res.json({
                    success: true,
                    premium: premiumData,
                    message: 'Premium activated! Enjoy 150% XP, housing, and custom textures.'
                });
            } else {
                res.status(400).json({ error: `Payment not completed. Status: ${capture.status}` });
            }
        } catch (err: any) {
            log.error(`[PayPal] Capture error: ${err.message}`);
            res.status(500).json({ error: 'Failed to process payment.', details: err.message });
        }
    });

    // ─── PUBLIC: Check Premium Status ─────────────────────────────
    router.get('/status/:username', (req: Request, res: Response) => {
        const data = getPremiumData(req.params.username);
        res.json(data);
    });

    // ─── ADMIN: List All Premium Users ────────────────────────────
    router.get('/all', (req: Request, res: Response) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validateSession(token)) {
            res.status(401).json({ error: 'Admin auth required.' });
            return;
        }

        const all: any[] = [];
        for (const [username, data] of getAllPremiumData()) {
            if (data.isPremium) {
                all.push({ username, ...data });
            }
        }
        res.json(all);
    });

    // ─── ADMIN: Manual Premium Grant ──────────────────────────────
    router.post('/grant/:username', (req: Request, res: Response) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validateSession(token)) {
            res.status(401).json({ error: 'Admin auth required.' });
            return;
        }

        const { username } = req.params;
        const data = activatePremium(username, 'admin_grant', 'admin');

        const player = world.getPlayerByName(username);
        if (player) {
            player.rank = Modules.Ranks.Premium;
            player.notify('You have been granted Premium status!', '#ffd700');
        }

        logAudit('premium_granted', 'system', `Admin granted premium to ${username}`, req.ip || 'unknown');
        res.json({ success: true, premium: data });
    });

    // ─── ADMIN: Approve Texture ───────────────────────────────────
    router.post('/textures/:username/:id/approve', (req: Request, res: Response) => {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token || !validateSession(token)) {
            res.status(401).json({ error: 'Admin auth required.' });
            return;
        }

        const success = approveTexture(req.params.username, req.params.id);
        logAudit('texture_approved', 'asset',
            `Texture ${req.params.id} for ${req.params.username}: ${success ? 'approved' : 'not found'}`,
            req.ip || 'unknown');
        res.json({ success });
    });

    // ─── PLAYER: Create House ─────────────────────────────────────
    router.post('/housing/create', (req: Request, res: Response) => {
        const { username, name, x, y, size } = req.body || {};
        if (!username || !name) {
            res.status(400).json({ error: 'username and name required.' });
            return;
        }

        const house = createHouse(username, name, x || 400, y || 400, size || 'small');
        if (!house) {
            res.status(403).json({ error: 'Premium required or house already exists.' });
            return;
        }
        res.json({ success: true, house });
    });

    // ─── PLAYER: Apply Texture to House ───────────────────────────
    router.post('/housing/texture', (req: Request, res: Response) => {
        const { username, textureType, textureId } = req.body || {};
        if (!username || !textureType || !textureId) {
            res.status(400).json({ error: 'username, textureType, textureId required.' });
            return;
        }

        const success = updateHouseTexture(username, textureType, textureId);
        res.json({ success });
    });

    // ─── PLAYER: Add Furniture ────────────────────────────────────
    router.post('/housing/furniture', (req: Request, res: Response) => {
        const { username, furniture } = req.body || {};
        if (!username || !furniture) {
            res.status(400).json({ error: 'username and furniture required.' });
            return;
        }

        const success = addFurniture(username, furniture);
        res.json({ success });
    });

    // ─── PLAYER: Upload Texture Metadata ──────────────────────────
    router.post('/textures/upload', (req: Request, res: Response) => {
        const { username, type, name, filename, width, height, size, data: textureData } = req.body || {};

        if (!username || !type || !name || !filename) {
            res.status(400).json({ error: 'username, type, name, filename required.' });
            return;
        }

        // Validate the upload
        const validation = validateTextureUpload(
            username,
            filename,
            `image/${filename.split('.').pop() === 'png' ? 'png' : filename.split('.').pop() === 'webp' ? 'webp' : 'jpeg'}`,
            size || 0,
            width || 64,
            height || 64
        );

        if (!validation.success) {
            res.status(400).json({ error: validation.error });
            return;
        }

        // Save texture data if provided (base64)
        if (textureData) {
            try {
                const buffer = Buffer.from(textureData, 'base64');
                const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const savePath = path.join(TEXTURE_UPLOAD_DIR, `${username}_${Date.now()}_${safeName}`);
                fs.writeFileSync(savePath, buffer);
            } catch (err) {
                log.error(`[Texture] Save error: ${err}`);
            }
        }

        // Register texture metadata
        const texture = registerTexture(username, type, name, filename, width || 64, height || 64, size || 0);

        res.json({
            success: true,
            texture,
            message: 'Texture uploaded. Pending admin approval before going live.'
        });
    });

    return router;
}
