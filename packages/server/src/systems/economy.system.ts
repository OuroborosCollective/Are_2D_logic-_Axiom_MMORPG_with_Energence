import { H } from '../arelogic/heuristic.engine';
import itemData from '../../data/items.json';

interface ItemPriceInfo {
    basePrice: number;
    category: string;
}

const itemPriceMap: Record<string, ItemPriceInfo> = {};

// Pre-process items to get base prices and categories
for (const key in itemData) {
    const item = (itemData as any)[key];
    itemPriceMap[key] = {
        basePrice: item.price || 10,
        category: item.type || 'misc'
    };
}

/**
 * Computes the dynamic price of an item based on world heuristics.
 * H0: War, H1: Peace, H2: Trade, H3: Chaos, H4: Order, H5: Nature, H6: Magic, H7: Tech
 */
export function computePrice(itemKey: string, isSelling: boolean = false): number {
    const info = itemPriceMap[itemKey];
    if (!info) return 1;

    let multiplier = 1.0;

    // Global modifiers
    multiplier += (H[2] * 0.05); // Trade increases prices (demand)
    multiplier -= (H[1] * 0.03); // Peace stabilizes/lowers prices
    multiplier += (H[3] * 0.10); // Chaos causes inflation
    multiplier -= (H[4] * 0.05); // Order reduces inflation

    // Category specific modifiers
    switch (info.category) {
        case 'weapon':
        case 'armor':
            multiplier += (H[0] * 0.15); // War spikes equipment prices
            break;
        case 'food':
        case 'potion':
            multiplier += (H[0] * 0.10); // War increases consumable prices
            multiplier -= (H[5] * 0.05); // Nature makes food cheaper
            break;
        case 'material':
            multiplier += (H[7] * 0.08); // Tech increases material demand
            break;
    }

    // Selling to shop usually gives less
    if (isSelling) {
        multiplier *= 0.5;
    }

    const finalPrice = Math.max(1, Math.floor(info.basePrice * multiplier));
    return finalPrice;
}
