// Computed box-shadow lengths are CSS pixels. Insets do not paint outside the surface.
export function shadowInsets(value='none',scale=1){
 const out={top:0,right:0,bottom:0,left:0};
 for(const layer of value.replace(/(?:rgba?|hsla?|color)\([^)]*\)/g,'').split(',')){
  if(/\binset\b/.test(layer))continue;
  const n=[...layer.matchAll(/(-?\d*\.?\d+)px/g)].map(m=>Number(m[1]));if(n.length<2)continue;
  const[x,y,blur=0,spread=0]=n,reach=Math.max(0,blur*2+spread);
  out.left=Math.max(out.left,reach-x);out.right=Math.max(out.right,reach+x);
  out.top=Math.max(out.top,reach-y);out.bottom=Math.max(out.bottom,reach+y);
 }
 return Object.fromEntries(Object.entries(out).map(([k,v])=>[k,Math.ceil(Math.max(0,v)*scale)]));
}
export function paintRect(rect,insets){return{x:rect.x-insets.left,y:rect.y-insets.top,width:rect.width+insets.left+insets.right,height:rect.height+insets.top+insets.bottom}}
