export const W = 540;
export const DT = 1 / 120;

export const DIFFICULTY = {
    recruit: { id: 'recruit', name: 'Recruit', bulletSpd: 0.82, density: 0.7, fireRate: 0.72, enemyHp: 0.85, salvage: 0.9, score: 0.7, armorBonus: 2, blurb: 'Slower, sparser fire and two extra armour.' },
    pilot: { id: 'pilot', name: 'Pilot', bulletSpd: 1, density: 1, fireRate: 1, enemyHp: 1, salvage: 1, score: 1, armorBonus: 0, blurb: 'The intended experience.' },
    ace: { id: 'ace', name: 'Ace', bulletSpd: 1.14, density: 1.35, fireRate: 1.3, enemyHp: 1.15, salvage: 1.3, score: 1.6, armorBonus: -1, blurb: 'Bullet hell. More salvage and score.' },
};
