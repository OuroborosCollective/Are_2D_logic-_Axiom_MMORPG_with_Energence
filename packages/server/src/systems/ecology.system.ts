/**
 * Updates the ecological state based on heuristic node values.
 * @param heuristicNodes Array of 13 heuristic node values [0-100].
 */

export function getSpawnModifier(
    mobType: string,
    heuristicNodes: number[] = new Array(13).fill(50)
): number {
    let modifier = 1.0;
    const nature = (heuristicNodes[0] ?? 50) / 100;
    const war = (heuristicNodes[10] ?? 50) / 100;
    const peace = (heuristicNodes[8] ?? 50) / 100;
    const chaos = (heuristicNodes[6] ?? 50) / 100;
    const order = (heuristicNodes[9] ?? 50) / 100;

    modifier += nature * 0.1;

    if (mobType === 'aggressive') {
        modifier += war * 0.2;
        modifier -= peace * 0.1;
    }

    modifier += chaos * 0.15;
    modifier -= order * 0.05;

    return Math.max(0.1, modifier);
}

export function getResourceYieldModifier(
    _resourceType: string,
    heuristicNodes: number[] = new Array(13).fill(50)
): number {
    let modifier = 1.0;
    const nature = (heuristicNodes[0] ?? 50) / 100;
    const tech = (heuristicNodes[12] ?? 50) / 100;
    const war = (heuristicNodes[10] ?? 50) / 100;
    const chaos = (heuristicNodes[6] ?? 50) / 100;

    modifier += nature * 0.15;
    modifier += tech * 0.1;
    modifier -= war * 0.1;
    modifier += (Math.random() - 0.5) * chaos * 0.2;

    return Math.max(0.1, modifier);
}
