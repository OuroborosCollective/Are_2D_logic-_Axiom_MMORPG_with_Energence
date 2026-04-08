/**
 * Premium Account System
 *
 * Premium players get:
 *   - 150% XP multiplier (1.5x on all experience gains)
 *   - Player housing (own a house, customize interior)
 *   - Custom texture uploads (character skin, house textures)
 *   - Gold name colour in chat
 *   - Premium badge/title
 *
 * Premium status is stored as Ranks.Premium on the player.
 * The XP multiplier is applied in the experience calculation.
 */

import { Modules } from '@kaetram/common/network';
import log from '@kaetram/common/util/log';

export const PREMIUM_XP_MULTIPLIER = 1.5; // 150% XP

export interface PremiumStatus {
    isPremium: boolean;
    activatedAt?: number;
    paypalOrderId?: string;
    paypalEmail?: string;
    housing: HousingData | null;
    customTextures: CustomTextureData[];
}

export interface HousingData {
    houseId: string;
    name: string;
    x: number;
    y: number;
    size: 'small' | 'medium' | 'large';
    furniture: FurnitureItem[];
    wallTexture: string;
    floorTexture: string;
    exteriorTexture: string;
    createdAt: number;
    visitors: number;
}

export interface FurnitureItem {
    id: string;
    type: string;
    x: number;
    y: number;
    rotation: number;
    customTexture?: string;
}

export interface CustomTextureData {
    id: string;
    type: 'character' | 'house_wall' | 'house_floor' | 'house_exterior' | 'furniture';
    name: string;
    filename: string;
    width: number;
    height: number;
    uploadedAt: number;
    approved: boolean; // Admin must approve before it goes live
    size: number;      // bytes
}

// In-memory premium data store (per-player)
const premiumData: Map<string, PremiumStatus> = new Map();

const MAX_TEXTURE_SIZE = 512 * 1024; // 512 KB max per texture
const MAX_TEXTURES_PER_PLAYER = 20;
const ALLOWED_TEXTURE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_TEXTURE_DIMENSION = 512; // 512x512 max

export function isPremium(rank: number): boolean {
    return rank === Modules.Ranks.Premium ||
           rank === Modules.Ranks.Admin ||
           rank === Modules.Ranks.Patron ||
           rank >= Modules.Ranks.TierOne && rank <= Modules.Ranks.TierSeven;
}

export function getXPMultiplier(rank: number): number {
    if (isPremium(rank)) return PREMIUM_XP_MULTIPLIER;
    return 1.0;
}

export function getPremiumData(username: string): PremiumStatus {
    const existing = premiumData.get(username);
    if (existing) return existing;

    const data: PremiumStatus = {
        isPremium: false,
        housing: null,
        customTextures: []
    };
    premiumData.set(username, data);
    return data;
}

export function activatePremium(
    username: string,
    paypalOrderId: string,
    paypalEmail: string
): PremiumStatus {
    const data = getPremiumData(username);
    data.isPremium = true;
    data.activatedAt = Date.now();
    data.paypalOrderId = paypalOrderId;
    data.paypalEmail = paypalEmail;
    premiumData.set(username, data);

    log.info(`[Premium] ${username} activated premium (PayPal: ${paypalOrderId})`);
    return data;
}

// ─── HOUSING ──────────────────────────────────────────────────────

const HOUSE_SIZES = {
    small: { tiles: 16, cost: 0 },    // Free with premium
    medium: { tiles: 36, cost: 500 },  // In-game gold
    large: { tiles: 64, cost: 2000 }
};

export function createHouse(
    username: string,
    name: string,
    x: number,
    y: number,
    size: 'small' | 'medium' | 'large' = 'small'
): HousingData | null {
    const data = getPremiumData(username);
    if (!data.isPremium) return null;
    if (data.housing) return data.housing; // Already has a house

    const house: HousingData = {
        houseId: `house_${username}_${Date.now()}`,
        name,
        x,
        y,
        size,
        furniture: [],
        wallTexture: 'default_wall',
        floorTexture: 'default_floor',
        exteriorTexture: 'default_exterior',
        createdAt: Date.now(),
        visitors: 0
    };

    data.housing = house;
    log.info(`[Housing] ${username} created house "${name}" at (${x}, ${y})`);
    return house;
}

export function updateHouseTexture(
    username: string,
    textureType: 'wallTexture' | 'floorTexture' | 'exteriorTexture',
    textureId: string
): boolean {
    const data = getPremiumData(username);
    if (!data.housing) return false;

    // Verify the texture exists and is approved
    const texture = data.customTextures.find(t => t.id === textureId && t.approved);
    if (!texture) return false;

    data.housing[textureType] = textureId;
    return true;
}

export function addFurniture(
    username: string,
    furniture: FurnitureItem
): boolean {
    const data = getPremiumData(username);
    if (!data.housing) return false;

    const maxFurniture = HOUSE_SIZES[data.housing.size].tiles;
    if (data.housing.furniture.length >= maxFurniture) return false;

    data.housing.furniture.push(furniture);
    return true;
}

// ─── CUSTOM TEXTURES ──────────────────────────────────────────────

export interface TextureUploadResult {
    success: boolean;
    error?: string;
    texture?: CustomTextureData;
}

export function validateTextureUpload(
    username: string,
    filename: string,
    mimeType: string,
    size: number,
    width: number,
    height: number
): TextureUploadResult {
    const data = getPremiumData(username);
    if (!data.isPremium) {
        return { success: false, error: 'Premium subscription required.' };
    }

    if (data.customTextures.length >= MAX_TEXTURES_PER_PLAYER) {
        return { success: false, error: `Maximum ${MAX_TEXTURES_PER_PLAYER} textures reached.` };
    }

    if (!ALLOWED_TEXTURE_TYPES.includes(mimeType)) {
        return { success: false, error: 'Only PNG, JPEG, and WebP textures are allowed.' };
    }

    if (size > MAX_TEXTURE_SIZE) {
        return { success: false, error: `Texture exceeds ${MAX_TEXTURE_SIZE / 1024}KB limit.` };
    }

    if (width > MAX_TEXTURE_DIMENSION || height > MAX_TEXTURE_DIMENSION) {
        return { success: false, error: `Texture exceeds ${MAX_TEXTURE_DIMENSION}x${MAX_TEXTURE_DIMENSION} pixel limit.` };
    }

    return { success: true };
}

export function registerTexture(
    username: string,
    type: CustomTextureData['type'],
    name: string,
    filename: string,
    width: number,
    height: number,
    size: number
): CustomTextureData {
    const data = getPremiumData(username);

    const texture: CustomTextureData = {
        id: `tex_${username}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type,
        name,
        filename,
        width,
        height,
        uploadedAt: Date.now(),
        approved: false, // Requires admin approval
        size
    };

    data.customTextures.push(texture);
    log.info(`[Texture] ${username} uploaded ${type} texture "${name}" (${width}x${height}, ${(size / 1024).toFixed(1)}KB) — pending approval`);

    return texture;
}

export function approveTexture(username: string, textureId: string): boolean {
    const data = getPremiumData(username);
    const texture = data.customTextures.find(t => t.id === textureId);
    if (!texture) return false;
    texture.approved = true;
    log.info(`[Texture] Approved texture ${textureId} for ${username}`);
    return true;
}

export function getHouseSizes() {
    return HOUSE_SIZES;
}

export function getAllPremiumData(): Map<string, PremiumStatus> {
    return premiumData;
}
