/**
 * Procedural Endless World Generator
 *
 * Generates new world regions on-demand as players explore beyond
 * the existing map. Uses simplex-like noise combined with heuristic
 * state to create biome-appropriate terrain that reacts to the
 * social and political state of the world.
 *
 * The generator produces "region descriptors" — metadata about
 * generated areas that the existing map/region system can
 * incorporate without replacing the core Tiled-based map.
 */

import { HNode } from './heuristic.engine';

import type HeuristicEngine from './heuristic.engine';
import type NationSystem from './nations';

export type Biome = 'plains' | 'forest' | 'desert' | 'mountains' | 'swamp' | 'tundra' | 'ruins' | 'enchanted';

export interface GeneratedRegion {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    biome: Biome;
    resources: number;
    dangerLevel: number;
    nationId?: string;
    villageId?: string;
    discoveredBy?: string;
    discoveredAt?: number;
    features: RegionFeature[];
}

export interface RegionFeature {
    type: 'village' | 'ruin' | 'dungeon' | 'shrine' | 'trading_post' | 'fortress' | 'oasis';
    x: number;
    y: number;
    name: string;
    data?: Record<string, unknown>;
}

export default class WorldGenerator {
    private generated: Map<string, GeneratedRegion> = new Map();
    private seed: number;
    private regionSize = 64; // tiles per generated region

    public constructor(
        private heuristics: HeuristicEngine,
        private nations: NationSystem,
        seed?: number
    ) {
        this.seed = seed || Math.floor(Math.random() * 1_000_000);
    }

    /** Generate (or retrieve cached) region at world coordinates. */
    public getRegion(regionX: number, regionY: number): GeneratedRegion {
        const key = `${regionX}_${regionY}`;
        const cached = this.generated.get(key);
        if (cached) return cached;

        const region = this.generate(regionX, regionY);
        this.generated.set(key, region);
        return region;
    }

    /** Core procedural generation. */
    private generate(rx: number, ry: number): GeneratedRegion {
        const noise = this.noise(rx, ry);
        const biome = this.determineBiome(rx, ry, noise);
        const resources = this.determineResources(biome, noise);
        const dangerLevel = this.determineDanger(biome, noise);
        const features = this.generateFeatures(rx, ry, biome, noise);

        // Nearest nation claims territory
        let nationId: string | undefined;
        let closestDist = Infinity;
        for (const nation of this.nations.getAllNations()) {
            for (const village of this.nations.getVillagesOfNation(nation.id)) {
                const dx = village.x - rx * this.regionSize;
                const dy = village.y - ry * this.regionSize;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < closestDist && dist < 200) {
                    closestDist = dist;
                    nationId = nation.id;
                }
            }
        }

