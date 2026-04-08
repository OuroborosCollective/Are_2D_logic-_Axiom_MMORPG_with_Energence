/**
 * Heuristic Wave Engine — 13 nodes that converge to 1 main world-state signal.
 *
 * Each node represents a measurable gameplay dimension. Every tick, nodes
 * propagate weighted influence to each other (wave), and the Watchdog
 * clamps values that violate axiomatic constraints.
 *
 * Nodes:
 *  H1  Resource Influx       H8  Knowledge
 *  H2  Production Efficiency  H9  Social
 *  H3  Consumption Demand     H10 Culture
 *  H4  Trade Velocity         H11 Politics
 *  H5  Accumulation           H12 History
 *  H6  Innovation             H13 Technology
 *  H7  Scarcity
 */

export enum HNode {
    ResourceInflux,
    ProductionEfficiency,
    ConsumptionDemand,
    TradeVelocity,
    Accumulation,
    Innovation,
    Scarcity,
    Knowledge,
    Social,
    Culture,
    Politics,
    History,
    Technology
}

export const NODE_COUNT = 13;
export const NODE_NAMES: Record<HNode, string> = {
    [HNode.ResourceInflux]: 'Resource Influx',
    [HNode.ProductionEfficiency]: 'Production Efficiency',
    [HNode.ConsumptionDemand]: 'Consumption Demand',
    [HNode.TradeVelocity]: 'Trade Velocity',
    [HNode.Accumulation]: 'Accumulation',
    [HNode.Innovation]: 'Innovation',
    [HNode.Scarcity]: 'Scarcity',
    [HNode.Knowledge]: 'Knowledge',
    [HNode.Social]: 'Social',
    [HNode.Culture]: 'Culture',
    [HNode.Politics]: 'Politics',
    [HNode.History]: 'History',
    [HNode.Technology]: 'Technology'
};

/** Influence matrix: how much node i affects node j per tick. */
const INFLUENCE: number[][] = buildInfluenceMatrix();

function buildInfluenceMatrix(): number[][] {
    const m: number[][] = Array.from({ length: NODE_COUNT }, () =>
        new Array(NODE_COUNT).fill(0)
    );

    // Resource ↔ Scarcity inverse relationship
    m[HNode.ResourceInflux][HNode.Scarcity] = -0.12;
    m[HNode.Scarcity][HNode.ResourceInflux] = -0.08;

    // Production → Consumption demand
    m[HNode.ProductionEfficiency][HNode.ConsumptionDemand] = 0.06;
    // Trade ↔ Accumulation
    m[HNode.TradeVelocity][HNode.Accumulation] = 0.05;
    m[HNode.Accumulation][HNode.TradeVelocity] = 0.03;

    // Innovation → Technology → Knowledge chain
    m[HNode.Innovation][HNode.Technology] = 0.08;
    m[HNode.Technology][HNode.Knowledge] = 0.06;
    m[HNode.Knowledge][HNode.Innovation] = 0.04;

    // Social ↔ Culture ↔ Politics triangle
    m[HNode.Social][HNode.Culture] = 0.07;
    m[HNode.Culture][HNode.Politics] = 0.05;
    m[HNode.Politics][HNode.Social] = 0.04;

    // History absorbs all (weak input from every node)
    for (let i = 0; i < NODE_COUNT; i++) {
        if (i !== HNode.History) m[i][HNode.History] = 0.02;
    }

    // History feeds back into Culture and Politics
    m[HNode.History][HNode.Culture] = 0.03;
    m[HNode.History][HNode.Politics] = 0.03;

    // Scarcity → Politics tension
    m[HNode.Scarcity][HNode.Politics] = 0.06;
    // Accumulation → Social stratification
    m[HNode.Accumulation][HNode.Social] = 0.04;

    return m;
}

export interface HeuristicSnapshot {
    nodes: number[];
    main: number;
    timestamp: number;
}

export default class HeuristicEngine {
    /** Current node values in [0, 100]. */
    public nodes: number[] = new Array(NODE_COUNT).fill(50);

    /** The single combined "world pulse" score. */
    public main = 50;

    /** Historical snapshots for recursion (axiom A2). */
    private history: HeuristicSnapshot[] = [];
    private maxHistory = 200;

    /** External impulses accumulated between ticks. */
    private impulses: number[] = new Array(NODE_COUNT).fill(0);

    /** Applies an external impulse to a node (will be processed next tick). */
    public impulse(node: HNode, amount: number): void {
        this.impulses[node] += amount;
    }

    /** Main tick — propagate waves, apply impulses, clamp, compute main. */
    public tick(): void {
        const deltas = new Array(NODE_COUNT).fill(0);

        // 1. Wave propagation through influence matrix
        for (let i = 0; i < NODE_COUNT; i++) {
            for (let j = 0; j < NODE_COUNT; j++) {
                if (INFLUENCE[i][j] !== 0) {
                    deltas[j] += this.nodes[i] * INFLUENCE[i][j];
                }
            }
        }

        // 2. Add external impulses
        for (let i = 0; i < NODE_COUNT; i++) {
            deltas[i] += this.impulses[i];
            this.impulses[i] = 0;
        }

        // 3. Apply + mean-revert towards 50 (stabiliser)
        for (let i = 0; i < NODE_COUNT; i++) {
            this.nodes[i] += deltas[i];
            this.nodes[i] += (50 - this.nodes[i]) * 0.01; // gentle revert
            this.nodes[i] = clamp(this.nodes[i], 0, 100);
        }

        // 4. Compute main = weighted average of all nodes
        this.main = this.computeMain();

        // 5. Store snapshot for history recursion
        this.history.push({
            nodes: [...this.nodes],
            main: this.main,
            timestamp: Date.now()
        });

        if (this.history.length > this.maxHistory) this.history.shift();
    }

    /** Weighted average giving Politics, Social, Culture higher weight. */
    private computeMain(): number {
        const weights = [1, 1, 1, 1, 1, 1, 1, 1, 1.5, 1.5, 2, 1.5, 1];
        let sum = 0,
            wSum = 0;
        for (let i = 0; i < NODE_COUNT; i++) {
            sum += this.nodes[i] * weights[i];
            wSum += weights[i];
        }
        return sum / wSum;
    }

    public get(node: HNode): number {
        return this.nodes[node];
    }

    public getAll(): number[] {
        return [...this.nodes];
    }

    public getSnapshot(): HeuristicSnapshot {
        return { nodes: [...this.nodes], main: this.main, timestamp: Date.now() };
    }

    public getHistory(): HeuristicSnapshot[] {
        return this.history;
    }

    /** Trend direction over the last N snapshots for a node. */
    public trend(node: HNode, window = 10): number {
        if (this.history.length < 2) return 0;
        const slice = this.history.slice(-window);
        const first = slice[0].nodes[node];
        const last = slice[slice.length - 1].nodes[node];
        return last - first;
    }

    public serialize(): HeuristicSnapshot {
        return this.getSnapshot();
    }

    public deserialize(snap: HeuristicSnapshot): void {
        this.nodes = [...snap.nodes];
        this.main = snap.main;
    }
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
}
