/** Reviewed original sprite rectangles. PNG source pixels remain unmodified. */
import {buildStandardManifest} from './standard-manifest.js'
import {SECONDARY_ART} from './art-secondary.js'

// One scale for an entire authored action; anchors fix the layout ground, not each frame's height.
const frames=(sheet,rows,scale=1,lift=[])=>rows.map(([x,y,w,h,ax,ay],i)=>({
  sheet,rect:[x,y,w,h],at:[Math.round((160-ax*scale)*100)/100,Math.round((350-ay*scale+(lift[i]??0))*100)/100],
  size:[Math.round(w*scale*100)/100,Math.round(h*scale*100)/100]
}))
const loop=(frames,durations)=>({frames,durations,loop:true})
const once=(frames,durations)=>({frames,durations,loop:false})
const cycle=(frames,indices)=>indices.map(index=>frames[index])

const idle=frames('core',[[49,2,301,368,132.3,363],[409,2,296,368,131.6,363],[767,3,304,367,137.7,362],[1129,1,301,369,134.1,364],[1491,8,296,362,135.5,357],[1847,2,295,368,127.4,363]],0.84)
const thinking=frames('core',[[27,370,318,351,159.0,343],[395,370,316,351,158.0,343],[755,370,319,350,159.5,342],[1114,372,318,350,159.0,342],[1477,370,315,351,157.5,343],[1837,371,314,350,157.0,342]],0.84)
const searching=frames('research',[[15,26,322,376,161.0,368],[346,25,319,378,159.5,370],[669,31,315,372,157.5,366],[995,30,321,373,160.5,366],[1322,28,319,375,159.5,368],[1641,27,315,375,157.5,367]],0.8)
const editing=frames('research',[[21,403,318,375,159.0,367],[347,411,316,365,158.0,357],[669,403,320,373,160.0,365],[996,403,317,374,158.5,366],[1324,410,317,369,159.0,361],[1647,407,311,372,155.5,364]],0.8)
const commanding=frames('commands',[[39,14,325,354,162.5,351],[404,9,315,359,157.5,356],[759,8,329,360,164.5,357],[1122,9,332,359,166.0,356],[1486,12,325,356,162.5,353],[1850,8,311,360,155.5,357]],0.84)
const testing=frames('commands',[[38,368,323,356,161.5,348],[405,372,320,352,160.0,344],[762,368,326,356,163.0,348],[1124,368,323,356,161.5,348],[1488,368,323,356,161.5,348],[1850,368,314,356,157.0,348]],0.84)
const waiting=frames('results',[[179,17,252,308,136.4,305],[506,25,251,300,134.4,298],[824,17,264,308,128.2,306],[182,325,260,311,135.4,309],[506,325,255,311,135.0,310],[830,325,257,311,133.2,308]],0.98)
const success=frames('results',[[187,643,249,308,124.5,308],[499,669,276,282,138.0,280],[794,636,327,315,163.5,309],[176,975,297,276,148.5,268],[514,951,258,300,129.0,292],[834,951,255,299,127.5,291]],0.92,[0,0,-12,-20,-6,0])
const error=frames('drag',[[230,12,242,322,114.7,314],[515,12,251,321,133.5,313],[829,16,231,318,105.2,314],[227,334,246,319,120.3,312],[517,334,254,319,124.7,313],[831,334,238,319,114.8,312]],0.94)
const dragging=frames('drag',[[207,653,271,309,135.5,304],[509,664,269,298,134.5,297],[813,653,270,309,135.0,304],[214,962,276,289,138.0,281],[517,962,271,291,135.5,283],[818,962,263,287,131.5,279]],0.98)
const landing=frames('touch',[[115,1,332,345,166.0,337],[476,22,315,324,157.5,323],[831,73,319,273,159.5,271],[133,346,301,330,150.5,325],[501,346,288,330,144.0,325],[864,346,271,330,135.5,326]],0.89)
const head_pat=frames('touch',[[147,676,265,298,133.6,298],[509,685,260,289,129.0,289],[864,682,284,292,135.6,292],[151,974,267,280,145.0,276],[525,978,263,276,142.1,273],[878,974,255,280,127.5,277]],1.03)
const poke=frames('reactions',[[197,24,224,300,112.0,297],[524,25,227,300,113.5,297],[854,24,222,299,111.0,296],[201,331,227,303,113.5,300],[520,330,232,304,116.0,301],[852,329,224,305,112.0,302]],1.0)
const tail=frames('reactions',[[191,642,224,292,112.0,289],[481,649,279,279,139.5,276],[828,647,289,282,144.5,279],[172,946,277,283,138.5,280],[497,948,270,279,135.0,276],[855,940,221,297,110.5,294]],1.02)
const stretch=frames('micro',[[177,20,221,307,110.5,304],[520,26,226,301,113.0,298],[855,23,286,307,143.0,305],[162,330,262,310,131.0,307],[518,330,231,310,115.5,307],[882,331,221,309,110.5,306]],1.0)
const yawn=frames('micro',[[177,647,221,307,110.5,304],[522,650,226,304,113.0,301],[881,647,228,307,114.0,304],[174,956,240,298,120.0,295]],1.0)
const stellaIdle=frames('core',[[182,4,282,423,141.0,422],[501,5,285,422,142.5,421],[819,5,285,422,142.5,421]],0.72)
const stellaWork=frames('core',[[34,846,267,408,133.5,405],[340,846,273,408,136.5,405],[661,846,275,408,137.5,405]],0.72)

