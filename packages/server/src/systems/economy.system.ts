import itemData from '../../data/items.json';

interface ItemPriceInfo {
    basePrice: number;
    category: string;
}

const itemPriceMap: Record<string, ItemPriceInfo> = {};

for (const key in itemData) {
    const item = (itemData as any)[key];
    itemPriceMap[key] = {
        basePrice: item.price || 10,
        category: item.type || 'misc'
    };
}

/**
 * Computes the dynamic price of an item based on world heuristic values.
 * @param itemKey The item key to compute price for.
 * @param isSellingOrNodes Boolean (legacy) or array of 13 heuristic values.
 * @param isSelling Whether the player is selling (vs buying).
 */
export function computePrice(
    itemKey: string,
    isSellingOrNodes?: boolean | number[],
    isSelling = false
): number {
    let heuristicNodes: number[] = new Array(13).fill(50);

    // Support legacy 2-arg call: computePrice(key, isSelling)
    if (typeof isSellingOrNodes === 'boolean') {
        isSelling = isSellingOrNodes;
    } else if (Array.isArray(isSellingOrNodes)) {
        heuristicNodes = isSellingOrNodes;
    }
    const info = itemPriceMap[itemKey];
    if (!info) return 1;

    let multiplier = 1.0;

    // Normalize node values to 0-1 range
    const trade = (heuristicNodes[3] ?? 50) / 100;
    const peace = (heuristicNodes[8] ?? 50) / 100;     // Social → peace proxy
    const chaos = (heuristicNodes[6] ?? 50) / 100;     // Scarcity → chaos proxy
    const order = (heuristicNodes[9] ?? 50) / 100;     // Culture → order proxy
    const war = (heuristicNodes[10] ?? 50) / 100;      // Politics → war proxy
    const nature = (heuristicNodes[0] ?? 50) / 100;    // ResourceInflux → nature proxy
    const tech = (heuristicNodes[12] ?? 50) / 100;     // Technology

    multiplier += trade * 0.5;
    multiplier -= peace * 0.3;
    multiplier += chaos * 1.0;
    multiplier -= order * 0.5;

    switch (info.category) {
        case 'weapon':
        case 'armor':
            multiplier += war * 1.5;
            break;
        case 'food':
        case 'potion':
            multiplier += war * 1.0;
            multiplier -= nature * 0.5;
            break;
        case 'material':
            multiplier += tech * 0.8;
            break;
    }

    if (isSelling) multiplier *= 0.5;

    return Math.max(1, Math.floor(info.basePrice * multiplier));
}
