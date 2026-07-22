// ============================================================
// Coppergate Lane — game content / database
// Story, characters, items, enemies, quests all live here so
// they're easy to expand. (Data-driven — the systems read this.)
// ============================================================

// ---- Items ----
// kind: 'consumable' | 'material' | 'weapon' | 'key'
export const ITEMS = {
  cog:        { name: 'Brass Cog',      icon: '⚙️', kind: 'material',   price: 8,   desc: 'A well-machined little gear. Trina hoards these.' },
  spring:     { name: 'Coiled Spring',  icon: '🌀', kind: 'material',   price: 12,  desc: 'Boing. Full of stored intent.' },
  scrap:      { name: 'Scrap Metal',    icon: '🔩', kind: 'material',   price: 4,   desc: 'Bent, rusted, and honestly kind of useless. Sells cheap.' },
  tea:        { name: 'Chamomile Tea',  icon: '🍵', kind: 'consumable', price: 15,  heal: 30,  desc: 'Restores 30 HP. Warm and steadying.' },
  scone:      { name: 'Currant Scone',  icon: '🧁', kind: 'consumable', price: 25,  heal: 60,  desc: 'Restores 60 HP. Baked by Mabel, still warm.' },
  oilcan:     { name: 'Lantern Oil',    icon: '🛢️', kind: 'consumable', price: 20,  mp: 20,    desc: 'Restores 20 SP. Keeps your gadgets humming.' },
  smokebomb:  { name: 'Smoke Pellet',   icon: '💨', kind: 'consumable', price: 18,  flee: true, desc: 'Guarantees escape from a battle.' },
  wrench:     { name: 'Trusty Wrench',  icon: '🔧', kind: 'weapon',     price: 40,  atk: 4,    desc: '+4 ATK. Good for bolts and bandits alike.' },
  sparkrod:   { name: 'Spark Rod',      icon: '⚡', kind: 'weapon',     price: 90,  atk: 9,    desc: '+9 ATK. Crackles menacingly.' },
  goldgear:   { name: 'Golden Gear',    icon: '🏅', kind: 'key',        price: 0,   desc: "The mayor's heirloom. Do not sell this. Seriously." },
  charm:      { name: 'Tinker Charm',   icon: '🧿', kind: 'key',        price: 0,   desc: 'A lucky trinket from Trina. Warms slightly in your pocket.' },
};

// ---- Party / player abilities ----
export const ABILITIES = {
  overclock: { name: 'Overclock',  cost: 8,  power: 22, desc: 'A focused burst. 22 dmg to one foe.' },
  scattergear:{name: 'Scatter-Gear',cost: 14, power: 12, aoe: true, desc: '12 dmg to ALL foes.' },
  patch:     { name: 'Patch Up',   cost: 10, heal: 45, desc: 'Restore 45 HP to yourself.' },
};

// ---- Enemies ----
export const ENEMIES = {
  cogsprite:  { name: 'Cog Sprite',   sprite: '🐛', hp: 24,  atk: 6,  def: 1, exp: 6,  gold: 8,  drops: [['cog',0.6],['scrap',0.4]] },
  rustcrab:   { name: 'Rust Crab',    sprite: '🦀', hp: 40,  atk: 9,  def: 4, exp: 12, gold: 15, drops: [['scrap',0.7],['spring',0.3]] },
  bandit:     { name: 'Lane Bandit',  sprite: '🦝', hp: 55,  atk: 13, def: 3, exp: 20, gold: 30, drops: [['scrap',0.5]] },
  gearwolf:   { name: 'Gear-Wolf',    sprite: '🐺', hp: 70,  atk: 16, def: 5, exp: 30, gold: 40, drops: [['spring',0.5],['cog',0.5]] },
  bigbertha:  { name: 'Big Bertha',   sprite: '🤖', hp: 220, atk: 20, def: 8, exp: 120,gold: 200,drops: [['sparkrod',1]], boss: true },
};

// ---- Encounter tables per map ----
export const ENCOUNTERS = {
  lane:    { rate: 0,   pool: [] },                       // safe town
  wilds:   { rate: 0.14, pool: ['cogsprite','cogsprite','rustcrab','bandit'] },
  gully:   { rate: 0.18, pool: ['rustcrab','bandit','gearwolf'] },
};

// ---- Quests ----
// Steps advance via flags set by NPC/story logic. `check(state)` returns true when complete.
export const QUESTS = {
  main_gear: {
    name: "The Mayor's Golden Gear",
    desc: "Mayor Pilcrow's heirloom gear went missing in the Whistling Wilds. Find it.",
    check: (s) => s.hasItem('goldgear'),
    reward: { gold: 100, exp: 40 },
  },
  side_tea: {
    name: "Mabel's Missing Kettle",
    desc: "Mabel the baker lost her copper kettle to a Rust Crab down in Gutter Gully.",
    check: (s) => s.flags.kettleReturned,
    reward: { gold: 50, item: 'scone' },
  },
  side_scraps: {
    name: "Spare Parts for Trina",
    desc: "Bring Trina 5 Scrap Metal so she can finish her contraption.",
    check: (s) => s.flags.scrapsGiven,
    reward: { gold: 30, item: 'sparkrod' },
  },
};

