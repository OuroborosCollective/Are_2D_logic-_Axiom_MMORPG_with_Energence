/**
 * World Chat System
 *
 * Extends the base chat with channels (global, local, faction, trade, world)
 * and allows NPCs to participate in chat based on their memory and heuristic state.
 *
 * Chat channels:
 *  - global: all players, existing behaviour
 *  - local: region-based, existing behaviour
 *  - faction: nation members only
 *  - trade: economy-focused channel
 *  - world: system + NPC announcements driven by heuristics
 */

import type HeuristicEngine from './heuristic.engine';
import type NPCMemory from './npc-memory';
import { HNode } from './heuristic.engine';

export type ChatChannel = 'global' | 'local' | 'faction' | 'trade' | 'world';

export interface WorldChatMessage {
    channel: ChatChannel;
    source: string;        // player name or NPC name
    sourceId: string;      // player/NPC instance
    message: string;
    colour: string;
    isNPC: boolean;
    nationId?: string;     // for faction chat
    timestamp: number;
}

export default class WorldChat {
    private messageLog: WorldChatMessage[] = [];
    private maxLog = 500;
    private npcChatCooldown = 30_000; // NPCs chat at most every 30s
    private lastNPCChat = 0;

    public constructor(private heuristics: HeuristicEngine) {}

    /** Create a player chat message for a specific channel. */
    public createPlayerMessage(
        source: string,
        sourceId: string,
        message: string,
        channel: ChatChannel,
        colour = '',
        nationId?: string
    ): WorldChatMessage {
        const msg: WorldChatMessage = {
            channel,
            source,
            sourceId,
            message,
            colour: colour || this.getChannelColour(channel),
            isNPC: false,
            nationId,
            timestamp: Date.now()
        };
        this.log(msg);
        return msg;
    }

    /**
     * Generate NPC chat participation. Called periodically.
     * NPCs may comment on world events, respond to recent player messages,
     * or share observations based on their memory.
     */
    public generateNPCChat(npcMemories: NPCMemory[]): WorldChatMessage | null {
        const now = Date.now();
        if (now - this.lastNPCChat < this.npcChatCooldown) return null;

        const politics = this.heuristics.get(HNode.Politics);
        const trade = this.heuristics.get(HNode.TradeVelocity);
        const scarcity = this.heuristics.get(HNode.Scarcity);
        const social = this.heuristics.get(HNode.Social);
        const culture = this.heuristics.get(HNode.Culture);

        // Pick a random NPC with memories to speak
        const candidates = npcMemories.filter((m) => m.memories.length > 0);
        if (candidates.length === 0) return null;

        const npc = candidates[Math.floor(Math.random() * candidates.length)];
        let message = '';

        // Heuristic-driven commentary
        if (politics > 75) {
            message = `${npc.npcName} mutters: "These political tensions worry me..."`;
        } else if (scarcity > 70) {
            message = `${npc.npcName} says: "Resources are dwindling. We must prepare."`;
        } else if (trade > 70) {
            message = `${npc.npcName} announces: "Come trade at ${npc.villageId || 'the market'}! Business is good."`;
        } else if (culture > 75) {
            message = `${npc.npcName} recites: "In times like these, our stories keep us strong."`;
        } else if (social > 70) {
            message = `${npc.npcName} observes: "The bonds between people grow stronger each day."`;
        } else {
            // General observation from memory
            const recentMemory = npc.memories[npc.memories.length - 1];
            if (recentMemory) {
                message = `${npc.npcName} recalls: "I remember when ${recentMemory.playerName} ${recentMemory.event === 'talk' ? 'visited' : recentMemory.event === 'trade' ? 'traded with me' : 'passed through'}..."`;
            } else {
                message = `${npc.npcName} says: "Another quiet day in the world."`;
            }
        }

        this.lastNPCChat = now;

        const msg: WorldChatMessage = {
            channel: 'world',
            source: npc.npcName,
            sourceId: npc.npcId,
            message,
            colour: '#aaddff',
            isNPC: true,
            timestamp: now
        };

        this.log(msg);
        return msg;
    }

    /** Get recent messages for a channel. */
    public getMessages(channel?: ChatChannel, limit = 50): WorldChatMessage[] {
        let msgs = channel
            ? this.messageLog.filter((m) => m.channel === channel)
            : this.messageLog;
        return msgs.slice(-limit);
    }

    /** Get faction-specific messages. */
    public getFactionMessages(nationId: string, limit = 50): WorldChatMessage[] {
        return this.messageLog
            .filter((m) => m.channel === 'faction' && m.nationId === nationId)
            .slice(-limit);
    }

    private log(msg: WorldChatMessage): void {
        this.messageLog.push(msg);
        if (this.messageLog.length > this.maxLog) {
            this.messageLog = this.messageLog.slice(-this.maxLog);
        }
    }

    private getChannelColour(channel: ChatChannel): string {
        switch (channel) {
            case 'global': return 'rgba(191, 161, 63, 1.0)';
            case 'local': return 'white';
            case 'faction': return '#88ff88';
            case 'trade': return '#ffcc44';
            case 'world': return '#aaddff';
        }
    }
}
