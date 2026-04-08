/**
 * Nation & Village System with Political Recursion
 *
 * The world is divided into nations, each composed of villages.
 * Nations have political relationships (alliance, rivalry, war, neutral).
 * Villages have local economies, populations, and loyalty.
 *
 * The recursion system means that political actions create feedback loops:
 *   War → Scarcity ↑ → Politics ↑ → More War (or Revolution)
 *   Peace → Trade ↑ → Accumulation ↑ → Social Stratification → Politics ↑
 *
 * Villages can secede, nations can merge, and new ones can form.
 */

import { HNode } from './heuristic.engine';

import type HeuristicEngine from './heuristic.engine';

export type DiplomaticStatus = 'alliance' | 'neutral' | 'rivalry' | 'war';

export interface Village {
    id: string;
    name: string;
    nationId: string;
    population: number;
    prosperity: number;    // 0-100
    loyalty: number;       // 0-100 towards nation
    x: number;
    y: number;
    resources: number;
    culture: number;
    militaryStrength: number;
}

export interface Nation {
    id: string;
    name: string;
    villages: string[];    // village IDs
    territory: number;     // total controlled tiles
    resources: number;
    knowledge: number;
    power: number;         // military + political
    culture: number;
    foundedAt: number;
    colour: string;
}

export interface DiplomaticRelation {
    nationA: string;
    nationB: string;
    status: DiplomaticStatus;
    tension: number;       // 0-100
    tradeVolume: number;
    since: number;
}

export default class NationSystem {
    public nations: Map<string, Nation> = new Map();
    public villages: Map<string, Village> = new Map();
    public relations: DiplomaticRelation[] = [];

    private nextId = 1;

    public constructor(private heuristics: HeuristicEngine) {}

    /** Create a new nation. */
    public createNation(name: string, colour: string): Nation {
        const nation: Nation = {
            id: `nation_${this.nextId++}`,
            name,
            villages: [],
            territory: 0,
            resources: 50,
            knowledge: 30,
            power: 20,
            culture: 40,
            foundedAt: Date.now(),
            colour
        };
        this.nations.set(nation.id, nation);
        return nation;
    }

    /** Create a village belonging to a nation. */
    public createVillage(name: string, nationId: string, x: number, y: number): Village {
        const village: Village = {
            id: `village_${this.nextId++}`,
            name,
            nationId,
            population: 20 + Math.floor(Math.random() * 80),
            prosperity: 50,
            loyalty: 70 + Math.floor(Math.random() * 30),
            x,
            y,
            resources: 30 + Math.floor(Math.random() * 40),
            culture: 30 + Math.floor(Math.random() * 30),
            militaryStrength: 10 + Math.floor(Math.random() * 20)
        };
        this.villages.set(village.id, village);
        const nation = this.nations.get(nationId);
        if (nation) nation.villages.push(village.id);
        return village;
    }

    /** Set diplomatic relations between two nations. */
    public setRelation(nationA: string, nationB: string, status: DiplomaticStatus): void {
        const existing = this.getRelation(nationA, nationB);
        if (existing) {
            existing.status = status;
            existing.since = Date.now();
            return;
        }
        this.relations.push({
            nationA,
            nationB,
            status,
            tension: status === 'war' ? 90 : status === 'rivalry' ? 60 : 20,
            tradeVolume: status === 'alliance' ? 50 : 10,
            since: Date.now()
        });
    }

    public getRelation(a: string, b: string): DiplomaticRelation | undefined {
        return this.relations.find(
            (r) => (r.nationA === a && r.nationB === b) || (r.nationA === b && r.nationB === a)
        );
    }

