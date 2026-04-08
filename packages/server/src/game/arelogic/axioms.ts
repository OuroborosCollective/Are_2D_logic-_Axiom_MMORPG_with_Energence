/**
 * 6 Axioms — the fundamental rules governing the heuristic world.
 *
 * A1 Relational Genesis   — all entities are defined by relationships
 * A2 State Recurrence     — all states derive from historical recursion
 * A3 Emergent Potential    — complexity emerges from simple rules
 * A4 Self-Correcting      — contradictions are resolved or prevented
 * A5 Continuous Integration — all actions feed system evolution
 * A6 Social Gravity       — social bonds shape world topology
 */

export enum Axiom {
    RelationalGenesis,
    StateRecurrence,
    EmergentPotential,
    SelfCorrecting,
    ContinuousIntegration,
    SocialGravity
}

export const AXIOM_COUNT = 6;

export const AXIOM_NAMES: Record<Axiom, string> = {
    [Axiom.RelationalGenesis]: 'Relational Genesis',
    [Axiom.StateRecurrence]: 'State Recurrence',
    [Axiom.EmergentPotential]: 'Emergent Potential',
    [Axiom.SelfCorrecting]: 'Self-Correcting Integrity',
    [Axiom.ContinuousIntegration]: 'Continuous Integration',
    [Axiom.SocialGravity]: 'Social Gravity'
};

export interface AxiomViolation {
    axiom: Axiom;
    description: string;
    severity: number; // 0-1
    timestamp: number;
}

/** Validates a proposed state change against axioms. Returns violations. */
export function validateAxioms(
    context: AxiomContext
): AxiomViolation[] {
    const violations: AxiomViolation[] = [];
    const now = Date.now();

    // A1: Entities must have at least one relationship
    if (context.entityRelationCount !== undefined && context.entityRelationCount < 1) {
        violations.push({
            axiom: Axiom.RelationalGenesis,
            description: 'Entity exists without relationships',
            severity: 0.3,
            timestamp: now
        });
    }

    // A2: State must reference history
    if (context.historyDepth !== undefined && context.historyDepth < 1) {
        violations.push({
            axiom: Axiom.StateRecurrence,
            description: 'State change without historical basis',
            severity: 0.2,
            timestamp: now
        });
    }

    // A3: Cannot suppress emergence (e.g., hard-cap diversity)
    if (context.diversityIndex !== undefined && context.diversityIndex < 0.1) {
        violations.push({
            axiom: Axiom.EmergentPotential,
            description: 'System diversity has collapsed',
            severity: 0.8,
            timestamp: now
        });
    }

    // A4: Numeric values must stay within bounds
    if (context.valueOutOfBounds) {
        violations.push({
            axiom: Axiom.SelfCorrecting,
            description: 'Value exceeded axiomatic bounds',
            severity: 0.5,
            timestamp: now
        });
    }

    // A5: Action must produce a measurable feedback signal
    if (context.feedbackGenerated === false) {
        violations.push({
            axiom: Axiom.ContinuousIntegration,
            description: 'Action produced no feedback for system evolution',
            severity: 0.4,
            timestamp: now
        });
    }

    // A6: Social bonds must influence outcome
    if (context.socialBondCount !== undefined && context.socialBondCount < 0) {
        violations.push({
            axiom: Axiom.SocialGravity,
            description: 'Social bond count is negative',
            severity: 0.6,
            timestamp: now
        });
    }

    return violations;
}

export interface AxiomContext {
    entityRelationCount?: number;
    historyDepth?: number;
    diversityIndex?: number;
    valueOutOfBounds?: boolean;
    feedbackGenerated?: boolean;
    socialBondCount?: number;
}
