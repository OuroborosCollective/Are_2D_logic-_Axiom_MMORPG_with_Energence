import rawData from '../../../../data/npcs.json';
import Entity from '../entity';

import log from '@kaetram/common/util/log';
import Utils from '@kaetram/common/util/utils';
import { NPCPacket, ChatPacket } from '@kaetram/common/network/impl';
import { Modules, Opcodes } from '@kaetram/common/network';
import { SpecialEntityTypes } from '@kaetram/common/network/modules';

import type Player from '../character/player/player';
import type { NPCData } from '@kaetram/common/network/impl/npc';
import type { EntityDisplayInfo } from '@kaetram/common/types/entity';
import type NPCMemory from '../../../game/arelogic/npc-memory';
import type { NPCClass } from '../../../game/arelogic/npc-classes';

interface RawNPCData {
    [key: string]: NPCData;
}

export default class NPC extends Entity {
    // talkIndex = 0;

    private data: NPCData;

    private text: string[] = [];

    public role?: string;
    public store = '';

    /** Heuristic NPC class — assigned dynamically by the world. */
    public heuristicClass?: NPCClass;

    public constructor(key: string, x: number, y: number) {
        super(Utils.createInstance(Modules.EntityType.NPC), key, x, y);

        this.data = (rawData as RawNPCData)[key];

        if (!this.data) {
            log.error(`[NPC] Could not find data for ${key}.`);
            return;
        }

        // Load default NPC data.
        this.name = this.data.name!;
        this.text = this.data.text || this.text;
        this.role = this.data.role!;
        this.store = this.data.store || '';
    }

    /**
     * Talks to an NPC and progresses the talking index of the player.
     * If the NPC has a memory engine attached (via World), it will
     * generate heuristic-aware dialogue alongside the static text.
     * @param player The player to grab/compare talk index of.
     * @param text Optional parameter that uses default text in `npcs.json` if not specified.
     */

    public talk(player?: Player, text = this.text): void {
        if (!player) return;

        // Record this interaction in the NPC's memory
        const world = player.world;
        if (world) {
            const memory = world.getNPCMemory(this.instance, this.name);
            memory.remember({
                playerId: player.instance,
                playerName: player.username,
                event: 'talk',
                detail: `${player.username} spoke to ${this.name}`,
                sentiment: 0.1,
                strength: 0.8
            });

            // Generate heuristic-aware dialogue if no static text remains
            if (!this.hasDialogue(text) || (player.talkIndex >= text.length)) {
                const heuristicMsg = memory.generateDialogue(
                    player.instance,
                    player.username,
                    world.heuristics
                );
                player.send(
                    new NPCPacket(Opcodes.NPC.Talk, {
                        instance: this.instance,
                        text: heuristicMsg
                    })
                );
                player.talkIndex = 0;
                return;
            }
        }

        if (!this.hasDialogue(text)) return;

        // Reset the talking index if we talk to a new NPC.
        if (player.npcTalk !== this.key) player.resetTalk(this.key);

        // Text to display at the current talking index.
        let message = text[player.talkIndex];

        /**
         * Reset the talking index when we reach the end or
         * continue progression otherwise.
         */

        if (player.talkIndex > text.length - 1) player.talkIndex = 0;
        else player.talkIndex++;

        // Send the network packet of the current dialogue index.
        player.send(
            new NPCPacket(Opcodes.NPC.Talk, {
                instance: this.instance,
                text: message
            })
        );
    }

    /**
     * Checks if the NPC has a dialogue array.
     * @returns If the dialogue array length is greater than 0.
     */

    public hasDialogue(text: string[]): boolean {
        return text.length > 0;
    }

    /**
     * Uses the player parameter to check if the NPC is currently present
     * in any of the player's active quests.
     * @param player Player we are checking achievement/quest status of.
     * @returns The RGB string of the NPC's name.
     */

    private getNameColour(player?: Player): string {
        if (player) {
            if (player.quests.getQuestFromNPC(this))
                return Modules.NameColours[SpecialEntityTypes.Quest];
            if (player?.achievements.getAchievementFromEntity(this))
                return Modules.NameColours[SpecialEntityTypes.Achievement];
        }

        return '';
    }

    /**
     * Gets the exclamation sign that should be displayed above the NPC.
     * @param player The player for which we are checking the NPC's status.
     * @returns The string of the exclamation sign.
     */

    private getExclamation(player?: Player): string {
        if (player) {
            let quest = player.quests.getQuestFromNPC(this);

            if (quest?.isNPCForStage(player, this)) return 'blue';
            if (player?.achievements.getAchievementFromEntity(this)) return 'achievement';
        }

        return '';
    }

    /**
     * Grabs the display info for the NPC.
     * @param player Optional paramater to grab the display based on the player.
     * @returns An object containing display info data.
     */

    public override getDisplayInfo(player?: Player): EntityDisplayInfo {
        return {
            instance: this.instance,
            colour: this.getNameColour(player),
            exclamation: this.getExclamation(player)
        };
    }

    /**
     * Checks whether or not the NPC is part of an active player's
     * achievement or quest if the parameter is specified.
     * @param player Optional parameter to check if the NPC is part of an active quest or achievement.
     * @returns Whether or not any display info data is present.
     */

    public override hasDisplayInfo(player?: Player): boolean {
        if (player) {
            if (player.quests.getQuestFromNPC(this)) return true;
            if (player.achievements.getAchievementFromEntity(this)) return true;
        }

        return false;
    }
}
