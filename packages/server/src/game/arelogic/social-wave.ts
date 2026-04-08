/**
 * Social Wave System
 *
 * Manages the social fabric of the world: friendships, families,
 * adventure parties, and quest reputation. All relationships
 * propagate through the heuristic wave (axiom A6: Social Gravity).
 *
 * Relationships influence NPC behaviour, quest availability,
 * village loyalty, and political outcomes.
 */

import { HNode } from './heuristic.engine';

import type HeuristicEngine from './heuristic.engine';

export type RelationType = 'friend' | 'rival' | 'family' | 'mentor' | 'ally' | 'enemy';

export interface SocialBond {
    entityA: string;       // player or NPC ID
    entityB: string;
    type: RelationType;
    strength: number;      // 0-1
    since: number;
    interactions: number;
}

export interface FamilyNode {
    entityId: string;
    name: string;
    parentIds: string[];
    childIds: string[];
    generation: number;
}

export interface AdventureParty {
    id: string;
    name: string;
    members: string[];
    leader: string;
    questId?: string;
    reputation: number;
    formedAt: number;
}

export default class SocialWaveSystem {
    public bonds: Map<string, SocialBond> = new Map();
    public families: Map<string, FamilyNode> = new Map();
    public parties: Map<string, AdventureParty> = new Map();
    public reputation: Map<string, number> = new Map(); // entityId → rep score

    private nextPartyId = 1;

    public constructor(private heuristics: HeuristicEngine) {}

    /** Create or strengthen a social bond. */
    public addBond(entityA: string, entityB: string, type: RelationType, strength = 0.5): void {
        const key = bondKey(entityA, entityB);
        const existing = this.bonds.get(key);
        if (existing) {
            existing.strength = Math.min(1, existing.strength + strength * 0.3);
            existing.interactions++;
            if (type !== existing.type) existing.type = type;
            return;
        }
        this.bonds.set(key, {
            entityA,
            entityB,
            type,
            strength,
            since: Date.now(),
            interactions: 1
        });
    }

    /** Get all bonds for an entity. */
    public getBonds(entityId: string): SocialBond[] {
        const result: SocialBond[] = [];
        for (const bond of this.bonds.values()) {
            if (bond.entityA === entityId || bond.entityB === entityId) {
                result.push(bond);
            }
        }
        return result;
    }

    /** Get bonds of a specific type. */
    public getBondsByType(entityId: string, type: RelationType): SocialBond[] {
        return this.getBonds(entityId).filter((b) => b.type === type);
    }

    /** Register a family relationship. */
    public addFamilyMember(
        entityId: string,
        name: string,
        parentIds: string[] = [],
        generation = 0
    ): void {
        const node: FamilyNode = {
            entityId,
            name,
            parentIds,
            childIds: [],
            generation
        };
        this.families.set(entityId, node);

        // Add child reference to parents
        for (const pid of parentIds) {
            const parent = this.families.get(pid);
            if (parent) parent.childIds.push(entityId);
        }
    }

    /** Get the family tree for an entity. */
    public getFamily(entityId: string): FamilyNode | undefined {
        return this.families.get(entityId);
    }

    /** Form an adventure party. */
    public createParty(name: string, leader: string): AdventureParty {
        const party: AdventureParty = {
            id: `party_${this.nextPartyId++}`,
            name,
            members: [leader],
            leader,
            reputation: 0,
            formedAt: Date.now()
        };
        this.parties.set(party.id, party);
        return party;
    }

    public joinParty(partyId: string, entityId: string): boolean {
        const party = this.parties.get(partyId);
        if (!party || party.members.length >= 5) return false;
        if (party.members.includes(entityId)) return false;
        party.members.push(entityId);
        // Being in a party strengthens bonds between members
        for (const member of party.members) {
            if (member !== entityId) this.addBond(entityId, member, 'ally', 0.3);
        }
        return true;
    }

    public leaveParty(partyId: string, entityId: string): boolean {
        const party = this.parties.get(partyId);
        if (!party) return false;
        party.members = party.members.filter((m) => m !== entityId);
        if (party.members.length === 0) {
            this.parties.delete(partyId);
        } else if (party.leader === entityId) {
            party.leader = party.members[0];
        }
        return true;
    }

    /** Modify reputation. */
    public addReputation(entityId: string, amount: number): void {
        const current = this.reputation.get(entityId) || 0;
        this.reputation.set(entityId, current + amount);
    }

    public getReputation(entityId: string): number {
        return this.reputation.get(entityId) || 0;
    }

    /**
     * Social wave tick — bonds decay, strong bonds feed heuristics.
     */
    public tick(): void {
        let totalBondStrength = 0;
        let friendCount = 0;
        let enemyCount = 0;

        for (const [key, bond] of this.bonds) {
            // Bonds decay
            bond.strength -= 0.001;
            if (bond.strength <= 0) {
                this.bonds.delete(key);
                continue;
            }
            totalBondStrength += bond.strength;
            if (bond.type === 'friend' || bond.type === 'ally') friendCount++;
            if (bond.type === 'enemy' || bond.type === 'rival') enemyCount++;
        }

        // Social bonds influence the Social heuristic
        const socialImpulse = (friendCount - enemyCount) * 0.05;
        this.heuristics.impulse(HNode.Social, socialImpulse);

        // Strong overall bonds push Culture
        if (totalBondStrength > 50) {
            this.heuristics.impulse(HNode.Culture, 0.3);
        }

        // Many enemies push Politics
        if (enemyCount > friendCount) {
            this.heuristics.impulse(HNode.Politics, 0.5);
        }
    }

    public serialize(): object {
        return {
            bonds: [...this.bonds.entries()],
            families: [...this.families.entries()],
            parties: [...this.parties.entries()],
            reputation: [...this.reputation.entries()]
        };
    }

    public deserialize(data: any): void {
        if (data.bonds) this.bonds = new Map(data.bonds);
        if (data.families) this.families = new Map(data.families);
        if (data.parties) this.parties = new Map(data.parties);
        if (data.reputation) this.reputation = new Map(data.reputation);
    }
}

function bondKey(a: string, b: string): string {
    return a < b ? `${a}:${b}` : `${b}:${a}`;
}