export const ART = {
  gpt:buildStandardManifest({
    revision:'anatomy-fix-20261025-1',canvas:[320,380],
    sheets:{core:'gpt-core-v2.png',research:'gpt-research-edit-v1.png',commands:'gpt-command-test-v1.png',results:'gpt-wait-success-v1.png',drag:'gpt-error-drag-v1.png',touch:'gpt-land-pat-v1.png',reactions:'gpt-poke-tail-v1.png',micro:'gpt-idle-micro-v1.png'},
    stateMap:{idle:'idle',thinking:'thinking',working:'commanding',waiting:'waiting',success:'success',error:'error'},
    workingActivityMap:{searching:'searching',editing:'editing',commanding:'commanding',testing:'testing'},
    idleMicroClips:['stretch','yawn'],
    clips:{
      idle:loop(idle,[2600,90,75,110,350,500]),
      thinking:loop(thinking,[650,300,100,160,350,650]),
      searching:loop(searching,[700,220,280,220,400,500]),
      editing:loop(editing,[280,200,220,360,200,300]),
      commanding:loop(commanding,[300,160,180,160,180,300]),
      testing:loop(testing,[600,260,300,200,350,500]),
      waiting:loop(waiting,[1500,250,300,180,280,650]),
      success:once(success,[180,130,190,200,180,600]),
      error:once(error,[150,180,220,420,260,800]),
      dragging:loop(dragging,[160,140,180,160,140,180]),
      landing:once(landing,[70,85,120,120,130,220]),
      head_pat:once(head_pat,[150,180,280,350,220,300]),
      poke:once(poke,[100,160,220,260,180,280]),
      tail:once(tail,[120,180,240,240,180,350]),
      stretch:once(stretch,[220,250,500,450,250,450]),
      // The two bottom-right source poses touch the image edge and are excluded.
      yawn:once(cycle(yawn,[0,1,2,3,2,1,0]),[200,250,300,650,220,180,450])
    }
  }),
  stella:buildStandardManifest({
    revision:'reviewed-20261024-1',canvas:[320,380],sheets:{core:'stella-core-v1.png'},
    stateMap:{idle:'idle',working:'working'},
    clips:{
      // Actual atlas has ten figures; use the three safe first-row and first three work poses.
      idle:loop(cycle(stellaIdle,[0,1,2,1,0]),[3000,100,80,120,450]),
      working:loop(cycle(stellaWork,[0,1,2,1,0]),[550,300,250,300,500])
    }
  }),
  ...SECONDARY_ART
}
export const artFor=id=>Object.hasOwn(ART,id)?ART[id]:ART.stella
