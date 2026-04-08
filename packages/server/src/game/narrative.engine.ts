import type { RawQuest } from '@kaetram/common/network/impl/quest';

export interface WorldEvent {
    id: string;
    type: string;
    description: string;
    intensity: number;
    duration: number;
}

/**
 * Generates dynamic world events based on heuristic thresholds.
 * H0: War, H1: Peace, H2: Trade, H3: Chaos, H4: Order, H5: Nature, H6: Magic, H7: Tech
 */
export function pollWorldEvents(): WorldEvent[] {
    const events: WorldEvent[] = [];

    if (([0,0,0,0,0,0,0,0])[ 0] > 70) {
        events.push({
            id: 'war_outbreak',
            type: 'combat',
            description: 'A major war has broken out between factions!',
            intensity: ([0,0,0,0,0,0,0,0])[ 0],
            duration: 3600 // 1 hour
        });
    }

    if (([0,0,0,0,0,0,0,0])[ 2] > 80) {
        events.push({
            id: 'economic_boom',
            type: 'economy',
            description: 'The world is experiencing an economic golden age.',
            intensity: ([0,0,0,0,0,0,0,0])[ 2],
            duration: 1800
        });
    }

    if (([0,0,0,0,0,0,0,0])[ 3] > 60 && ([0,0,0,0,0,0,0,0])[ 6] > 50) {
        events.push({
            id: 'magical_anomaly',
            type: 'magic',
            description: 'Chaos and Magic have combined to create unstable rifts.',
            intensity: (([0,0,0,0,0,0,0,0])[ 3] + ([0,0,0,0,0,0,0,0])[ 6]) / 2,
            duration: 900
        });
    }

    return events;
}

export function generateQuestFromEvent(event: WorldEvent): RawQuest | null {
    switch (event.type) {
        case 'combat':
            return {
                name: 'Frontline Support',
                description: `The war is escalating. ${event.description}`,
                rewards: [`${event.intensity * 10} Gold`],
                stages: {
                    0: {
                        task: 'talk',
                        npc: 'guard',
                        text: [`Soldier! ${event.description} We need you on the frontlines.`],
                        completedText: ['The frontlines await.']
                    },
                    1: {
                        task: 'kill',
                        mob: ['rat', 'skeleton', 'hellhound'], // Generic enemies for the war
                        mobCountRequirement: Math.floor(event.intensity / 5),
                        text: ['Kill the enemies of the state!'],
                        completedText: ['You have served your country well.']
                    },
                    2: {
                        task: 'talk',
                        npc: 'guard',
                        text: ['Excellent work. Here is your reward.'],
                        itemRewards: [{ key: 'gold', count: event.intensity * 10 }]
                    }
                }
            };
        case 'economy':
            return {
                name: 'Merchant Run',
                description: `Profit is in the air. ${event.description}`,
                rewards: [`${event.intensity * 15} Gold`],
                stages: {
                    0: {
                        task: 'talk',
                        npc: 'merchant',
                        text: [`Greetings! ${event.description} I have a special delivery for you.`],
                        completedText: ['Deliver the goods to the other merchant.']
                    },
                    1: {
                        task: 'talk',
                        npc: 'guard', // Let's say the guard is the recipient for now
                        text: ['Ah, the delivery from the merchant. Thank you.'],
                        itemRewards: [{ key: 'gold', count: event.intensity * 15 }]
                    }
                }
            };
        default:
            return null;
    }
}