// ---- Shop inventory (item ids the shop will buy/sell) ----
export const SHOP_STOCK = ['tea','scone','oilcan','smokebomb','wrench','sparkrod'];

// ---- NPC dialogue trees ----
// Each entry is a function of (state) returning an array of lines OR a special action object.
export const NPCS = {
  trina: {
    name: 'Trina',
    sprite: '👩‍🔧',
    talk: (s) => {
      if (!s.flags.metTrina) {
        s.flags.metTrina = true;
        s.startQuest('main_gear');
        s.startQuest('side_scraps');
        return [
          ["Trina", "There you are! Knew it was you — that squeaky floorboard gives everyone away."],
          ["Trina", "Listen, big news down the lane. Mayor Pilcrow's precious Golden Gear's gone and wandered off into the Whistling Wilds."],
          ["Trina", "You're handier than you let on. Go have a poke around, would you? East gate takes you straight there."],
          ["Trina", "Oh — and if you scrounge up 5 bits of scrap metal out there, bring 'em back. I'm building something *marvelous.*"],
        ];
      }
      if (s.hasItem('goldgear') && !s.flags.gearReturned) {
        return [["Trina", "You FOUND it?! Ha! Pilcrow'll weep. Best take it to him at the town hall, north end of the lane."]];
      }
      if (s.countItem('scrap') >= 5 && !s.flags.scrapsGiven) {
        return { action: 'giveScraps' };
      }
      if (s.flags.scrapsGiven) {
        return [["Trina", "That spark rod treating you well? Course it is. I made it."],
                ["Trina", "Go on, hero. The lane's not going to save itself. ...probably."]];
      }
      return [["Trina", "Built, broken, or something you broke and don't want to admit to? I'm here for all three."]];
    }
  },
  mabel: {
    name: 'Mabel',
    sprite: '👩‍🍳',
    talk: (s) => {
      if (!s.hasQuest('side_tea') && !s.flags.kettleReturned) {
        s.startQuest('side_tea');
        return [
          ["Mabel", "Oh, thank goodness, a friendly face. My copper kettle — a nasty Rust Crab dragged it into Gutter Gully!"],
          ["Mabel", "Without it I can't brew, and without brewing there are no scones. It's a catastrophe of pastry."],
          ["Mabel", "Gully's south of the wilds. Bring my kettle back and the ovens are yours, dear."],
        ];
      }
      if (s.flags.hasKettle && !s.flags.kettleReturned) {
        s.flags.kettleReturned = true;
        s.completeQuest('side_tea');
        return [["Mabel", "My kettle! Oh, you wonderful thing. Here — scones, on the house, forever."]];
      }
      if (s.flags.kettleReturned) {
        return [["Mabel", "Fresh scones today, love. You've earned first pick."]];
      }
      return [["Mabel", "Mind the crabs down in the gully, dear."]];
    }
  },
  pilcrow: {
    name: 'Mayor Pilcrow',
    sprite: '🎩',
    talk: (s) => {
      if (s.hasItem('goldgear') && !s.flags.gearReturned) {
        s.flags.gearReturned = true;
        s.removeItem('goldgear');
        s.completeQuest('main_gear');
        s.flags.berthaUnlocked = true;
        return [
          ["Mayor Pilcrow", "My Golden Gear! You magnificent soul. This has been in my family six generations."],
          ["Mayor Pilcrow", "But I must warn you — the thing that STOLE it still lurks. A great clanking brute the wilds-folk call Big Bertha."],
          ["Mayor Pilcrow", "She's dug in at the end of the gully. Deal with her, and Coppergate will sing your name. Take this reward, and be careful."],
        ];
      }
      if (s.flags.berthaDefeated) {
        return [["Mayor Pilcrow", "Big Bertha, felled! The lane sleeps easy. You'll always have a home in Coppergate."]];
      }
      if (s.flags.gearReturned) {
        return [["Mayor Pilcrow", "Big Bertha still lurks at the gully's end. When you're ready, friend."]];
      }
      return [["Mayor Pilcrow", "My Golden Gear... lost to the wilds. I'd be forever grateful to whoever returned it."]];
    }
  },
  shopkeep: {
    name: 'Bertram',
    sprite: '🧑‍🦳',
    talk: () => ({ action: 'openShop' })
  },
};
