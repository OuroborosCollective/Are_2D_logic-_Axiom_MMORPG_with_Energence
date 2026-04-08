/**
 * Voting / Toplist System
 *
 * Admin can add/remove toplist voting banners via the admin API.
 * Players click banners in-game → redirected to the toplist URL.
 * On return (or after a cooldown), they receive:
 *   - 2 hours of premium status
 *   - 50 in-game currency
 *
 * Anti-abuse: per-player per-site cooldown (12h default).
 */

import log from '@kaetram/common/util/log';

export interface VoteSite {
    id: string;
    name: string;
    url: string;             // toplist voting URL
    bannerUrl: string;       // banner image URL (displayed in-game)
    bannerWidth: number;
    bannerHeight: number;
    enabled: boolean;
    sortOrder: number;
    addedAt: number;
    rewardPremiumHours: number;  // hours of temp premium (default 2)
    rewardCurrency: number;      // in-game currency reward (default 50)
}

export interface VoteRecord {
    username: string;
    siteId: string;
    votedAt: number;
    rewardClaimed: boolean;
}

const VOTE_COOLDOWN = 12 * 60 * 60 * 1000; // 12 hours between votes per site
const DEFAULT_PREMIUM_HOURS = 2;
const DEFAULT_CURRENCY_REWARD = 50;

// In-memory stores
const voteSites: Map<string, VoteSite> = new Map();
const voteRecords: VoteRecord[] = [];

let nextSiteId = 1;

// ─── ADMIN: Site Management ───────────────────────────────────────

export function addVoteSite(
    name: string,
    url: string,
    bannerUrl: string,
    bannerWidth = 468,
    bannerHeight = 60,
    rewardPremiumHours = DEFAULT_PREMIUM_HOURS,
    rewardCurrency = DEFAULT_CURRENCY_REWARD
): VoteSite {
    const id = `vote_${nextSiteId++}`;
    const site: VoteSite = {
        id,
        name,
        url,
        bannerUrl,
        bannerWidth,
        bannerHeight,
        enabled: true,
        sortOrder: voteSites.size,
        addedAt: Date.now(),
        rewardPremiumHours,
        rewardCurrency
    };
    voteSites.set(id, site);
    log.info(`[Vote] Added toplist site: ${name} (${url})`);
    return site;
}

export function updateVoteSite(id: string, updates: Partial<VoteSite>): VoteSite | null {
    const site = voteSites.get(id);
    if (!site) return null;
    Object.assign(site, updates);
    return site;
}

export function removeVoteSite(id: string): boolean {
    const result = voteSites.delete(id);
    if (result) log.info(`[Vote] Removed toplist site: ${id}`);
    return result;
}

export function getVoteSites(): VoteSite[] {
    return [...voteSites.values()]
        .filter(s => s.enabled)
        .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getAllVoteSites(): VoteSite[] {
    return [...voteSites.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

// ─── PLAYER: Voting ───────────────────────────────────────────────

export function canVote(username: string, siteId: string): boolean {
    const lastVote = voteRecords.find(
        r => r.username === username && r.siteId === siteId
    );
    if (!lastVote) return true;
    return Date.now() - lastVote.votedAt >= VOTE_COOLDOWN;
}

export function getVoteCooldownRemaining(username: string, siteId: string): number {
    const lastVote = voteRecords.find(
        r => r.username === username && r.siteId === siteId
    );
    if (!lastVote) return 0;
    const remaining = VOTE_COOLDOWN - (Date.now() - lastVote.votedAt);
    return Math.max(0, remaining);
}

export function recordVote(username: string, siteId: string): VoteRecord {
    // Remove old record for this user/site
    const idx = voteRecords.findIndex(
        r => r.username === username && r.siteId === siteId
    );
    if (idx !== -1) voteRecords.splice(idx, 1);

    const record: VoteRecord = {
        username,
        siteId,
        votedAt: Date.now(),
        rewardClaimed: false
    };
    voteRecords.push(record);
    log.info(`[Vote] ${username} voted on ${siteId}`);
    return record;
}

export function claimVoteReward(username: string, siteId: string): {
    success: boolean;
    premiumHours: number;
    currency: number;
    error?: string;
} {
    const record = voteRecords.find(
        r => r.username === username && r.siteId === siteId && !r.rewardClaimed
    );

    if (!record) {
        return { success: false, premiumHours: 0, currency: 0, error: 'No unclaimed vote found.' };
    }

    const site = voteSites.get(siteId);
    if (!site) {
        return { success: false, premiumHours: 0, currency: 0, error: 'Vote site not found.' };
    }

    record.rewardClaimed = true;

    log.info(`[Vote] ${username} claimed reward for ${siteId}: ${site.rewardPremiumHours}h premium + ${site.rewardCurrency} currency`);

    return {
        success: true,
        premiumHours: site.rewardPremiumHours,
        currency: site.rewardCurrency
    };
}

export function getPlayerVoteStatus(username: string): Array<{
    siteId: string;
    siteName: string;
    canVote: boolean;
    cooldownMs: number;
    hasUnclaimedReward: boolean;
}> {
    const sites = getVoteSites();
    return sites.map(site => {
        const record = voteRecords.find(r => r.username === username && r.siteId === site.id);
        return {
            siteId: site.id,
            siteName: site.name,
            canVote: canVote(username, site.id),
            cooldownMs: getVoteCooldownRemaining(username, site.id),
            hasUnclaimedReward: !!record && !record.rewardClaimed
        };
    });
}

export function getVoteStats(): {
    totalSites: number;
    totalVotes: number;
    votesLast24h: number;
} {
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return {
        totalSites: voteSites.size,
        totalVotes: voteRecords.length,
        votesLast24h: voteRecords.filter(r => r.votedAt >= dayAgo).length
    };
}
