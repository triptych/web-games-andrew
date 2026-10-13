// The Inkwell Emporium: Mott's shop. Assets and cosmetics only, never tools.
import { registerPacks } from './progress.js';

export const SHOP = [
    { id: 'tileset.spooky', cat: 'Tilesets', name: 'Spooky Hollow', price: 300, desc: 'Dead trees, graves, jack-o\'-lanterns, crypts, fog and cobwebs.', preview: { tileset: 'spooky' } },
    { id: 'tileset.starship', cat: 'Tilesets', name: 'Starship', price: 400, desc: 'Deck plates, consoles, viewports full of stars, reactors and holograms.', preview: { tileset: 'starship' } },
    { id: 'tileset.sky', cat: 'Tilesets', name: 'Sky Isles', price: 600, desc: 'Clouds, rainbow bridges, golden temples and star flowers. (Also yours free at the end of the story.)', preview: { tileset: 'sky' } },
    { id: 'sprites.royal', cat: 'Sprite parts', name: 'Royal Headgear', price: 150, desc: 'Crowns, tiaras and plumed hats for the Sprite Forge.', preview: { sprites: ['king', 'queen', 'bard'] } },
    { id: 'sprites.critters', cat: 'Sprite parts', name: 'Critters', price: 200, desc: 'Cat, slime, ghost and robot bodies, as NPCs and in the Forge.', preview: { sprites: ['cat', 'slime', 'ghost', 'robot'] } },
    { id: 'sprites.adventurer', cat: 'Sprite parts', name: 'Adventurer Kit', price: 150, desc: 'Capes, scarves and spectacles for the Forge.', preview: { sprites: ['hero', 'thief', 'scholar'] } },
    { id: 'monsters.dragonkin', cat: 'Monsters', name: 'Dragonkin', price: 250, desc: 'Drakes, wyverns and a proper dragon.', preview: { monsters: ['drake', 'wyvern', 'dragon'] } },
    { id: 'monsters.constructs', cat: 'Monsters', name: 'Constructs', price: 200, desc: 'Golems, sentinels and a treasure chest with teeth.', preview: { monsters: ['golem', 'sentinel', 'mimic'] } },
    { id: 'monsters.undead', cat: 'Monsters', name: 'Undead', price: 200, desc: 'Skeletons, wraiths and a lich with opinions.', preview: { monsters: ['skeleton', 'wraith', 'lich'] } },
    { id: 'music.haunted', cat: 'Music', name: 'Haunted', price: 120, desc: 'A theme for crypts and creaking houses.', preview: { music: 'haunted' } },
    { id: 'music.frost', cat: 'Music', name: 'Frost', price: 120, desc: 'Bells over snowfields.', preview: { music: 'frost' } },
    { id: 'music.dunes', cat: 'Music', name: 'Dunes', price: 120, desc: 'Heat haze and caravans.', preview: { music: 'dunes' } },
    { id: 'music.starlight', cat: 'Music', name: 'Starlight', price: 150, desc: 'For starships and the space between.', preview: { music: 'starlight' } },
    { id: 'music.festival', cat: 'Music', name: 'Festival', price: 150, desc: 'Lanterns, dancing, too much cake.', preview: { music: 'festival' } },
    { id: 'music.heroic', cat: 'Music', name: 'Heroic', price: 150, desc: 'For the march to the final castle.', preview: { music: 'heroic' } },
    { id: 'skin.parchment', cat: 'Window skins', name: 'Parchment', price: 100, desc: 'Dialogue on old paper.', preview: { skin: 'parchment' } },
    { id: 'skin.midnight', cat: 'Window skins', name: 'Midnight', price: 100, desc: 'Ink-dark windows with silver edges.', preview: { skin: 'midnight' } },
    { id: 'skin.forest', cat: 'Window skins', name: 'Forest', price: 100, desc: 'Mossy green windows.', preview: { skin: 'forest' } },
    { id: 'skin.rose', cat: 'Window skins', name: 'Rose', price: 100, desc: 'Windows the colour of a good jam.', preview: { skin: 'rose' } },
    { id: 'skin.neon', cat: 'Window skins', name: 'Neon', price: 180, desc: 'Pink and cyan on black. Very 1988.', preview: { skin: 'neon' } },
    { id: 'theme.parchment', cat: 'Atelier themes', name: 'Parchment Atelier', price: 120, desc: 'The editor itself, on warm paper.', preview: { theme: 'parchment' } },
    { id: 'theme.midnight', cat: 'Atelier themes', name: 'Midnight Ink', price: 120, desc: 'The editor in deep blue-black.', preview: { theme: 'midnight' } },
    { id: 'theme.synthwave', cat: 'Atelier themes', name: 'Synthwave', price: 200, desc: 'The editor in neon. Mott\'s favourite.', preview: { theme: 'synthwave' } },
    { id: 'quill.tophat', cat: 'For Quillon', name: 'A Top Hat', price: 60, desc: 'Quillon has always wanted one. He will pretend not to.', preview: { quill: 'tophat' } },
    { id: 'quill.monocle', cat: 'For Quillon', name: 'A Monocle', price: 60, desc: 'For reading the small print.', preview: { quill: 'monocle' } },
    { id: 'quill.scarf', cat: 'For Quillon', name: 'A Knitted Scarf', price: 60, desc: 'The Atelier gets draughty.', preview: { quill: 'scarf' } },
];

registerPacks(SHOP.map((s) => s.id));
