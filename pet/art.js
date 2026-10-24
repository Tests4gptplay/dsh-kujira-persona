/** Candidate sprite manifests. Original static files remain untouched. */
function row(sheet,y0,y1,baseline) {
  return Array.from({length:6},(_,index)=>{
    const x=Math.round(index*1774/6),right=Math.round((index+1)*1774/6)
    return {sheet,rect:[x,y0,right-x,y1-y0],at:[(320-(right-x))/2,350-(baseline-y0)]}
  })
}
const a0=row('work',0,325,311),a1=row('work',325,610,600),a2=row('work',610,887,868)
const b0=row('status',0,323,307),b1=row('status',323,620,607),b2=row('status',620,887,881)
const c0=row('workKinds',0,305,290),c1=row('workKinds',305,591,585),c2=row('workKinds',591,887,877)
const closeLoop=frames=>[...frames.slice(0,5),frames[0]]
export const ART = {
  gpt:{
    revision:'draft-20261024-3',canvas:[320,380],
    sheets:{work:'gpt-work-draft.png',status:'gpt-status-draft.png',workKinds:'gpt-work-kinds-draft.png'},
    stateMap:{idle:'idle',thinking:'thinking',working:'commanding',waiting:'waiting',success:'success',error:'error'},
    workingActivityMap:{searching:'searching',editing:'editing',commanding:'commanding',testing:'testing'},
    clips:{
      idle:{frames:a0,durations:[3000,90,70,100,90,350],loop:true},
      thinking:{frames:a1,durations:[500,220,400,100,200,500],loop:true},
      commanding:{frames:[a2[0],a2[1],a2[2],a2[5],a2[1],a2[2],...a2],frameMs:140,loop:true},
      searching:{frames:closeLoop(c0),durations:[1100,300,300,200,450,400],loop:true},
      editing:{frames:closeLoop(c1),durations:[350,250,300,450,150,350],loop:true},
      testing:{frames:closeLoop(c2),durations:[600,400,450,250,400,500],loop:true},
      waiting:{frames:b0,durations:[1800,300,350,100,300,600],loop:true},
      success:{frames:b1,durations:[220,120,180,140,200,700],loop:false},
      error:{frames:b2,durations:[160,160,200,420,180,900],loop:false}
    }
  }
}
export const artFor=id=>Object.hasOwn(ART,id)?ART[id]:null

