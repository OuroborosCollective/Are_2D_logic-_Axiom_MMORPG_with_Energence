import Menu from './menu';

import type Game from '../game';

/**
 * Vote/Toplist menu — displays admin-configured voting banners.
 * Players click banners to vote on toplists and claim rewards
 * (2h premium + 50 in-game currency per vote).
 */

interface VoteSiteClient {
    id: string;
    name: string;
    url: string;
    bannerUrl: string;
    bannerWidth: number;
    bannerHeight: number;
    rewardPremiumHours: number;
    rewardCurrency: number;
}

interface VoteStatusClient {
    siteId: string;
    siteName: string;
    canVote: boolean;
    cooldownMs: number;
    hasUnclaimedReward: boolean;
}

export default class Vote extends Menu {
    private bannerList: HTMLElement = document.querySelector('#vote-banner-list')!;
    private emptyMsg: HTMLElement = document.querySelector('#vote-empty')!;

    private apiBase = '';
    private sites: VoteSiteClient[] = [];
    private status: VoteStatusClient[] = [];

    public constructor(private game: Game) {
        super('#vote-menu', '#close-vote-menu', '#vote-button');

        const host = (window as any).globalConfig?.host || 'localhost';
        const apiPort = (window as any).globalConfig?.apiPort || 9002;
        this.apiBase = `http://${host}:${apiPort}/premium`;
    }

    public override show(): void {
        super.show();
        this.loadSites();
    }

    private async loadSites(): Promise<void> {
        try {
            const [sitesRes, statusRes] = await Promise.all([
                fetch(`${this.apiBase}/vote/sites`),
                fetch(`${this.apiBase}/vote/status/${this.getUsername()}`)
            ]);
            this.sites = await sitesRes.json();
            this.status = await statusRes.json();
        } catch {
            this.sites = [];
            this.status = [];
        }

        this.renderBanners();
    }

    private renderBanners(): void {
        if (!this.bannerList) return;

        if (this.sites.length === 0) {
            this.bannerList.innerHTML = '';
            if (this.emptyMsg) this.emptyMsg.style.display = '';
            return;
        }

        if (this.emptyMsg) this.emptyMsg.style.display = 'none';

        this.bannerList.innerHTML = this.sites.map(site => {
            const siteStatus = this.status.find(s => s.siteId === site.id);
            const canVote = siteStatus?.canVote ?? true;
            const hasReward = siteStatus?.hasUnclaimedReward ?? false;
            const cooldownMs = siteStatus?.cooldownMs ?? 0;
            const cooldownText = cooldownMs > 0 ? this.formatCooldown(cooldownMs) : '';

            let actionButton = '';
            if (hasReward) {
                actionButton = `<button class="vote-btn vote-btn-claim" data-site="${site.id}" data-action="claim">🎁 Claim Reward</button>`;
            } else if (canVote) {
                actionButton = `<button class="vote-btn vote-btn-vote" data-site="${site.id}" data-action="vote">🗳️ Vote Now</button>`;
            } else {
                actionButton = `<button class="vote-btn vote-btn-cooldown" disabled>⏰ ${cooldownText}</button>`;
            }

            return `
                <div class="vote-banner" data-site-id="${site.id}">
                    <a href="${site.url}" target="_blank" rel="noopener" data-site="${site.id}" data-action="open">
                        <img src="${site.bannerUrl}" alt="${site.name}" width="${site.bannerWidth}" height="${site.bannerHeight}" onerror="this.parentElement.innerHTML='<div style=\\'padding:1em; text-align:center; background:rgba(100,140,255,0.1); border-radius:4px;\\'>${site.name}</div>'" />
                    </a>
                    <div class="vote-banner-actions">
                        <span class="vote-banner-name">${site.name}</span>
                        ${actionButton}
                    </div>
                </div>
            `;
        }).join('');

        // Wire up button events
        this.bannerList.querySelectorAll('[data-action="vote"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const siteId = (btn as HTMLElement).dataset.site!;
                this.handleVote(siteId);
            });
        });

        this.bannerList.querySelectorAll('[data-action="claim"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const siteId = (btn as HTMLElement).dataset.site!;
                this.handleClaim(siteId);
            });
        });

        this.bannerList.querySelectorAll('[data-action="open"]').forEach(link => {
            link.addEventListener('click', () => {
                const siteId = (link as HTMLElement).dataset.site!;
                this.handleVoteOpen(siteId);
            });
        });
    }

    private async handleVoteOpen(siteId: string): Promise<void> {
        // Record the vote when the banner link is clicked (opens in new tab)
        try {
            await fetch(`${this.apiBase}/vote/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.getUsername(), siteId })
            });
            // Refresh after a short delay
            setTimeout(() => this.loadSites(), 2000);
        } catch { /* ignore */ }
    }

    private async handleVote(siteId: string): Promise<void> {
        const site = this.sites.find(s => s.id === siteId);
        if (!site) return;

        // Record the vote first
        try {
            await fetch(`${this.apiBase}/vote/record`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.getUsername(), siteId })
            });
        } catch { /* ignore */ }

        // Open the voting page
        window.open(site.url, '_blank');

        // Refresh status
        setTimeout(() => this.loadSites(), 2000);
    }

    private async handleClaim(siteId: string): Promise<void> {
        try {
            const res = await fetch(`${this.apiBase}/vote/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: this.getUsername(), siteId })
            });
            const data = await res.json();
            if (data.success) {
                // Refresh the list
                this.loadSites();
            }
        } catch { /* ignore */ }
    }

    private getUsername(): string {
        return this.game.player?.name || '';
    }

    private formatCooldown(ms: number): string {
        const hours = Math.floor(ms / 3600000);
        const minutes = Math.floor((ms % 3600000) / 60000);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }
}
