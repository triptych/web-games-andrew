// FOV.js - Field of View calculator using shadowcasting

export class FOV {
    constructor(map) {
        this.map = map;
        this.visibleTiles = new Set();
        this.exploredTiles = new Set();
    }

    // Shadowcasting algorithm for FOV
    compute(x, y, radius) {
        this.visibleTiles.clear();

        // Player position is always visible
        this.visibleTiles.add(`${x},${y}`);
        this.exploredTiles.add(`${x},${y}`);

        // Cast shadows in 8 octants
        for (let octant = 0; octant < 8; octant++) {
            this.castLight(x, y, 1, 1.0, 0.0, radius,
                this.multipliers[0][octant],
                this.multipliers[1][octant],
                this.multipliers[2][octant],
                this.multipliers[3][octant]);
        }
    }

    castLight(cx, cy, row, start, end, radius, xx, xy, yx, yy) {
        if (start < end) return;

        let newStart = 0;
        let blocked = false;

        for (let distance = row; distance <= radius && !blocked; distance++) {
            let deltaY = -distance;
            for (let deltaX = -distance; deltaX <= 0; deltaX++) {
                let currentX = cx + deltaX * xx + deltaY * xy;
                let currentY = cy + deltaX * yx + deltaY * yy;

                let leftSlope = (deltaX - 0.5) / (deltaY + 0.5);
                let rightSlope = (deltaX + 0.5) / (deltaY - 0.5);

                if (!(currentX >= 0 && currentY >= 0 && currentX < this.map.width && currentY < this.map.height) || start < rightSlope) {
                    continue;
                } else if (end > leftSlope) {
                    break;
                }

                // Square is visible
                if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) <= radius) {
                    this.visibleTiles.add(`${currentX},${currentY}`);
                    this.exploredTiles.add(`${currentX},${currentY}`);
                }

                let isBlocking = !this.map.isWalkable(currentX, currentY);

                if (blocked) {
                    if (isBlocking) {
                        newStart = rightSlope;
                    } else {
                        blocked = false;
                        start = newStart;
                    }
                } else {
                    if (isBlocking && distance < radius) {
                        blocked = true;
                        this.castLight(cx, cy, distance + 1, start, leftSlope, radius, xx, xy, yx, yy);
                        newStart = rightSlope;
                    }
                }
            }
        }
    }

    // Multipliers for transforming coordinates in octants
    multipliers = [
        [1, 0, 0, -1, -1, 0, 0, 1],
        [0, 1, -1, 0, 0, -1, 1, 0],
        [0, 1, 1, 0, 0, -1, -1, 0],
        [1, 0, 0, 1, -1, 0, 0, -1]
    ];

    isVisible(x, y) {
        return this.visibleTiles.has(`${x},${y}`);
    }

    isExplored(x, y) {
        return this.exploredTiles.has(`${x},${y}`);
    }

    serialize() {
        return {
            exploredTiles: Array.from(this.exploredTiles)
        };
    }

    deserialize(data) {
        if (data && data.exploredTiles) {
            this.exploredTiles = new Set(data.exploredTiles);
        }
    }
}
