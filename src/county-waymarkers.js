const SLUGS=['wickmere','ash-end','briarfield','north-drain','blackwood','morrow-quay','st-marrow','hollow-crown'];
// Facing incoming walkers on the left verge; poles stay outside the 8 m carriageway.
export function buildCountyWaymarkers({place,towns,route,collisions=[]}) {
  const markers=[];
  towns.forEach((town,index)=>{
    const at=route.findIndex(([x,z])=>x===town.x&&z===town.z);
    let chosen;
    const blocked=(x,z,pad)=>collisions.some(c=>Math.abs(x-c.x)<c.w/2+pad&&Math.abs(z-c.z)<c.d/2+pad);
    for (const distance of [62,54,70,46,78,38,86]) {
      let remaining=distance,end=route[at],start=route[at-1],segment=at;
      while(segment>1 && Math.hypot(end[0]-start[0],end[1]-start[1])<remaining) {
        remaining-=Math.hypot(end[0]-start[0],end[1]-start[1]);end=start;start=route[--segment-1];
      }
      const length=Math.hypot(end[0]-start[0],end[1]-start[1]),dx=(end[0]-start[0])/length,dz=(end[1]-start[1])/length;
      for (const verge of [7.5,9.5]) {
        const roadX=end[0]-dx*remaining,roadZ=end[1]-dz*remaining;
        const x=roadX-dz*verge,z=roadZ+dx*verge;
        if (blocked(x,z,1.1)) continue;
        const readX=x-dx*1.6,readZ=z-dz*1.6;
        let clear=true;
        for(let step=0;step<=24;step++) {
          const t=step/24;
          if(blocked(roadX+(readX-roadX)*t,roadZ+(readZ-roadZ)*t,.3)){clear=false;break;}
        }
        if(clear){chosen={x,z,rotation:Math.atan2(-dx,-dz)};break;}
      }
      if(chosen)break;
    }
    if(!chosen)throw new Error(`No accessible roadside position for ${SLUGS[index]} sign`);
    const {x,z,rotation}=chosen;
    place('waymarker-'+SLUGS[index],x,z,0,rotation);
    markers.push({x,z,district:index});
  });
  return markers;
}