        return {
            id: `region_${rx}_${ry}`,
            x: rx * this.regionSize,
            y: ry * this.regionSize,
            width: this.regionSize,
            height: this.regionSize,
            biome,
            resources,
            dangerLevel,
            nationId,
            features
        };
    }

    /** Simple deterministic noise function. */
    private noise(x: number, y: number): number {
        const n = Math.sin(x * 127.1 + y * 311.7 + this.seed) * 43758.5453;
        return n - Math.floor(n);
    }

    private noise2(x: number, y: number, offset: number): number {
        return this.noise(x + offset * 17.3, y + offset * 31.1);
    }

    /** Determine biome based on position noise + heuristic state. */
    private determineBiome(rx: number, ry: number, n: number): Biome {
        const scarcity = this.heuristics.get(HNode.Scarcity);
        const culture = this.heuristics.get(HNode.Culture);
        const technology = this.heuristics.get(HNode.Technology);
        const history = this.heuristics.get(HNode.History);

        // High history regions spawn ruins
        if (history > 70 && n > 0.85) return 'ruins';

        // High culture + technology → enchanted
        if (culture > 70 && technology > 60 && n > 0.8) return 'enchanted';

        // Scarcity affects biomes towards desert/tundra
        if (scarcity > 60 && n < 0.3) return 'desert';
        if (scarcity > 70 && n > 0.7) return 'tundra';

        // Standard biome distribution
        if (n < 0.2) return 'swamp';
        if (n < 0.4) return 'forest';
        if (n < 0.6) return 'plains';
        if (n < 0.8) return 'mountains';
        return 'forest';
    }

    /** Resources available in this region. */
    private determineResources(biome: Biome, noise: number): number {
        const base: Record<Biome, number> = {
            plains: 60,
            forest: 70,
            desert: 20,
            mountains: 50,
            swamp: 40,
            tundra: 15,
            ruins: 30,
            enchanted: 80
        };
        const resourceInflux = this.heuristics.get(HNode.ResourceInflux);
        return Math.floor(base[biome] * (0.5 + noise * 0.5) * (resourceInflux / 50));
    }

    private determineDanger(biome: Biome, noise: number): number {
        const base: Record<Biome, number> = {
            plains: 10,
            forest: 30,
            desert: 40,
            mountains: 50,
            swamp: 45,
            tundra: 35,
            ruins: 70,
            enchanted: 55
        };
        const politics = this.heuristics.get(HNode.Politics);
        return Math.min(100, Math.floor(base[biome] + noise * 20 + (politics - 50) * 0.3));
    }

    /** Place features in the region. */
    private generateFeatures(rx: number, ry: number, biome: Biome, noise: number): RegionFeature[] {
        const features: RegionFeature[] = [];
        const n2 = this.noise2(rx, ry, 1);
        const n3 = this.noise2(rx, ry, 2);

        // Villages spawn in plains and forest
        if ((biome === 'plains' || biome === 'forest') && n2 > 0.7) {
            features.push({
                type: 'village',
                x: Math.floor(n2 * this.regionSize),
                y: Math.floor(n3 * this.regionSize),
                name: this.generateVillageName(rx, ry)
            });
        }

        // Ruins in ruins biome or randomly
        if (biome === 'ruins' || (noise > 0.9 && n2 > 0.8)) {
            features.push({
                type: 'ruin',
                x: Math.floor(n3 * this.regionSize),
                y: Math.floor(noise * this.regionSize),
                name: `Ancient Ruins of ${this.generateAncientName(rx, ry)}`
            });
        }

        // Dungeons in mountains and swamps
        if ((biome === 'mountains' || biome === 'swamp') && n3 > 0.75) {
            features.push({
                type: 'dungeon',
                x: Math.floor(n2 * this.regionSize),
                y: Math.floor(n3 * this.regionSize),
                name: `The ${biome === 'mountains' ? 'Deep Cavern' : 'Murky Depths'}`
            });
        }

        // Shrines in enchanted areas
        if (biome === 'enchanted' && n2 > 0.5) {
            features.push({
                type: 'shrine',
                x: Math.floor(this.regionSize / 2),
                y: Math.floor(this.regionSize / 2),
                name: 'Arcane Shrine'
            });
        }

        // Trading posts along trade routes (high trade velocity)
        if (this.heuristics.get(HNode.TradeVelocity) > 60 && n3 > 0.8) {
            features.push({
                type: 'trading_post',
                x: Math.floor(n2 * this.regionSize),
                y: Math.floor(noise * this.regionSize),
                name: 'Crossroads Market'
            });
        }

        return features;
    }

    private generateVillageName(rx: number, ry: number): string {
        const prefixes = ['Oak', 'Iron', 'Silver', 'Golden', 'Shadow', 'Storm', 'Moon', 'Sun', 'Crystal', 'Ember'];
        const suffixes = ['haven', 'stead', 'ford', 'bridge', 'vale', 'hollow', 'reach', 'watch', 'grove', 'field'];
        const pi = Math.abs(Math.floor(this.noise(rx * 3, ry * 7) * prefixes.length));
        const si = Math.abs(Math.floor(this.noise(rx * 11, ry * 3) * suffixes.length));
        return prefixes[pi % prefixes.length] + suffixes[si % suffixes.length];
    }

    private generateAncientName(rx: number, ry: number): string {
        const names = ['Kaelor', 'Thranduil', 'Zarath', 'Meridian', 'Voxheim', 'Astralis', 'Umbra', 'Solaris'];
        const i = Math.abs(Math.floor(this.noise(rx * 13, ry * 17) * names.length));
        return names[i % names.length];
    }

    public getGeneratedRegions(): GeneratedRegion[] {
        return [...this.generated.values()];
    }

    public serialize(): object {
        return {
            seed: this.seed,
            generated: [...this.generated.entries()]
        };
    }

    public deserialize(data: any): void {
        if (data.seed) this.seed = data.seed;
        if (data.generated) this.generated = new Map(data.generated);
    }
}
