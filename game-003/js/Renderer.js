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

    drawMap(map, cameraX, cameraY) {
        this.ctx.font = this.font;
        
        for (let y = 0; y < this.viewHeight; y++) {
            for (let x = 0; x < this.viewWidth; x++) {
                const mapX = x + cameraX;
                const mapY = y + cameraY;
                
                if (mapX >= 0 && mapX < map.width && mapY >= 0 && mapY < map.height) {
                    const tile = map.getTile(mapX, mapY);
                    this.drawTile(x, y, tile, this.getTileColor(tile));
                }
            }
        }
    }

    drawMonsters(monsters, cameraX, cameraY) {
        for (const monster of monsters) {
            if (monster.isDead) continue;
            
            const screenX = monster.x - cameraX;
            const screenY = monster.y - cameraY;
            
            if (screenX >= 0 && screenX < this.viewWidth && 
                screenY >= 0 && screenY < this.viewHeight) {
                this.drawTile(screenX, screenY, monster.char, monster.color);
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

    getTileColor(tile) {
        switch (tile) {
            case TileType.WALL:
                return '#666666';
            case TileType.FLOOR:
                return '#888888';
            case TileType.DOOR:
                return '#8B4513';
            default:
                return '#333333';
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

    render(map, player, monsters = []) {
        this.clear();
        
        const camera = this.getCameraPosition(player, map.width, map.height);
        
        this.drawMap(map, camera.x, camera.y);
        this.drawMonsters(monsters, camera.x, camera.y);
        this.drawPlayer(player, camera.x, camera.y);
    }
}
