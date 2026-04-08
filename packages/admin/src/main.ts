/**
 * Kaetram Admin Dashboard — Thosu Exclusive
 *
 * Complete no-code admin panel with:
 * - Dashboard overview
 * - Heuristic monitoring & control
 * - NPC/Mob/Item/Quest/Store management
 * - Code viewer/editor with preview
 * - Asset management
 * - Backup & rollback
 * - Audit log
 * - Performance monitor
 * - Nation/Village/Politics overview
 * - Social wave overview
 * - World generator status
 */

const API_BASE = `http://${globalConfig.host}:${globalConfig.apiEnabled ? globalConfig.apiPort : 9002}/admin`;

let authToken = '';

// ─── NAV DEFINITIONS ─────────────────────────────────────────────
const NAV_ITEMS = [
    { id: 'dashboard', label: '📊 Dashboard', icon: '📊' },
    { id: 'heuristics', label: '🧠 Heuristics', icon: '🧠' },
    { id: 'nations', label: '🏰 Nations', icon: '🏰' },
    { id: 'social', label: '🤝 Social Wave', icon: '🤝' },
    { id: 'players', label: '👤 Players', icon: '👤' },
    { id: 'npcs', label: '🧙 NPCs', icon: '🧙' },
    { id: 'mobs', label: '👹 Mobs', icon: '👹' },
    { id: 'items', label: '⚔️ Items', icon: '⚔️' },
    { id: 'quests', label: '📜 Quests', icon: '📜' },
    { id: 'stores', label: '🏪 Stores', icon: '🏪' },
    { id: 'world', label: '🌍 World Gen', icon: '🌍' },
    { id: 'data', label: '📁 Data Files', icon: '📁' },
    { id: 'code', label: '💻 Code Editor', icon: '💻' },
    { id: 'assets', label: '🎨 Assets', icon: '🎨' },
    { id: 'backups', label: '💾 Backups', icon: '💾' },
    { id: 'performance', label: '⚡ Performance', icon: '⚡' },
    { id: 'errors', label: '🐛 Error Log', icon: '🐛' },
    { id: 'audit', label: '📋 Audit Log', icon: '📋' },
];

// ─── API HELPERS ──────────────────────────────────────────────────
async function api(path: string, options: RequestInit = {}): Promise<any> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
    };
    try {
        const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
        if (res.status === 401) { showLogin(); return null; }
        return await res.json();
    } catch (err) {
        console.error('API error:', err);
        return null;
    }
}

function apiGet(path: string) { return api(path); }
function apiPost(path: string, body?: any) { return api(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }); }
function apiPut(path: string, body: any) { return api(path, { method: 'PUT', body: JSON.stringify(body) }); }

// ─── DOM HELPERS ──────────────────────────────────────────────────
function $(sel: string): HTMLElement | null { return document.querySelector(sel); }
function html(el: HTMLElement | null, content: string) { if (el) el.innerHTML = content; }
function show(el: HTMLElement | null) { if (el) el.style.display = ''; }
function hide(el: HTMLElement | null) { if (el) el.style.display = 'none'; }

// ─── INIT ─────────────────────────────────────────────────────────
class AdminApp {
    private currentPanel = 'dashboard';
    private refreshInterval?: number;

    constructor() {
        // Check for saved session
        const saved = localStorage.getItem('admin_token');
        if (saved) {
            authToken = saved;
            this.validateAndShow();
        } else {
            showLogin();
        }

        // Login handler
        $('#login-btn')?.addEventListener('click', () => this.handleLogin());
        $('#login-pass')?.addEventListener('keydown', (e: Event) => {
            if ((e as KeyboardEvent).key === 'Enter') this.handleLogin();
        });

        // Logout handler
        $('#logout-btn')?.addEventListener('click', () => this.handleLogout());
    }

    private async validateAndShow() {
        const session = await apiGet('/session');
        if (session?.active) {
            this.showApp();
        } else {
            localStorage.removeItem('admin_token');
            authToken = '';
            showLogin();
        }
    }

    private async handleLogin() {
        const username = ($('#login-user') as HTMLInputElement)?.value;
        const password = ($('#login-pass') as HTMLInputElement)?.value;
        const errorEl = $('#login-error');

        if (!username || !password) {
            if (errorEl) { errorEl.textContent = 'Both fields required.'; show(errorEl); }
            return;
        }

        const result = await apiPost('/login', { username, password });

        if (result?.success) {
            authToken = result.token;
            localStorage.setItem('admin_token', authToken);
            hide(errorEl);
            this.showApp();
        } else {
            if (errorEl) {
                errorEl.textContent = result?.error || 'Login failed.';
                show(errorEl);
            }
        }
    }

