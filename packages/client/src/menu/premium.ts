import Menu from './menu';
import Util from '../utils/util';

import type Game from '../game';

/**
 * Premium Shop menu — shows benefits, purchase button (PayPal),
 * housing management, and texture uploads for premium users.
 *
 * Non-premium players see the teaser banner periodically.
 */

export default class Premium extends Menu {
    private buyButton: HTMLElement = document.querySelector('#premium-buy-btn')!;
    private statusText: HTMLElement = document.querySelector('#premium-status-text')!;
    private statusBadge: HTMLElement = document.querySelector('#premium-status-badge')!;
    private purchaseSection: HTMLElement = document.querySelector('#premium-purchase')!;
    private housingSection: HTMLElement = document.querySelector('#premium-housing-section')!;
    private houseInfo: HTMLElement = document.querySelector('#premium-house-info')!;
    private createHouseBtn: HTMLElement = document.querySelector('#premium-create-house')!;
    private uploadTextureBtn: HTMLElement = document.querySelector('#premium-upload-texture')!;
    private textureList: HTMLElement = document.querySelector('#premium-texture-list')!;

    // Teaser elements
    private teaser: HTMLElement = document.querySelector('#premium-teaser')!;
    private teaserBtn: HTMLElement = document.querySelector('#premium-teaser-btn')!;
    private teaserClose: HTMLElement = document.querySelector('#premium-teaser-close')!;

    private isPremium = false;
    private apiBase = '';
    private teaserTimeout?: number;

    public constructor(private game: Game) {
        super('#premium-shop', '#close-premium-shop', '#premium-button');

        // Determine API base URL
        const host = (window as any).globalConfig?.host || 'localhost';
        const apiPort = (window as any).globalConfig?.apiPort || 9002;
        this.apiBase = `http://${host}:${apiPort}`;

        this.buyButton?.addEventListener('click', () => this.handlePurchase());
        this.createHouseBtn?.addEventListener('click', () => this.handleCreateHouse());
        this.uploadTextureBtn?.addEventListener('click', () => this.handleUploadTexture());

        this.teaserBtn?.addEventListener('click', () => {
            this.hideTeaser();
            this.show();
        });

        this.teaserClose?.addEventListener('click', () => this.hideTeaser());

        // Start teaser timer for non-premium users
        this.startTeaserTimer();
    }

    public override show(): void {
        super.show();
        this.loadStatus();
    }

    /** Fetch premium status for current player from server. */
    private async loadStatus(): Promise<void> {
        try {
            const username = this.game.player?.name || '';
            if (!username) return;

            const res = await fetch(`${this.apiBase}/premium/status/${username}`);
            const data = await res.json();

            this.isPremium = data.isPremium;
            this.updateUI(data);
        } catch {
            // API may not be reachable — show default state
        }
    }

    private updateUI(data: any): void {
        if (data.isPremium) {
            this.statusText.textContent = '⭐ Premium Active';
            this.statusText.style.color = '#ffd700';
            this.statusBadge.textContent = 'ACTIVE';
            this.statusBadge.style.background = 'rgba(255, 215, 0, 0.2)';
            this.statusBadge.style.color = '#ffd700';
            this.statusBadge.style.padding = '2px 8px';
            this.statusBadge.style.borderRadius = '4px';

            // Hide purchase, show housing
            this.purchaseSection.style.display = 'none';
            this.housingSection.style.display = 'block';

            // Show house info
            if (data.housing) {
                this.houseInfo.innerHTML = `
                    <div style="padding:0.4em; background:rgba(255,255,255,0.05); border-radius:6px; margin-bottom:0.4em;">
                        <div style="font-weight:bold; color:#ffd700;">${data.housing.name}</div>
                        <div style="font-size:0.8em; color:#999;">
                            Size: ${data.housing.size} | Furniture: ${data.housing.furniture?.length || 0}
                        </div>
                    </div>
                `;
                this.createHouseBtn.style.display = 'none';
            } else {
                this.houseInfo.innerHTML = '<p style="font-size:0.8em; color:#999;">No house yet. Create one!</p>';
                this.createHouseBtn.style.display = '';
            }

            // Show texture list
            if (data.customTextures?.length > 0) {
                this.textureList.innerHTML = data.customTextures.map((t: any) =>
                    `<div style="padding:0.3em 0.5em; background:rgba(255,255,255,0.03); border-radius:4px; margin-bottom:0.3em; font-size:0.8em;">
                        <span>${t.name}</span>
                        <span style="color:${t.approved ? '#4caf50' : '#ff9800'}; margin-left:0.5em;">${t.approved ? '✓ Live' : '⏳ Pending'}</span>
                    </div>`
                ).join('');
            } else {
                this.textureList.innerHTML = '<p style="font-size:0.75em; color:#888;">No textures uploaded yet.</p>';
            }

            // Stop teaser for premium users
            this.stopTeaserTimer();
        } else {
            this.statusText.textContent = 'Free Account';
            this.statusText.style.color = '#aaa';
            this.statusBadge.textContent = '';
            this.purchaseSection.style.display = 'flex';
            this.housingSection.style.display = 'none';
        }
    }

