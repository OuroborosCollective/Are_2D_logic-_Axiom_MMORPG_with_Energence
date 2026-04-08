/**
 * Are Logic — Central coordination point for all heuristic systems.
 *
 * Architecture:
 *   6 Axioms → govern rules
 *   1 Watchdog → enforces axioms
 *   13 Heuristic Nodes → propagate waves → converge to 1 Main signal
 *
 * Subsystems:
 *   - NPC Memory Engine: NPCs remember player interactions
 *   - NPC Classes: Dynamic class assignment based on heuristics
 *   - Nation System: Villages, nations, politics, recursion
 *   - Social Wave: Friendships, families, parties, reputation
 *   - World Generator: Procedural endless world based on heuristics
 *   - World Chat: Multi-channel chat with NPC participation
 */

export { default as HeuristicEngine, HNode, NODE_COUNT, NODE_NAMES } from './heuristic.engine';
export type { HeuristicSnapshot } from './heuristic.engine';

export { Axiom, AXIOM_COUNT, AXIOM_NAMES, validateAxioms } from './axioms';
export type { AxiomViolation, AxiomContext } from './axioms';

export { default as Watchdog } from './watchdog';
export type { WatchdogReport } from './watchdog';

export { default as NPCMemory } from './npc-memory';
export type { MemoryEntry, MemoryEventType, NPCPersonality } from './npc-memory';

export { NPCClass, determineNPCClass, getClassDefinition, getAllClasses } from './npc-classes';
export type { NPCClassDefinition } from './npc-classes';

export { default as NationSystem } from './nations';
export type { Nation, Village, DiplomaticRelation, DiplomaticStatus } from './nations';

export { default as SocialWaveSystem } from './social-wave';
export type { SocialBond, FamilyNode, AdventureParty, RelationType } from './social-wave';

export { default as WorldGenerator } from './world-generator';
export type { GeneratedRegion, RegionFeature, Biome } from './world-generator';

export { default as WorldChat } from './world-chat';
export type { WorldChatMessage, ChatChannel } from './world-chat';
