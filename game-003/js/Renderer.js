// Renderer.js - Canvas rendering for ASCII-style display

import { TileType } from './Map.js';

export class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.tileSize = 16;
        this.fontSize = 14;
        this.font = `${this.fontSize}px Courier New`;
        
        // Calculate how many tiles fit on screen
        this.viewWidth = Math.floor(canvas.width / this.tileSize);
        this.viewHeight = Math.floor(canvas.height / this.tileSize);
    }

    clear() {
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawMap(map, cameraX, cameraY, fov = null) {
        this.ctx.font = this.font;

        for (let y = 0; y < this.viewHeight; y++) {
            for (let x = 0; x < this.viewWidth; x++) {
                const mapX = x + cameraX;
                const mapY = y + cameraY;

                if (mapX >= 0 && mapX < map.width && mapY >= 0 && mapY < map.height) {
                    const tile = map.getTile(mapX, mapY);

                    if (fov) {
                        const isVisible = fov.isVisible(mapX, mapY);
                        const isExplored = fov.isExplored(mapX, mapY);

                        if (isVisible) {
                            // Fully visible
                            const { char, color } = this.getTileDisplay(tile, mapX, mapY);
                            this.drawTile(x, y, char, color);
                        } else if (isExplored) {
                            // Explored but not visible (fog of war)
                            const { char } = this.getTileDisplay(tile, mapX, mapY);
                            this.drawTile(x, y, char, '#333333');
                        }
                    } else {
                        // No FOV - show everything
                        const { char, color } = this.getTileDisplay(tile, mapX, mapY);
                        this.drawTile(x, y, char, color);
                    }
                }
            }
        }
    }

    drawMonsters(monsters, cameraX, cameraY, fov = null) {
        for (const monster of monsters) {
            if (monster.isDead) continue;

            const screenX = monster.x - cameraX;
            const screenY = monster.y - cameraY;

            if (screenX >= 0 && screenX < this.viewWidth &&
                screenY >= 0 && screenY < this.viewHeight) {
                // Only draw if visible (or no FOV)
                if (!fov || fov.isVisible(monster.x, monster.y)) {
                    this.drawTile(screenX, screenY, monster.char, monster.color);
                }
            }
        }
    }

    drawItems(items, cameraX, cameraY, fov = null) {
        for (const item of items) {
            const screenX = item.x - cameraX;
            const screenY = item.y - cameraY;

            if (screenX >= 0 && screenX < this.viewWidth &&
                screenY >= 0 && screenY < this.viewHeight) {
                // Only draw if visible (or no FOV)
                if (!fov || fov.isVisible(item.x, item.y)) {
                    this.drawTile(screenX, screenY, item.char, item.color);
                }
            }
        }
    }

    drawPlayer(player, cameraX, cameraY) {
        const screenX = player.x - cameraX;
        const screenY = player.y - cameraY;
        
        if (screenX >= 0 && screenX < this.viewWidth && 
            screenY >= 0 && screenY < this.viewHeight) {
            this.drawTile(screenX, screenY, player.char, player.color);
        }
    }

    drawTile(x, y, char, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillText(
            char,
            x * this.tileSize + 4,
            y * this.tileSize + this.fontSize
        );
    }

    getTileDisplay(tile, x, y) {
        // Add variety to floor tiles for visual interest
        const wallVariants = ['█', '▓', '▒', '░'];

        switch (tile) {
            case TileType.WALL:
                // Vary wall appearance slightly
                const wallIndex = (x * 7 + y * 13) % wallVariants.length;
                return {
                    char: wallVariants[Math.floor(wallIndex / 2)],
                    color: '#666666'
                };
            case TileType.FLOOR:
                // Vary floor appearance with multiple characters and shades
                const floorIndex = (x * 3 + y * 5) % 100;
                let char, color;
                if (floorIndex < 70) {
                    char = '.';
                    color = '#888888';
                } else if (floorIndex < 85) {
                    char = '·';
                    color = '#777777';
                } else if (floorIndex < 95) {
                    char = '°';
                    color = '#999999';
                } else {
                    char = '∙';
                    color = '#7A7A7A';
                }
                return { char, color };
            case TileType.STAIRS_DOWN:
                return { char: '>', color: '#FFFF00' };
            case TileType.STAIRS_UP:
                return { char: '<', color: '#FFFF00' };
            case TileType.DOOR:
                return { char: '+', color: '#8B4513' };
            default:
                return { char: ' ', color: '#333333' };
        }
    }

    getCameraPosition(player, mapWidth, mapHeight) {
        // Center camera on player
        let camX = player.x - Math.floor(this.viewWidth / 2);
        let camY = player.y - Math.floor(this.viewHeight / 2);

        // Keep camera within map bounds
        camX = Math.max(0, Math.min(camX, mapWidth - this.viewWidth));
        camY = Math.max(0, Math.min(camY, mapHeight - this.viewHeight));

        return { x: camX, y: camY };
    }

    render(map, player, monsters = [], items = [], fov = null, projectiles = []) {
        this.clear();

        const camera = this.getCameraPosition(player, map.width, map.height);

        this.drawMap(map, camera.x, camera.y, fov);
        this.drawItems(items, camera.x, camera.y, fov);
        this.drawMonsters(monsters, camera.x, camera.y, fov);
        this.drawPlayer(player, camera.x, camera.y);

        // Draw projectiles
        if (projectiles) {
            this.drawProjectiles(projectiles, camera.x, camera.y);
        }
    }

    drawProjectiles(projectiles, cameraX, cameraY) {
        for (const proj of projectiles) {
            const screenX = proj.x - cameraX;
            const screenY = proj.y - cameraY;

            if (screenX >= 0 && screenX < this.viewWidth &&
                screenY >= 0 && screenY < this.viewHeight) {
                this.drawTile(screenX, screenY, proj.char, proj.color);
            }
        }
    }
    
    renderInventory(player) {
        this.clear();
        this.ctx.font = this.font;
        
        // Title
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.fillText('INVENTORY', 20, 30);
        this.ctx.fillText(`${player.inventory.length}/${player.maxInventorySize} items`, 20, 50);
        
        // Equipment section
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.fillText('EQUIPPED:', 20, 80);
        
        this.ctx.fillStyle = '#FFFFFF';
        const weaponText = player.equippedWeapon ? 
            `${player.equippedWeapon.char} ${player.equippedWeapon.getDescription()}` : 'None';
        const armorText = player.equippedArmor ? 
            `${player.equippedArmor.char} ${player.equippedArmor.getDescription()}` : 'None';
        
        this.ctx.fillText(`Weapon: ${weaponText}`, 40, 100);
        this.ctx.fillText(`Armor:  ${armorText}`, 40, 120);
        
        // Inventory items
        this.ctx.fillStyle = '#00FFFF';
        this.ctx.fillText('ITEMS:', 20, 150);
        
        let y = 170;
        for (let i = 0; i < player.inventory.length; i++) {
            const item = player.inventory[i];
            const equipped = player.isEquipped(item) ? ' (E)' : '';
            const quantity = item.stackable && item.quantity > 1 ? ` x${item.quantity}` : '';
            
            this.ctx.fillStyle = item.color;
            this.ctx.fillText(`${i + 1}. ${item.char} ${item.getDescription()}${quantity}${equipped}`, 40, y);
            y += 20;
        }
        
        // Controls help
        this.ctx.fillStyle = '#888888';
        y = this.canvas.height - 60;
        this.ctx.fillText('Press number to use/equip item', 20, y);
        this.ctx.fillText('Press I to close inventory', 20, y + 20);
    }
}
