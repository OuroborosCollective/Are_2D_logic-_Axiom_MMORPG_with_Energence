/**
 * Watchdog — the single guardian process that monitors all heuristic
 * operations and enforces the 6 axioms. It runs every tick after the
 * heuristic engine propagates waves.
 *
 * Responsibilities:
 *  - Clamp runaway heuristic values
 *  - Detect and correct economic singularities
 *  - Ensure NPC memory consistency
 *  - Prevent political deadlocks
 *  - Log violations for the History node (H12)
 */

import HeuristicEngine, { HNode, NODE_COUNT } from './heuristic.engine';
import { validateAxioms, type AxiomViolation, type AxiomContext } from './axioms';
import log from '@kaetram/common/util/log';

export interface WatchdogReport {
    violations: AxiomViolation[];
    corrections: string[];
    timestamp: number;
}

export default class Watchdog {
    private reports: WatchdogReport[] = [];
    private maxReports = 100;

    public constructor(private heuristics: HeuristicEngine) {}

    /**
     * Run a full validation pass and auto-correct where possible.
     * Returns the report for this tick.
     */
    public validate(): WatchdogReport {
        const corrections: string[] = [];
        const allViolations: AxiomViolation[] = [];

        // 1. Check for extreme heuristic values (self-correcting axiom A4)
        for (let i = 0; i < NODE_COUNT; i++) {
            const v = this.heuristics.nodes[i];
            if (v > 95) {
                this.heuristics.nodes[i] = 90;
                corrections.push(`Clamped node ${i} from ${v.toFixed(1)} to 90 (ceiling)`);
            }
            if (v < 5) {
                this.heuristics.nodes[i] = 10;
                corrections.push(`Clamped node ${i} from ${v.toFixed(1)} to 10 (floor)`);
            }
        }

        // 2. Detect economic singularity (Trade + Accumulation both extreme)
        const trade = this.heuristics.get(HNode.TradeVelocity);
        const accum = this.heuristics.get(HNode.Accumulation);
        if (trade > 85 && accum > 85) {
            this.heuristics.impulse(HNode.Scarcity, 10);
            this.heuristics.impulse(HNode.TradeVelocity, -8);
            corrections.push('Economic singularity detected — injected scarcity correction');
        }

        // 3. Political deadlock (Politics oscillating near extremes)
        const politicsTrend = this.heuristics.trend(HNode.Politics, 20);
        if (Math.abs(politicsTrend) < 0.5 && this.heuristics.get(HNode.Politics) > 80) {
            this.heuristics.impulse(HNode.Social, 5);
            corrections.push('Political stagnation at high tension — social impulse applied');
        }

        // 4. Diversity check via variance of all nodes
        const mean = this.heuristics.main;
        let variance = 0;
        for (let i = 0; i < NODE_COUNT; i++) {
            variance += (this.heuristics.nodes[i] - mean) ** 2;
        }
        variance /= NODE_COUNT;
        const diversityIndex = Math.min(1, variance / 400);

        const ctx: AxiomContext = {
            diversityIndex,
            valueOutOfBounds: corrections.length > 0,
            feedbackGenerated: true,
            historyDepth: this.heuristics.getHistory().length
        };

        const axiomViolations = validateAxioms(ctx);
        allViolations.push(...axiomViolations);

        // If diversity collapsed, inject random perturbations (A3 Emergent Potential)
        if (diversityIndex < 0.1) {
            for (let i = 0; i < NODE_COUNT; i++) {
                this.heuristics.impulse(i, (Math.random() - 0.5) * 10);
            }
            corrections.push('Emergence collapse — random perturbations injected');
        }

        const report: WatchdogReport = {
            violations: allViolations,
            corrections,
            timestamp: Date.now()
        };

        this.reports.push(report);
        if (this.reports.length > this.maxReports) this.reports.shift();

        if (corrections.length > 0) {
            log.debug(`[Watchdog] ${corrections.length} correction(s) applied this tick.`);
        }

        return report;
    }

    public getReports(): WatchdogReport[] {
        return this.reports;
    }

    public getLastReport(): WatchdogReport | undefined {
        return this.reports[this.reports.length - 1];
    }
}