    private async handleLogout() {
        await apiPost('/logout');
        authToken = '';
        localStorage.removeItem('admin_token');
        showLogin();
    }

    private showApp() {
        hide($('#login-screen'));
        show($('#admin-app'));
        this.buildNav();
        this.showPanel('dashboard');

        // Auto-refresh every 10s
        this.refreshInterval = window.setInterval(() => {
            this.showPanel(this.currentPanel);
        }, 10_000);
    }

    private buildNav() {
        const container = $('#nav-items');
        if (!container) return;
        container.innerHTML = NAV_ITEMS.map(item =>
            `<div class="tab nav-tab" data-panel="${item.id}" style="cursor:pointer; padding:6px 10px; border-radius:6px; font-size:14px;">${item.label}</div>`
        ).join('');

        container.querySelectorAll('.nav-tab').forEach(el => {
            el.addEventListener('click', () => {
                this.showPanel((el as HTMLElement).dataset.panel || 'dashboard');
            });
        });
    }

    private showPanel(id: string) {
        this.currentPanel = id;

        // Highlight active nav
        document.querySelectorAll('.nav-tab').forEach(el => {
            (el as HTMLElement).style.background = (el as HTMLElement).dataset.panel === id ? 'var(--accent)' : '';
            (el as HTMLElement).style.color = (el as HTMLElement).dataset.panel === id ? '#fff' : '';
        });

        const container = $('#panel-container');
        if (!container) return;

        switch (id) {
            case 'dashboard': return this.renderDashboard(container);
            case 'heuristics': return this.renderHeuristics(container);
            case 'nations': return this.renderNations(container);
            case 'social': return this.renderSocial(container);
            case 'players': return this.renderPlayers(container);
            case 'npcs': return this.renderNPCs(container);
            case 'mobs': return this.renderMobs(container);
            case 'items': return this.renderItems(container);
            case 'quests': return this.renderQuests(container);
            case 'stores': return this.renderStores(container);
            case 'world': return this.renderWorld(container);
            case 'data': return this.renderDataFiles(container);
            case 'code': return this.renderCodeEditor(container);
            case 'assets': return this.renderAssets(container);
            case 'backups': return this.renderBackups(container);
            case 'performance': return this.renderPerformance(container);
            case 'errors': return this.renderErrors(container);
            case 'audit': return this.renderAudit(container);
        }
    }

