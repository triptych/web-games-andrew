export const SAVE_KEY = 'colorverse-save-v1';
export function blankProgress(artworks) { return {version:1,fills:Object.fromEntries(artworks.map(a=>[a.id,{}])),collected:[]}; }
export function normalizeProgress(raw, artworks) {
  const blank=blankProgress(artworks);
  if(!raw || raw.version!==1 || typeof raw!=='object') return blank;
  for(const art of artworks){const source=raw.fills?.[art.id];if(!source||typeof source!=='object')continue;for(const region of art.regions){const color=source[region.id];if(typeof color==='string' && /^#[0-9a-f]{6}$/i.test(color))blank.fills[art.id][region.id]=color;}}
  blank.collected=Array.isArray(raw.collected)?raw.collected.filter(id=>artworks.some(a=>a.id===id)):[];return blank;
}
export function isComplete(art,fills){return art.regions.every(region=>Boolean(fills?.[region.id]));}
export function completionCount(artworks,progress){return artworks.filter(art=>progress.collected.includes(art.id)).length;}
