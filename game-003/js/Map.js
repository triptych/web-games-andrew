// Map.js - Dungeon generation and tile management

export const TileType = {
    WALL: '#',
    FLOOR: '.',
    DOOR: '+',
    CORRIDOR: '#',
    EMPTY: ' '
};

export class Room {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    center() {
        return {
            x: Math.floor(this.x + this.width / 2),
            y: Math.floor(this.y + this.height / 2)
        };
    }

    intersects(other) {
        return (this.x <= other.x + other.width &&
                this.x + this.width >= other.x &&
                this.y <= other.y + other.height &&
                this.y + this.height >= other.y);
    }
}

export class Map {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.tiles = this.createEmptyMap();
        this.rooms = [];
    }

    createEmptyMap() {
        const tiles = [];
        for (let y = 0; y < this.height; y++) {
            tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                tiles[y][x] = TileType.WALL;
            }
        }
        return tiles;
    }

    generate() {
        this.rooms = [];
        const maxRooms = 15;
        const minSize = 4;
        const maxSize = 10;

        for (let i = 0; i < maxRooms; i++) {
            const width = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const height = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const x = Math.floor(Math.random() * (this.width - width - 1)) + 1;
            const y = Math.floor(Math.random() * (this.height - height - 1)) + 1;

            const newRoom = new Room(x, y, width, height);
            
            // Check if room overlaps with existing rooms
            let overlaps = false;
            for (const room of this.rooms) {
                if (newRoom.intersects(room)) {
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                this.carveRoom(newRoom);

                // Connect to previous room with corridor
                if (this.rooms.length > 0) {
                    const prevRoom = this.rooms[this.rooms.length - 1];
                    this.createCorridor(prevRoom.center(), newRoom.center());
                }

                this.rooms.push(newRoom);
            }
        }

        return this.rooms.length > 0 ? this.rooms[0].center() : { x: 1, y: 1 };
    }

    getRandomFloorPosition(excludeFirstRoom = false) {
        // Get a random room (optionally exclude first room for monster placement)
        const startIndex = excludeFirstRoom ? 1 : 0;
        if (this.rooms.length <= startIndex) {
            return null;
        }

        const room = this.rooms[startIndex + Math.floor(Math.random() * (this.rooms.length - startIndex))];
        
        // Get random position within room
        const x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
        const y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
        
        return { x, y };
    }

    carveRoom(room) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                if (x > 0 && x < this.width && y > 0 && y < this.height) {
                    this.tiles[y][x] = TileType.FLOOR;
                }
            }
        }
    }

    createCorridor(start, end) {
        let x = start.x;
        let y = start.y;

        // Randomly choose horizontal-first or vertical-first
        if (Math.random() < 0.5) {
            // Horizontal then vertical
            while (x !== end.x) {
                this.tiles[y][x] = TileType.FLOOR;
                x += (x < end.x) ? 1 : -1;
            }
            while (y !== end.y) {
                this.tiles[y][x] = TileType.FLOOR;
                y += (y < end.y) ? 1 : -1;
            }
        } else {
            // Vertical then horizontal
            while (y !== end.y) {
                this.tiles[y][x] = TileType.FLOOR;
                y += (y < end.y) ? 1 : -1;
            }
            while (x !== end.x) {
                this.tiles[y][x] = TileType.FLOOR;
                x += (x < end.x) ? 1 : -1;
            }
        }
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return false;
        }
        return this.tiles[y][x] === TileType.FLOOR;
    }

    getTile(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return TileType.WALL;
        }
        return this.tiles[y][x];
    }

    serialize() {
        return {
            width: this.width,
            height: this.height,
            tiles: this.tiles,
            rooms: this.rooms.map(room => ({
                x: room.x,
                y: room.y,
                width: room.width,
                height: room.height
            }))
        };
    }

    deserialize(data) {
        this.width = data.width;
        this.height = data.height;
        this.tiles = data.tiles;
        this.rooms = data.rooms.map(roomData =>
            new Room(roomData.x, roomData.y, roomData.width, roomData.height)
        );
    }
}