    // ─── DASHBOARD ────────────────────────────────────────────────
    private async renderDashboard(el: HTMLElement) {
        const data = await apiGet('/dashboard');
        if (!data) { html(el, '<p class="text-danger">Failed to load dashboard.</p>'); return; }

        const s = data.server;
        const h = data.heuristics;
        const nodeNames = ['Resources', 'Production', 'Consumption', 'Trade', 'Accumulation', 'Innovation', 'Scarcity', 'Knowledge', 'Social', 'Culture', 'Politics', 'History', 'Technology'];

        html(el, `
            <h1 style="margin-bottom:20px;">Dashboard</h1>
            <div class="grid grid-4 mb-4">
                <div class="card"><div class="stat-value">${s.population}</div><div class="stat-label">Players Online</div></div>
                <div class="card"><div class="stat-value">${h.main.toFixed(1)}</div><div class="stat-label">World Pulse (Main)</div></div>
                <div class="card"><div class="stat-value">${data.nations.count}</div><div class="stat-label">Nations</div></div>
                <div class="card"><div class="stat-value">${data.social.bonds}</div><div class="stat-label">Social Bonds</div></div>
            </div>
            <div class="grid grid-2 mb-4">
                <div class="card">
                    <h3>Heuristic Nodes</h3>
                    ${h.nodes.map((v: number, i: number) => `
                        <div class="flex-between" style="margin-bottom:6px;">
                            <span style="font-size:13px;">${nodeNames[i] || `H${i}`}</span>
                            <div class="flex" style="gap:8px;">
                                <div style="width:120px; height:8px; background:var(--surface2); border-radius:4px; overflow:hidden;">
                                    <div style="width:${v}%; height:100%; background:${v > 70 ? 'var(--warning)' : v > 50 ? 'var(--accent)' : 'var(--success)'}; border-radius:4px;"></div>
                                </div>
                                <span style="font-size:12px; width:35px; text-align:right;">${v.toFixed(1)}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="card">
                    <h3>Server Info</h3>
                    <table>
                        <tr><td class="text-muted">Uptime</td><td>${formatUptime(s.uptime)}</td></tr>
                        <tr><td class="text-muted">Memory (RSS)</td><td>${(s.memoryUsage.rss / 1024 / 1024).toFixed(1)} MB</td></tr>
                        <tr><td class="text-muted">Heap Used</td><td>${(s.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)} MB</td></tr>
                        <tr><td class="text-muted">Nations</td><td>${data.nations.count}</td></tr>
                        <tr><td class="text-muted">Villages</td><td>${data.nations.villages}</td></tr>
                        <tr><td class="text-muted">Social Bonds</td><td>${data.social.bonds}</td></tr>
                        <tr><td class="text-muted">Parties</td><td>${data.social.parties}</td></tr>
                        <tr><td class="text-muted">Audit Events (24h)</td><td>${data.audit.last24h}</td></tr>
                    </table>
                    ${data.watchdog ? `
                    <h3 style="margin-top:12px;">Last Watchdog Report</h3>
                    <p class="text-muted" style="font-size:12px;">${data.watchdog.corrections?.length || 0} corrections, ${data.watchdog.violations?.length || 0} violations</p>
                    ` : ''}
                </div>
            </div>
        `);
    }

    // ─── HEURISTICS ───────────────────────────────────────────────
    private async renderHeuristics(el: HTMLElement) {
        const data = await apiGet('/heuristics');
        if (!data) return;
        const nodeNames = ['Resources', 'Production', 'Consumption', 'Trade', 'Accumulation', 'Innovation', 'Scarcity', 'Knowledge', 'Social', 'Culture', 'Politics', 'History', 'Technology'];

        html(el, `
            <h1 style="margin-bottom:20px;">Heuristic Engine (13 Nodes → 1 Main)</h1>
            <div class="card mb-4">
                <div class="stat-value" style="font-size:48px;">${data.main.toFixed(2)}</div>
                <div class="stat-label">Main World Pulse Signal</div>
            </div>
            <div class="grid grid-2 mb-4">
                ${data.nodes.map((v: number, i: number) => `
                    <div class="card flex-between">
                        <div>
                            <div style="font-weight:600;">${nodeNames[i]}</div>
                            <div class="stat-value" style="font-size:24px;">${v.toFixed(1)}</div>
                        </div>
                        <div>
                            <input type="number" id="impulse-${i}" value="5" style="width:60px; margin-right:4px;" />
                            <button onclick="window._impulse(${i})">Impulse</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);

        (window as any)._impulse = async (node: number) => {
            const input = document.getElementById(`impulse-${node}`) as HTMLInputElement;
            const amount = parseFloat(input?.value || '5');
            await apiPost('/heuristics/impulse', { node, amount });
            this.showPanel('heuristics');
        };
    }

    // ─── NATIONS ──────────────────────────────────────────────────
    private async renderNations(el: HTMLElement) {
        const data = await apiGet('/nations');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Nations & Politics</h1>
            <div class="grid grid-3 mb-4">
                ${data.nations.map((n: any) => `
                    <div class="card">
                        <div class="flex-between mb-4">
                            <h3 style="margin:0; color:${n.colour};">${n.name}</h3>
                            <span class="badge success">${n.villages.length} villages</span>
                        </div>
                        <table>
                            <tr><td class="text-muted">Power</td><td>${n.power.toFixed(0)}</td></tr>
                            <tr><td class="text-muted">Resources</td><td>${n.resources}</td></tr>
                            <tr><td class="text-muted">Culture</td><td>${n.culture.toFixed(0)}</td></tr>
                            <tr><td class="text-muted">Territory</td><td>${n.territory}</td></tr>
                        </table>
                    </div>
                `).join('')}
            </div>
            <div class="card">
                <h3>Villages</h3>
                <table>
                    <thead><tr><th>Name</th><th>Nation</th><th>Pop</th><th>Prosperity</th><th>Loyalty</th><th>Military</th></tr></thead>
                    <tbody>
                        ${data.villages.map((v: any) => `
                            <tr>
                                <td>${v.name}</td>
                                <td>${v.nationId}</td>
                                <td>${v.population}</td>
                                <td><span class="badge ${v.prosperity > 60 ? 'success' : v.prosperity > 30 ? 'warning' : 'danger'}">${v.prosperity.toFixed(0)}</span></td>
                                <td><span class="badge ${v.loyalty > 60 ? 'success' : v.loyalty > 30 ? 'warning' : 'danger'}">${v.loyalty.toFixed(0)}</span></td>
                                <td>${v.militaryStrength}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${data.relations.length > 0 ? `
            <div class="card" style="margin-top:16px;">
                <h3>Diplomatic Relations</h3>
                <table>
                    <thead><tr><th>Nation A</th><th>Nation B</th><th>Status</th><th>Tension</th><th>Trade</th></tr></thead>
                    <tbody>
                        ${data.relations.map((r: any) => `
                            <tr>
                                <td>${r.nationA}</td><td>${r.nationB}</td>
                                <td><span class="badge ${r.status === 'alliance' ? 'success' : r.status === 'war' ? 'danger' : 'warning'}">${r.status}</span></td>
                                <td>${r.tension.toFixed(0)}</td><td>${r.tradeVolume.toFixed(0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>` : ''}
        `);
    }

    // ─── SOCIAL ───────────────────────────────────────────────────
    private async renderSocial(el: HTMLElement) {
        const data = await apiGet('/social');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Social Wave System</h1>
            <div class="grid grid-3 mb-4">
                <div class="card"><div class="stat-value">${data.bonds?.length || 0}</div><div class="stat-label">Active Bonds</div></div>
                <div class="card"><div class="stat-value">${data.parties?.length || 0}</div><div class="stat-label">Parties</div></div>
                <div class="card"><div class="stat-value">${data.familyCount || 0}</div><div class="stat-label">Family Members</div></div>
            </div>
            ${data.bonds?.length > 0 ? `
            <div class="card">
                <h3>Recent Social Bonds</h3>
                <table>
                    <thead><tr><th>Entity A</th><th>Entity B</th><th>Type</th><th>Strength</th><th>Interactions</th></tr></thead>
                    <tbody>${data.bonds.slice(0, 50).map((b: any) => `
                        <tr><td>${b.entityA}</td><td>${b.entityB}</td><td><span class="badge success">${b.type}</span></td><td>${b.strength.toFixed(2)}</td><td>${b.interactions}</td></tr>
                    `).join('')}</tbody>
                </table>
            </div>` : '<div class="card"><p class="text-muted">No social bonds yet.</p></div>'}
        `);
    }

    // ─── PLAYERS ──────────────────────────────────────────────────
    private async renderPlayers(el: HTMLElement) {
        const data = await apiGet('/players');
        html(el, `
            <h1 style="margin-bottom:20px;">Online Players</h1>
            ${!data || data.length === 0 ? '<div class="card"><p class="text-muted">No players online.</p></div>' : `
            <div class="card">
                <table>
                    <thead><tr><th>Username</th><th>Position</th><th>HP</th><th>Rank</th></tr></thead>
                    <tbody>${data.map((p: any) => `
                        <tr><td>${p.username}</td><td>${p.x}, ${p.y}</td><td>${p.hitPoints}</td><td>${p.rank}</td></tr>
                    `).join('')}</tbody>
                </table>
            </div>`}
        `);
    }

    // ─── NPCs ─────────────────────────────────────────────────────
    private async renderNPCs(el: HTMLElement) {
        const data = await apiGet('/npcs');
        if (!data) return;
        const keys = Object.keys(data.definitions || {}).slice(0, 100);
        html(el, `
            <h1 style="margin-bottom:20px;">NPC Management</h1>
            <div class="grid grid-3 mb-4">
                <div class="card"><div class="stat-value">${keys.length}</div><div class="stat-label">NPC Types</div></div>
                <div class="card"><div class="stat-value">${data.totalMemories}</div><div class="stat-label">Memory Entries</div></div>
            </div>
            <div class="card">
                <h3>NPC Definitions</h3>
                <table>
                    <thead><tr><th>Key</th><th>Name</th><th>Role</th><th>Store</th><th>Dialogue Lines</th></tr></thead>
                    <tbody>${keys.map(k => {
                        const n = data.definitions[k];
                        return `<tr><td><code>${k}</code></td><td>${n.name || '-'}</td><td>${n.role || '-'}</td><td>${n.store || '-'}</td><td>${n.text?.length || 0}</td></tr>`;
                    }).join('')}</tbody>
                </table>
            </div>
            ${data.memories.length > 0 ? `
            <div class="card" style="margin-top:16px;">
                <h3>NPC Memories (Heuristic)</h3>
                <table>
                    <thead><tr><th>NPC</th><th>Memories</th><th>Nation</th><th>Village</th></tr></thead>
                    <tbody>${data.memories.slice(0, 50).map((m: any) => `
                        <tr><td>${m.npcName}</td><td>${m.memories?.length || 0}</td><td>${m.nationId || '-'}</td><td>${m.villageId || '-'}</td></tr>
                    `).join('')}</tbody>
                </table>
            </div>` : ''}
        `);
    }

    // ─── GENERIC DATA TABLE RENDERS ───────────────────────────────
    private async renderMobs(el: HTMLElement) { return this.renderDataTable(el, '/mobs', 'Mobs', ['name', 'hitPoints', 'level', 'attackLevel', 'defenseLevel', 'drops']); }
    private async renderItems(el: HTMLElement) { return this.renderDataTable(el, '/items', 'Items', ['name', 'type', 'price', 'stackable', 'edible']); }
    private async renderStores(el: HTMLElement) { return this.renderDataTable(el, '/stores', 'Stores', ['items', 'currency', 'refresh']); }

    private async renderDataTable(el: HTMLElement, endpoint: string, title: string, columns: string[]) {
        const data = await apiGet(endpoint);
        if (!data) return;
        const keys = Object.keys(data).slice(0, 150);
        html(el, `
            <h1 style="margin-bottom:20px;">${title} (${keys.length} entries)</h1>
            <div class="card">
                <div style="overflow-x:auto;">
                    <table>
                        <thead><tr><th>Key</th>${columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
                        <tbody>${keys.map(k => {
                            const item = data[k];
                            return `<tr><td><code>${k}</code></td>${columns.map(c => {
                                const v = item[c];
                                if (v === undefined || v === null) return '<td>-</td>';
                                if (Array.isArray(v)) return `<td>${v.length} items</td>`;
                                if (typeof v === 'object') return `<td>${Object.keys(v).length} props</td>`;
                                return `<td>${v}</td>`;
                            }).join('')}</tr>`;
                        }).join('')}</tbody>
                    </table>
                </div>
            </div>
        `);
    }

    // ─── QUESTS ───────────────────────────────────────────────────
    private async renderQuests(el: HTMLElement) {
        const data = await apiGet('/quests');
        if (!data) return;
        const keys = Object.keys(data);
        html(el, `
            <h1 style="margin-bottom:20px;">Quests (${keys.length})</h1>
            <div class="grid grid-2">
                ${keys.map(k => {
                    const q = data[k];
                    const stages = Object.keys(q.stages || {}).length;
                    return `
                    <div class="card">
                        <h3 style="color:var(--text); margin-bottom:4px;">${q.name || k}</h3>
                        <p class="text-muted" style="font-size:13px; margin-bottom:8px;">${q.description || ''}</p>
                        <div class="flex" style="gap:12px;">
                            <span class="badge success">${stages} stages</span>
                            ${q.rewards ? `<span class="text-muted">${q.rewards.join(', ')}</span>` : ''}
                        </div>
                    </div>`;
                }).join('')}
            </div>
        `);
    }

    // ─── WORLD GENERATOR ──────────────────────────────────────────
    private async renderWorld(el: HTMLElement) {
        const data = await apiGet('/world');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Procedural World Generator</h1>
            <div class="grid grid-3 mb-4">
                <div class="card"><div class="stat-value">${data.generatedRegions?.length || 0}</div><div class="stat-label">Generated Regions</div></div>
                <div class="card"><div class="stat-value">${data.nations?.length || 0}</div><div class="stat-label">Nations</div></div>
                <div class="card"><div class="stat-value">${data.villages?.length || 0}</div><div class="stat-label">Villages</div></div>
            </div>
            ${data.generatedRegions?.length > 0 ? `
            <div class="card">
                <h3>Generated Regions</h3>
                <table>
                    <thead><tr><th>ID</th><th>Biome</th><th>Resources</th><th>Danger</th><th>Features</th><th>Nation</th></tr></thead>
                    <tbody>${data.generatedRegions.map((r: any) => `
                        <tr><td>${r.id}</td><td><span class="badge success">${r.biome}</span></td><td>${r.resources}</td><td>${r.dangerLevel}</td><td>${r.features?.length || 0}</td><td>${r.nationId || '-'}</td></tr>
                    `).join('')}</tbody>
                </table>
            </div>` : '<div class="card"><p class="text-muted">No regions generated yet. They appear as players explore.</p></div>'}
        `);
    }

    // ─── DATA FILES ───────────────────────────────────────────────
    private async renderDataFiles(el: HTMLElement) {
        const types = ['npcs', 'mobs', 'items', 'stores', 'achievements', 'trees', 'rocks', 'fishing', 'foraging', 'spawns'];
        html(el, `
            <h1 style="margin-bottom:20px;">Game Data Files</h1>
            <p class="text-muted mb-4">Edit game data with preview → test → publish workflow. All changes are backed up automatically.</p>
            <div class="grid grid-2">
                ${types.map(t => `
                    <div class="card" style="cursor:pointer;" onclick="window._editData('${t}')">
                        <h3 style="margin:0;">📁 ${t}.json</h3>
                        <p class="text-muted" style="font-size:12px;">Click to open editor</p>
                    </div>
                `).join('')}
            </div>
            <div id="data-editor" style="margin-top:16px;"></div>
        `);

        (window as any)._editData = async (type: string) => {
            const data = await apiGet(`/data/${type}`);
            if (!data) return;
            const editor = document.getElementById('data-editor');
            if (!editor) return;
            editor.innerHTML = `
                <div class="card">
                    <div class="flex-between mb-4">
                        <h3 style="margin:0;">Editing: ${type}.json ${data.hasPreview ? '<span class="badge warning">Has staged changes</span>' : ''}</h3>
                        <div class="flex">
                            <button onclick="window._saveData('${type}')">💾 Stage Changes</button>
                            <button onclick="window._publishData('${type}')" class="btn" style="background:var(--success);">🚀 Publish</button>
                        </div>
                    </div>
                    <textarea id="data-content" style="width:100%; height:500px; font-family:monospace; font-size:13px;">${JSON.stringify(data.content, null, 2)}</textarea>
                </div>
            `;
        };

        (window as any)._saveData = async (type: string) => {
            const textarea = document.getElementById('data-content') as HTMLTextAreaElement;
            try {
                const content = JSON.parse(textarea.value);
                await apiPut(`/data/${type}`, { content });
                alert('Changes staged! Click Publish to apply.');
            } catch (e) {
                alert('Invalid JSON!');
            }
        };

        (window as any)._publishData = async (type: string) => {
            if (!confirm(`Publish changes to ${type}.json? A backup will be created.`)) return;
            await apiPost(`/data/${type}/publish`);
            alert('Published!');
        };
    }

    // ─── CODE EDITOR ──────────────────────────────────────────────
    private async renderCodeEditor(el: HTMLElement) {
        const data = await apiGet('/files');
        if (!data) return;
        const files = data.files as string[];
        const dirs: Record<string, string[]> = {};
        for (const f of files) {
            const dir = f.includes('/') ? f.substring(0, f.lastIndexOf('/')) : '.';
            if (!dirs[dir]) dirs[dir] = [];
            dirs[dir].push(f);
        }

        html(el, `
            <h1 style="margin-bottom:20px;">Code Editor (Live Preview → Publish)</h1>
            <div style="display:grid; grid-template-columns:250px 1fr; gap:16px;">
                <div class="card" style="max-height:80vh; overflow-y:auto;">
                    <h3>Files</h3>
                    ${Object.entries(dirs).sort().map(([dir, files]) => `
                        <details ${dir === '.' ? 'open' : ''}>
                            <summary style="cursor:pointer; padding:4px; font-size:13px; color:var(--accent);">${dir}/</summary>
                            ${files.map(f => `<div class="file-item" data-file="${f}" style="padding:3px 8px; font-size:12px; cursor:pointer; border-radius:4px;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${f.split('/').pop()}</div>`).join('')}
                        </details>
                    `).join('')}
                </div>
                <div id="code-area">
                    <div class="card"><p class="text-muted">Select a file to edit.</p></div>
                </div>
            </div>
        `);

        el.querySelectorAll('.file-item').forEach(item => {
            item.addEventListener('click', async () => {
                const filePath = (item as HTMLElement).dataset.file;
                const file = await apiGet(`/files/${filePath}`);
                if (!file) return;
                const area = document.getElementById('code-area');
                if (!area) return;
                area.innerHTML = `
                    <div class="card">
                        <div class="flex-between mb-4">
                            <code>${file.path}</code>
                            <div class="flex">
                                <button onclick="window._stageFile('${filePath}')">💾 Stage</button>
                                <button onclick="window._publishFile('${filePath}')" style="background:var(--success);">🚀 Publish</button>
                            </div>
                        </div>
                        <textarea id="code-content" style="width:100%; height:65vh; font-family:monospace; font-size:13px; tab-size:4;">${escapeHtml(file.content)}</textarea>
                    </div>
                `;
            });
        });

        (window as any)._stageFile = async (path: string) => {
            const textarea = document.getElementById('code-content') as HTMLTextAreaElement;
            await apiPut(`/files/${path}`, { content: textarea.value });
            alert('File staged!');
        };

        (window as any)._publishFile = async (path: string) => {
            if (!confirm(`Publish changes to ${path}? A backup will be created.`)) return;
            // Need to stage first if not already
            const textarea = document.getElementById('code-content') as HTMLTextAreaElement;
            await apiPut(`/files/${path}`, { content: textarea.value });
            await apiPost(`/files/${path}/publish`);
            alert('Published!');
        };
    }

    // ─── ASSETS ───────────────────────────────────────────────────
    private async renderAssets(el: HTMLElement) {
        html(el, `
            <h1 style="margin-bottom:20px;">Asset Management</h1>
            <p class="text-muted mb-4">Manage game assets: sprites, textures, audio, UI elements. Assets are stored in the client data directory.</p>
            <div class="grid grid-3 mb-4">
                <div class="card" style="cursor:pointer;" onclick="window._browseAssets('sprites')">
                    <h3>🎨 Sprites</h3><p class="text-muted">Character, NPC, mob sprites</p>
                </div>
                <div class="card" style="cursor:pointer;" onclick="window._browseAssets('audio')">
                    <h3>🔊 Audio</h3><p class="text-muted">Music and sound effects</p>
                </div>
                <div class="card" style="cursor:pointer;" onclick="window._browseAssets('maps')">
                    <h3>🗺️ Maps</h3><p class="text-muted">Tiled map data</p>
                </div>
            </div>
            <div class="card">
                <h3>Asset Pipeline</h3>
                <p class="text-muted">The asset pipeline supports:</p>
                <ul style="margin:8px 0; padding-left:20px; color:var(--text2);">
                    <li>GLB/GLTF import with Three.js integration</li>
                    <li>Texture optimization and format conversion</li>
                    <li>Sprite sheet generation and tagging</li>
                    <li>Audio format validation (OGG, MP3, WAV)</li>
                    <li>UI asset categorization and dependency tracking</li>
                    <li>Duplicate detection and reference checking</li>
                    <li>License validation for open-source assets</li>
                </ul>
                <p class="text-muted" style="margin-top:8px;">Upload assets through the file manager or import from open libraries.</p>
            </div>
            <div id="asset-browser"></div>
        `);

        (window as any)._browseAssets = (category: string) => {
            const browser = document.getElementById('asset-browser');
            if (!browser) return;
            browser.innerHTML = `
                <div class="card">
                    <h3>${category} Assets</h3>
                    <p class="text-muted">Asset browser for ${category} category. Use the Data Files panel to view and edit asset configuration files.</p>
                </div>
            `;
        };
    }

    // ─── BACKUPS ──────────────────────────────────────────────────
    private async renderBackups(el: HTMLElement) {
        const data = await apiGet('/backups');
        html(el, `
            <h1 style="margin-bottom:20px;">Backups & Rollback</h1>
            <div class="flex mb-4">
                <button onclick="window._createBackup()">💾 Create Backup Now</button>
            </div>
            <div class="card">
                <h3>Backup History</h3>
                ${!data || data.length === 0 ? '<p class="text-muted">No backups yet.</p>' : `
                <table>
                    <thead><tr><th>ID</th><th>Date</th><th>Description</th><th>Files</th><th>Size</th><th>Actions</th></tr></thead>
                    <tbody>${data.map((b: any) => `
                        <tr>
                            <td><code>${b.id.substring(0, 20)}</code></td>
                            <td>${new Date(b.timestamp).toLocaleString()}</td>
                            <td>${b.description}</td>
                            <td>${b.files.length}</td>
                            <td>${(b.size / 1024).toFixed(1)} KB</td>
                            <td><button class="danger" style="font-size:12px; padding:4px 8px;" onclick="window._rollback('${b.id}')">Rollback</button></td>
                        </tr>
                    `).join('')}</tbody>
                </table>`}
            </div>
        `);

        (window as any)._createBackup = async () => {
            await apiPost('/backups', { description: 'Manual admin backup' });
            this.showPanel('backups');
        };

        (window as any)._rollback = async (id: string) => {
            if (!confirm(`Rollback to backup ${id}? This will overwrite current files.`)) return;
            await apiPost(`/backups/${id}/rollback`);
            alert('Rollback complete!');
        };
    }

    // ─── PERFORMANCE ──────────────────────────────────────────────
    private async renderPerformance(el: HTMLElement) {
        const data = await apiGet('/performance');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Performance Monitor</h1>
            <div class="grid grid-4 mb-4">
                <div class="card"><div class="stat-value">${formatUptime(data.uptime)}</div><div class="stat-label">Uptime</div></div>
                <div class="card"><div class="stat-value">${data.memory.heapUsed}</div><div class="stat-label">Heap Used</div></div>
                <div class="card"><div class="stat-value">${data.memory.rss}</div><div class="stat-label">RSS Memory</div></div>
                <div class="card"><div class="stat-value">${data.population}</div><div class="stat-label">Players</div></div>
            </div>
            <div class="card">
                <h3>Memory Breakdown</h3>
                <table>
                    <tr><td class="text-muted">Heap Used</td><td>${data.memory.heapUsed}</td></tr>
                    <tr><td class="text-muted">Heap Total</td><td>${data.memory.heapTotal}</td></tr>
                    <tr><td class="text-muted">RSS</td><td>${data.memory.rss}</td></tr>
                    <tr><td class="text-muted">External</td><td>${data.memory.external}</td></tr>
                </table>
            </div>
            <div class="card" style="margin-top:16px;">
                <h3>Entity Counts</h3>
                <table>
                    <tr><td class="text-muted">Players</td><td>${data.entities.players}</td></tr>
                    <tr><td class="text-muted">NPC Memories</td><td>${data.entities.npcMemories}</td></tr>
                </table>
            </div>
        `);
    }

    // ─── ERROR LOG ────────────────────────────────────────────────
    private async renderErrors(el: HTMLElement) {
        const data = await apiGet('/errors');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Error & Watchdog Log</h1>
            <div class="card">
                ${data.reports.length === 0 ? '<p class="text-muted">No watchdog reports yet.</p>' : `
                <table>
                    <thead><tr><th>Time</th><th>Corrections</th><th>Violations</th></tr></thead>
                    <tbody>${data.reports.reverse().map((r: any) => `
                        <tr>
                            <td>${new Date(r.timestamp).toLocaleString()}</td>
                            <td>${r.corrections?.map((c: string) => `<div style="font-size:12px;">${c}</div>`).join('') || '-'}</td>
                            <td>${r.violations?.length || 0}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>`}
            </div>
        `);
    }

    // ─── AUDIT LOG ────────────────────────────────────────────────
    private async renderAudit(el: HTMLElement) {
        const data = await apiGet('/audit');
        if (!data) return;
        html(el, `
            <h1 style="margin-bottom:20px;">Audit Log</h1>
            <div class="card">
                ${data.length === 0 ? '<p class="text-muted">No audit entries yet.</p>' : `
                <table>
                    <thead><tr><th>Time</th><th>Category</th><th>Action</th><th>Details</th><th>IP</th><th>Status</th></tr></thead>
                    <tbody>${data.reverse().map((a: any) => `
                        <tr>
                            <td style="font-size:12px;">${new Date(a.timestamp).toLocaleString()}</td>
                            <td><span class="badge success">${a.category}</span></td>
                            <td>${a.action}</td>
                            <td style="font-size:12px; max-width:300px; overflow:hidden; text-overflow:ellipsis;">${a.details}</td>
                            <td style="font-size:12px;">${a.ip}</td>
                            <td>${a.success ? '<span class="badge success">OK</span>' : '<span class="badge danger">FAIL</span>'}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>`}
            </div>
        `);
    }
}

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────
function showLogin() {
    show($('#login-screen'));
    hide($('#admin-app'));
}

function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.addEventListener('load', () => new AdminApp());
