globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:()=>()=>{}})}),addEventListener:()=>{}};
globalThis.window={addEventListener:()=>{},devicePixelRatio:1};
const wake=await import('../js/game/wake.js');
const C=await import('../js/game/constants.js');
const {makeProbe}=await import('../js/game/probe.js');
const noInput={axis:{x:0,y:0},flip:false,silent:false,pause:false};
// Build a dense wall and measure repulsion vs the inward drift at wave N.
wake.resetWake();
const p=makeProbe();
for(let i=-8;i<=8;i++){p.x=C.CORE_X+i*3.6;p.y=C.CORE_Y-40;p.pol=C.POS;p.vx=40;wake.updateWake(1/60*10,p,{...noInput});}
p.x=9999;p.y=9999;
wake.updateWake(1/60,p,{...noInput,silent:true});
console.log('wall echoes:',wake.echoCount());
for(const dy of [4,8,12,16,20,26]){
  const out={fx:0,fy:0};
  wake.wakeForceAt(C.CORE_X, C.CORE_Y-40-dy, C.POS, out);
  console.log('at',dy+'px from wall: repel fy =', out.fy.toFixed(1));
}
console.log('\ninward drift accel by wave:');
const {difficultyFor}=await import('../js/game/waves.js');
for(const w of [1,5,10,15,20]){
  console.log(' wave',w, (C.MOTE_DRIFT*difficultyFor(w).driftMult).toFixed(1));
}
