import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '../data');

function readJson(file: string) {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
}

function validate() {
    console.log('Starting JSON data validation...');

    const items = readJson('items.json');
    const mobs = readJson('mobs.json');
    const npcs = readJson('npcs.json');
    const abilities = readJson('abilities.json');
    
    // Crafting is a directory of files
    const craftingDir = path.join(DATA_DIR, 'crafting');
    const craftingFiles = fs.readdirSync(craftingDir);
    const crafting: any = {};
    for (const file of craftingFiles) {
        if (file.endsWith('.json')) {
            const data = JSON.parse(fs.readFileSync(path.join(craftingDir, file), 'utf8'));
            Object.assign(crafting, data);
        }
    }

    const tables = readJson('tables.json');

    let errors = 0;

    // Validate Mob Drops
    console.log('Validating Mob Drops...');
    for (const mobId in mobs) {
        const mob = mobs[mobId];
        if (mob.drops && Array.isArray(mob.drops)) {
            for (const drop of mob.drops) {
                if (!items[drop.key]) {
                    console.error(`Error: Mob ${mobId} drops non-existent item ${drop.key}`);
                    errors++;
                }
            }
        }
    }

    // Validate Crafting Recipes
    console.log('Validating Crafting Recipes...');
    for (const recipeId in crafting) {
        const recipe = crafting[recipeId];
        // The key of the recipe is the item produced
        if (!items[recipeId]) {
            console.error(`Error: Recipe ${recipeId} produces non-existent item ${recipeId}`);
            errors++;
        }
        if (recipe.ingredients) {
            for (const ingredientId in recipe.ingredients) {
                if (!items[ingredientId]) {
                    console.error(`Error: Recipe ${recipeId} requires non-existent item ${ingredientId}`);
                    errors++;
                }
            }
        }
    }

    // Validate NPC Shops
    console.log('Validating NPC Shops...');
    for (const npcId in npcs) {
        const npc = npcs[npcId];
        if (npc.items) {
            for (const itemId of npc.items) {
                if (!items[itemId]) {
                    console.error(`Error: NPC ${npcId} sells non-existent item ${itemId}`);
                    errors++;
                }
            }
        }
    }

    // Validate Drop Tables
    console.log('Validating Drop Tables...');
    for (const tableId in tables) {
        const table = tables[tableId];
        if (Array.isArray(table)) {
            for (const entry of table) {
                if (entry.item && !items[entry.item]) {
                    console.error(`Error: Table ${tableId} contains non-existent item ${entry.item}`);
                    errors++;
                }
            }
        }
    }

    if (errors === 0) {
        console.log('Validation successful! No broken references found.');
    } else {
        console.log(`Validation failed with ${errors} errors.`);
    }
}

validate();
