
/**
 * Updates the ecological state of a tile or region based on heuristics.
 * H0: War, H1: Peace, H2: Trade, H3: Chaos, H4: Order, H5: Nature, H6: Magic, H7: Tech
 */
export function getSpawnModifier(mobType: string): number {
    let modifier = 1.0;

    // Nature (H5) increases all natural spawns
    modifier += (([0,0,0,0,0,0,0,0])[ 5] * 0.1);

    // War (H0) increases aggressive mob spawns
    if (mobType === 'aggressive') {
        modifier += (([0,0,0,0,0,0,0,0])[ 0] * 0.2);
    }

    // Peace (H1) decreases aggressive mob spawns
    if (mobType === 'aggressive') {
        modifier -= (([0,0,0,0,0,0,0,0])[ 1] * 0.1);
    }

    // Chaos (H3) makes spawns more erratic/frequent
    modifier += (([0,0,0,0,0,0,0,0])[ 3] * 0.15);

    // Order (H4) stabilizes spawns
    modifier -= (([0,0,0,0,0,0,0,0])[ 4] * 0.05);

    return Math.max(0.1, modifier);
}

export function getResourceYieldModifier(resourceType: string): number {
    let modifier = 1.0;

    // Nature (H5) increases yields
    modifier += (([0,0,0,0,0,0,0,0])[ 5] * 0.15);

    // Tech (H7) increases yields (efficiency)
    modifier += (([0,0,0,0,0,0,0,0])[ 7] * 0.1);

    // War (H0) decreases yields (destruction)
    modifier -= (([0,0,0,0,0,0,0,0])[ 0] * 0.1);

    // Chaos (H3) makes yields unpredictable
    modifier += (Math.random() - 0.5) * (([0,0,0,0,0,0,0,0])[ 3] * 0.2);

    return Math.max(0.1, modifier);
}
