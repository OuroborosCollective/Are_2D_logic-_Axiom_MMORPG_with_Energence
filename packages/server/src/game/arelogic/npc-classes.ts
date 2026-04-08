/**
 * Heuristic NPC Classes
 *
 * NPCs are assigned classes based on their behaviour, village role,
 * and the heuristic state of the world. Classes evolve dynamically —
 * a Merchant may become a Smuggler during high scarcity, or a Scholar
 * may become an Oracle when Knowledge + History are high.
 *
 * Each class modifies personality traits and available dialogue topics.
 */

import { HNode } from './heuristic.engine';

import type HeuristicEngine from './heuristic.engine';
import type { NPCPersonality } from './npc-memory';

export enum NPCClass {
    Villager = 'villager',
    Merchant = 'merchant',
    Guard = 'guard',
    Scholar = 'scholar',
    Politician = 'politician',
    Artisan = 'artisan',
    Explorer = 'explorer',
    Oracle = 'oracle',
    Smuggler = 'smuggler',
    Revolutionary = 'revolutionary',
    Elder = 'elder',
    Healer = 'healer'
}

export interface NPCClassDefinition {
    name: NPCClass;
    personalityModifiers: Partial<NPCPersonality>;
    topics: string[];
    description: string;
}

const CLASS_DEFINITIONS: Record<NPCClass, NPCClassDefinition> = {
    [NPCClass.Villager]: {
        name: NPCClass.Villager,
        personalityModifiers: { friendliness: 0.1 },
        topics: ['weather', 'village', 'family'],
        description: 'A common villager going about daily life.'
    },
    [NPCClass.Merchant]: {
        name: NPCClass.Merchant,
        personalityModifiers: { curiosity: 0.1, friendliness: 0.05 },
        topics: ['trade', 'prices', 'goods', 'economy'],
        description: 'A trader who deals in goods and information.'
    },
    [NPCClass.Guard]: {
        name: NPCClass.Guard,
        personalityModifiers: { aggression: 0.15, loyalty: 0.2 },
        topics: ['safety', 'politics', 'threats'],
        description: 'A protector of the village and its people.'
    },
    [NPCClass.Scholar]: {
        name: NPCClass.Scholar,
        personalityModifiers: { wisdom: 0.2, curiosity: 0.15 },
        topics: ['knowledge', 'history', 'innovation', 'technology'],
        description: 'A keeper of knowledge and stories.'
    },
    [NPCClass.Politician]: {
        name: NPCClass.Politician,
        personalityModifiers: { wisdom: 0.1, loyalty: -0.1, curiosity: 0.1 },
        topics: ['politics', 'alliances', 'power', 'nations'],
        description: 'A manipulator of social structures.'
    },
    [NPCClass.Artisan]: {
        name: NPCClass.Artisan,
        personalityModifiers: { friendliness: 0.1, curiosity: 0.1 },
        topics: ['culture', 'craft', 'beauty', 'tradition'],
        description: 'A creator of beauty and cultural artifacts.'
    },
    [NPCClass.Explorer]: {
        name: NPCClass.Explorer,
        personalityModifiers: { curiosity: 0.25, aggression: 0.05 },
        topics: ['adventure', 'quests', 'discovery', 'exploration'],
        description: 'A wanderer who seeks what lies beyond.'
    },
    [NPCClass.Oracle]: {
        name: NPCClass.Oracle,
        personalityModifiers: { wisdom: 0.3, curiosity: 0.05 },
        topics: ['prophecy', 'history', 'future', 'heuristics'],
        description: 'One who sees the patterns in the world-wave.'
    },
    [NPCClass.Smuggler]: {
        name: NPCClass.Smuggler,
        personalityModifiers: { friendliness: -0.1, aggression: 0.1, curiosity: 0.1 },
        topics: ['contraband', 'scarcity', 'deals', 'secrets'],
        description: 'Operates in the shadows of legitimate trade.'
    },
    [NPCClass.Revolutionary]: {
        name: NPCClass.Revolutionary,
        personalityModifiers: { aggression: 0.2, loyalty: -0.2, curiosity: 0.1 },
        topics: ['revolution', 'politics', 'freedom', 'change'],
        description: 'One who seeks to overturn the established order.'
    },
    [NPCClass.Elder]: {
        name: NPCClass.Elder,
        personalityModifiers: { wisdom: 0.2, loyalty: 0.15, friendliness: 0.1 },
        topics: ['history', 'family', 'legacy', 'tradition'],
        description: 'A respected keeper of village traditions.'
    },
    [NPCClass.Healer]: {
        name: NPCClass.Healer,
        personalityModifiers: { friendliness: 0.2, wisdom: 0.1 },
        topics: ['health', 'nature', 'remedies', 'peace'],
        description: 'One who mends body and spirit.'
    }
};

/**
 * Determines the best NPC class based on the current heuristic state.
 * This allows NPC classes to shift dynamically with the world-wave.
 */
export function determineNPCClass(
    baseClass: NPCClass,
    heuristics: HeuristicEngine
): NPCClass {
    const scarcity = heuristics.get(HNode.Scarcity);
    const politics = heuristics.get(HNode.Politics);
    const knowledge = heuristics.get(HNode.Knowledge);
    const history = heuristics.get(HNode.History);
    const social = heuristics.get(HNode.Social);
    const culture = heuristics.get(HNode.Culture);
    const innovation = heuristics.get(HNode.Innovation);

    // Merchants become Smugglers in high scarcity
    if (baseClass === NPCClass.Merchant && scarcity > 75) return NPCClass.Smuggler;

    // Scholars become Oracles when Knowledge + History are high
    if (baseClass === NPCClass.Scholar && knowledge > 70 && history > 65) return NPCClass.Oracle;

    // Guards become Revolutionaries during extreme political tension
    if (baseClass === NPCClass.Guard && politics > 80 && social < 30) return NPCClass.Revolutionary;

    // Villagers become Artisans when culture is high
    if (baseClass === NPCClass.Villager && culture > 75) return NPCClass.Artisan;

    // Artisans become Scholars during innovation booms
    if (baseClass === NPCClass.Artisan && innovation > 70) return NPCClass.Scholar;

    // Politicians become Elders in peaceful high-history times
    if (baseClass === NPCClass.Politician && politics < 30 && history > 70) return NPCClass.Elder;

    return baseClass;
}

export function getClassDefinition(npcClass: NPCClass): NPCClassDefinition {
    return CLASS_DEFINITIONS[npcClass];
}

export function getAllClasses(): NPCClassDefinition[] {
    return Object.values(CLASS_DEFINITIONS);
}