    /** Open PayPal checkout for premium purchase. */
    private async handlePurchase(): Promise<void> {
        const username = this.game.player?.name || '';
        if (!username) return;

        this.buyButton.textContent = '⏳ Processing...';
        this.buyButton.style.pointerEvents = 'none';

        try {
            const res = await fetch(`${this.apiBase}/premium/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();

            if (data.approvalUrl) {
                window.open(data.approvalUrl, '_blank');
                this.buyButton.textContent = '✓ Complete payment in PayPal tab';
                this.buyButton.style.color = '#4caf50';

                // Poll for completion
                this.pollForPremium(username, data.id);
            } else {
                this.buyButton.textContent = data.error || 'Payment unavailable';
                this.buyButton.style.color = '#ff4444';
                setTimeout(() => {
                    this.buyButton.innerHTML = '&#x1F6D2; Purchase Premium';
                    this.buyButton.style.color = '';
                    this.buyButton.style.pointerEvents = '';
                }, 3000);
            }
        } catch {
            this.buyButton.textContent = 'Error — try again';
            setTimeout(() => {
                this.buyButton.innerHTML = '&#x1F6D2; Purchase Premium';
                this.buyButton.style.pointerEvents = '';
            }, 3000);
        }
    }

    /** Poll server to detect when PayPal payment completes. */
    private async pollForPremium(username: string, orderId: string): Promise<void> {
        let attempts = 0;
        const poll = setInterval(async () => {
            attempts++;
            if (attempts > 60) { clearInterval(poll); return; } // 5 min timeout

            try {
                const res = await fetch(`${this.apiBase}/premium/status/${username}`);
                const data = await res.json();
                if (data.isPremium) {
                    clearInterval(poll);
                    this.isPremium = true;
                    this.updateUI(data);
                    this.buyButton.innerHTML = '&#x1F6D2; Purchase Premium';
                    this.buyButton.style.pointerEvents = '';
                    this.buyButton.style.color = '';
                }
            } catch { /* retry */ }
        }, 5000);
    }

    private async handleCreateHouse(): Promise<void> {
        const username = this.game.player?.name || '';
        if (!username) return;

        try {
            const res = await fetch(`${this.apiBase}/premium/housing/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    name: `${username}'s House`,
                    x: this.game.player?.gridX || 400,
                    y: this.game.player?.gridY || 400,
                    size: 'small'
                })
            });
            const data = await res.json();
            if (data.success) this.loadStatus();
        } catch { /* error */ }
    }

    private handleUploadTexture(): void {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;

            const username = this.game.player?.name || '';
            if (!username) return;

            // Read file as base64
            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = (reader.result as string).split(',')[1];

                try {
                    const res = await fetch(`${this.apiBase}/premium/textures/upload`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            username,
                            type: 'character',
                            name: file.name.split('.')[0],
                            filename: file.name,
                            width: 64,
                            height: 64,
                            size: file.size,
                            data: base64
                        })
                    });
                    const data = await res.json();
                    if (data.success) this.loadStatus();
                } catch { /* error */ }
            };
            reader.readAsDataURL(file);
        });
        input.click();
    }

    /** Periodically show the teaser banner for non-premium users. */
    private startTeaserTimer(): void {
        // Show teaser after 60 seconds of gameplay, then every 5 minutes
        this.teaserTimeout = window.setTimeout(() => {
            if (!this.isPremium) this.showTeaser();

            setInterval(() => {
                if (!this.isPremium && !this.isVisible()) this.showTeaser();
            }, 300_000); // every 5 minutes
        }, 60_000); // first show after 1 minute
    }

    private stopTeaserTimer(): void {
        if (this.teaserTimeout) {
            clearTimeout(this.teaserTimeout);
            this.teaserTimeout = undefined;
        }
        this.hideTeaser();
    }

    private showTeaser(): void {
        if (!this.teaser) return;
        Util.fadeIn(this.teaser);

        // Auto-hide after 15 seconds
        setTimeout(() => this.hideTeaser(), 15_000);
    }

    private hideTeaser(): void {
        if (!this.teaser) return;
        Util.fadeOut(this.teaser);
    }
}
