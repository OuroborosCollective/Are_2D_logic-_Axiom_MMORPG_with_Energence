import type { RawQuest } from '@kaetram/common/network/impl/quest';

export interface WorldEvent {
    id: string;
    type: string;
    description: string;
    intensity: number;
    duration: number;
}

/**
 * Generates dynamic world events. These are polled by the world tick
 * and broadcast to all players. Events are rare — they only fire
 * when heuristic thresholds are exceeded, which requires sustained
 * player activity to push nodes high enough.
 *
 * For now events are generated probabilistically to seed the world
 * with occasional activity. The full heuristic-driven version is in
 * the AreLogic heuristicTick (world.ts) where real node values
 * are checked.
 */
export function pollWorldEvents(): WorldEvent[] {
    const events: WorldEvent[] = [];

    // ~1% chance per tick to generate a random world event
    if (Math.random() > 0.99) {
        const templates = [
            {
                id: 'border_skirmish',
                type: 'combat',
                description: 'Border skirmishes have been reported between rival nations!',
                intensity: 60,
                duration: 1800
            },
            {
                id: 'trade_caravan',
                type: 'economy',
                description: 'A grand trade caravan has arrived with exotic goods.',
                intensity: 50,
                duration: 900
            },
            {
                id: 'ancient_discovery',
                type: 'knowledge',
                description: 'Scholars have uncovered ancient texts in nearby ruins.',
                intensity: 45,
                duration: 1200
            },
            {
                id: 'harvest_festival',
                type: 'social',
                description: 'The villages are celebrating a bountiful harvest!',
                intensity: 40,
                duration: 600
            }
        ];
        const template = templates[Math.floor(Math.random() * templates.length)];
        events.push(template);
    }

    return events;
}

export function generateQuestFromEvent(event: WorldEvent): RawQuest | null {
    switch (event.type) {
        case 'combat':
            return {
                name: 'Frontline Support',
                description: `The conflict is escalating. ${event.description}`,
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
                        mob: ['rat', 'skeleton', 'hellhound'],
                        mobCountRequirement: Math.floor(event.intensity / 5),
                        text: ['Defeat the enemies threatening our borders!'],
                        completedText: ['You have served your nation well.']
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
                description: `Opportunity knocks. ${event.description}`,
                rewards: [`${event.intensity * 15} Gold`],
                stages: {
                    0: {
                        task: 'talk',
                        npc: 'merchant',
                        text: [`Greetings! ${event.description} I have a special delivery for you.`],
                        completedText: ['Deliver the goods to the guard outpost.']
                    },
                    1: {
                        task: 'talk',
                        npc: 'guard',
                        text: ['Ah, the delivery from the merchant. Thank you.'],
                        itemRewards: [{ key: 'gold', count: event.intensity * 15 }]
                    }
                }
            };
        default:
            return null;
    }
}