    /**
     * Main political recursion tick.
     * Processes feedback loops between heuristics and political state.
     */
    public tick(): void {
        const politics = this.heuristics.get(HNode.Politics);
        const trade = this.heuristics.get(HNode.TradeVelocity);
        const social = this.heuristics.get(HNode.Social);
        const scarcity = this.heuristics.get(HNode.Scarcity);

        // Update diplomatic tensions
        for (const rel of this.relations) {
            // War creates scarcity and political pressure
            if (rel.status === 'war') {
                rel.tension = Math.min(100, rel.tension + 2);
                this.heuristics.impulse(HNode.Scarcity, 0.5);
                this.heuristics.impulse(HNode.Politics, 0.3);
            }

            // Alliance boosts trade
            if (rel.status === 'alliance') {
                rel.tradeVolume = Math.min(100, rel.tradeVolume + 1);
                this.heuristics.impulse(HNode.TradeVelocity, 0.2);
                rel.tension = Math.max(0, rel.tension - 1);
            }

            // Rivalry escalation based on politics
            if (rel.status === 'rivalry' && politics > 70) {
                rel.tension += 3;
                if (rel.tension > 85) {
                    rel.status = 'war';
                    this.heuristics.impulse(HNode.Politics, 5);
                }
            }

            // De-escalation in peaceful times
            if (rel.status === 'war' && politics < 30 && social > 60) {
                rel.tension -= 2;
                if (rel.tension < 20) {
                    rel.status = 'rivalry';
                }
            }
        }

        // Update villages
        for (const [, village] of this.villages) {
            // Prosperity affected by trade and scarcity
            village.prosperity += (trade - 50) * 0.02 - (scarcity - 50) * 0.03;
            village.prosperity = clamp(village.prosperity, 0, 100);

            // Loyalty affected by prosperity and politics
            if (village.prosperity < 30) village.loyalty -= 0.5;
            if (village.prosperity > 70) village.loyalty += 0.3;
            if (politics > 75) village.loyalty -= 0.3;
            village.loyalty = clamp(village.loyalty, 0, 100);

            // Culture growth
            village.culture += (social - 50) * 0.01;
            village.culture = clamp(village.culture, 0, 100);

            // Secession check — low loyalty triggers independence
            if (village.loyalty < 15 && village.population > 30) {
                this.secedeVillage(village);
            }
        }

        // Update nations
        for (const [, nation] of this.nations) {
            this.updateNation(nation);
        }
    }

    /** Village secedes from its nation, forming a new independent nation. */
    private secedeVillage(village: Village): void {
        const oldNation = this.nations.get(village.nationId);
        if (oldNation) {
            oldNation.villages = oldNation.villages.filter((v) => v !== village.id);
        }

        const newNation = this.createNation(
            `Free ${village.name}`,
            '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        );
        village.nationId = newNation.id;
        village.loyalty = 80;
        newNation.villages.push(village.id);

        // Set rivalry with former nation
        if (oldNation) this.setRelation(newNation.id, oldNation.id, 'rivalry');

        this.heuristics.impulse(HNode.Politics, 5);
        this.heuristics.impulse(HNode.Social, 3);
    }

    /** Recompute aggregate nation stats from its villages. */
    private updateNation(nation: Nation): void {
        let totalPop = 0,
            totalRes = 0,
            totalMil = 0,
            totalCulture = 0;
        for (const vid of nation.villages) {
            const v = this.villages.get(vid);
            if (!v) continue;
            totalPop += v.population;
            totalRes += v.resources;
            totalMil += v.militaryStrength;
            totalCulture += v.culture;
        }
        nation.resources = totalRes;
        nation.power = totalMil + totalPop * 0.1;
        nation.culture = nation.villages.length > 0 ? totalCulture / nation.villages.length : 0;
        nation.territory = nation.villages.length * 10;
    }

    public getNation(id: string): Nation | undefined {
        return this.nations.get(id);
    }

    public getVillage(id: string): Village | undefined {
        return this.villages.get(id);
    }

    public getVillagesOfNation(nationId: string): Village[] {
        const nation = this.nations.get(nationId);
        if (!nation) return [];
        return nation.villages.map((vid) => this.villages.get(vid)!).filter(Boolean);
    }

    public getAllNations(): Nation[] {
        return [...this.nations.values()];
    }

    public getAllVillages(): Village[] {
        return [...this.villages.values()];
    }

    public serialize(): object {
        return {
            nations: [...this.nations.entries()],
            villages: [...this.villages.entries()],
            relations: this.relations
        };
    }

    public deserialize(data: any): void {
        if (data.nations) this.nations = new Map(data.nations);
        if (data.villages) this.villages = new Map(data.villages);
        if (data.relations) this.relations = data.relations;
    }
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}
