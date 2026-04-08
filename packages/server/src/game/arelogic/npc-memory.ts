/**
 * NPC Heuristic Memory Engine
 *
 * Every NPC maintains a memory of interactions with players and
 * world events. Memory entries decay over time but strong
 * impressions persist. The memory feeds into dialogue generation
 * and behavioural decisions.
 */

import { HNode } from './heuristic.engine';

import type HeuristicEngine from './heuristic.engine';

export interface MemoryEntry {
    playerId: string;
    playerName: string;
    event: MemoryEventType;
    detail: string;
    sentiment: number; // -1 (hostile) to 1 (friendly)
    strength: number;  // 0-1, decays over time
    timestamp: number;
}

export type MemoryEventType =
    | 'talk'
    | 'trade'
    | 'gift'
    | 'attack'
    | 'quest_complete'
    | 'quest_fail'
    | 'nearby'
    | 'world_event'
    | 'political'
    | 'social';

export interface NPCPersonality {
    friendliness: number;  // 0-1
    curiosity: number;     // 0-1
    aggression: number;    // 0-1
    loyalty: number;       // 0-1
    wisdom: number;        // 0-1
}

const DEFAULT_PERSONALITY: NPCPersonality = {
    friendliness: 0.6,
    curiosity: 0.5,
    aggression: 0.2,
    loyalty: 0.5,
    wisdom: 0.4
};

export default class NPCMemory {
    public memories: MemoryEntry[] = [];
    public personality: NPCPersonality;
    public npcId: string;
    public npcName: string;
    public nationId = '';
    public villageId = '';

    private maxMemories = 200;

    public constructor(npcId: string, npcName: string, personality?: Partial<NPCPersonality>) {
        this.npcId = npcId;
        this.npcName = npcName;
        this.personality = { ...DEFAULT_PERSONALITY, ...personality };
    }

    /** Record a new memory. */
    public remember(entry: Omit<MemoryEntry, 'timestamp'>): void {
        this.memories.push({ ...entry, timestamp: Date.now() });
        if (this.memories.length > this.maxMemories) this.memories.shift();
    }

    /** Decay old memories — called each world tick. */
    public decay(rate = 0.002): void {
        for (const m of this.memories) {
            m.strength -= rate;
        }
        this.memories = this.memories.filter((m) => m.strength > 0.01);
    }

    /** Get all memories related to a specific player, sorted strongest first. */
    public getPlayerMemories(playerId: string): MemoryEntry[] {
        return this.memories
            .filter((m) => m.playerId === playerId)
            .sort((a, b) => b.strength - a.strength);
    }

    /** Overall sentiment towards a player (-1 to 1). */
    public getSentiment(playerId: string): number {
        const mems = this.getPlayerMemories(playerId);
        if (mems.length === 0) return 0;
        let total = 0,
            weight = 0;
        for (const m of mems) {
            total += m.sentiment * m.strength;
            weight += m.strength;
        }
        return weight > 0 ? total / weight : 0;
    }

    /**
     * Generate context-aware dialogue based on memory + world heuristics.
     * Returns a string the NPC would say to the given player.
     */
    public generateDialogue(playerId: string, playerName: string, heuristics: HeuristicEngine): string {
        const sentiment = this.getSentiment(playerId);
        const mems = this.getPlayerMemories(playerId);
        const politics = heuristics.get(HNode.Politics);
        const social = heuristics.get(HNode.Social);
        const scarcity = heuristics.get(HNode.Scarcity);
        const culture = heuristics.get(HNode.Culture);
        const trade = heuristics.get(HNode.TradeVelocity);

        const lines: string[] = [];

        // Greeting based on memory
        if (mems.length === 0) {
            lines.push(
                this.personality.friendliness > 0.5
                    ? `Welcome, traveler ${playerName}. I have not seen you before.`
                    : `Hmm, a stranger. What do you want?`
            );
        } else if (sentiment > 0.5) {
            lines.push(`${playerName}! Good to see you again, friend.`);
        } else if (sentiment < -0.3) {
            lines.push(`You again, ${playerName}... I remember what you did.`);
        } else {
            lines.push(`Ah, ${playerName}. Back so soon?`);
        }

        // World-state commentary
        if (politics > 70) {
            lines.push('The political tensions are rising. Choose your allies wisely.');
        } else if (politics < 30) {
            lines.push('These are peaceful times. Enjoy them while they last.');
        }

        if (scarcity > 65) {
            lines.push('Resources are scarce. The land grows barren.');
        }

        if (trade > 70) {
            lines.push('The markets are bustling! Good time to trade.');
        }

        if (culture > 75 && this.personality.wisdom > 0.5) {
            lines.push('Our culture flourishes. The arts and stories of our people shine bright.');
        }

        if (social > 70 && this.personality.curiosity > 0.5) {
            lines.push('The social bonds between people grow stronger each day.');
        }

        // Village/Nation pride
        if (this.villageId) {
            lines.push(`I am proud to call ${this.villageId} my home.`);
        }

        return lines[Math.floor(Math.random() * lines.length)] || 'Greetings.';
    }

    /** Serialize for persistence. */
    public serialize(): object {
        return {
            npcId: this.npcId,
            npcName: this.npcName,
            personality: this.personality,
            nationId: this.nationId,
            villageId: this.villageId,
            memories: this.memories.slice(-50) // keep last 50 for storage
        };
    }

    /** Restore from persisted data. */
    public deserialize(data: any): void {
        if (data.personality) this.personality = data.personality;
        if (data.nationId) this.nationId = data.nationId;
        if (data.villageId) this.villageId = data.villageId;
        if (data.memories) this.memories = data.memories;
    }
}
