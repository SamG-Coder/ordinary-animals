// Placement of independent Blender foliage/log modules around the existing roads.
export function buildCountryside({place,route,towns,terrain,collisions}) {
  const placements=[];
  let seed=73211;
  const random=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);
  function roadDistance(x,z) {
    let nearest=Infinity;
    for(let i=1;i<route.length;i++) {
      const [ax,az]=route[i-1],[bx,bz]=route[i],dx=bx-ax,dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      nearest=Math.min(nearest,Math.hypot(x-ax-dx*t,z-az-dz*t));
    }
    return nearest;
  }
  function attempt(name,x,z,rotation=0,scale=1) {
    if(Math.hypot(x,z)<95 || towns.some(t=>Math.hypot(x-t.x,z-t.z)<57)) return;
    if(roadDistance(x,z)<7.5) return;
    if(collisions.some(c=>Math.abs(x-c.x)<c.w/2+2 && Math.abs(z-c.z)<c.d/2+2)) return;
    const heights=[terrain.height(x,z),terrain.height(x-1,z),terrain.height(x+1,z),terrain.height(x,z-1),terrain.height(x,z+1)];
    if(Math.max(...heights)-Math.min(...heights)>.32) return;
    place(name,x,z,0,rotation,scale);
    placements.push({asset:name,x,z,rotation,scale});
  }
  for(let segment=1;segment<route.length;segment++) {
    const [ax,az]=route[segment-1],[bx,bz]=route[segment];
    const length=Math.hypot(bx-ax,bz-az),dx=(bx-ax)/length,dz=(bz-az)/length;
    for(let distance=18;distance<length-18;distance+=17) for(const side of [-1,1]) {
      const verge=9+random()*5;
      const x=ax+dx*distance-dz*verge*side,z=az+dz*distance+dx*verge*side;
      const choice=random();
      attempt(choice<.53?'heather-bush':choice<.84?'bramble-hedge3m':'rotten-fence-post',x,z,Math.atan2(dx,dz)+Math.PI/2,.8+random()*.35);
      if(choice>.9) attempt('mossy-fallen-log3m',x-dz*4*side,z+dx*4*side,Math.atan2(dx,dz),.9);
    }
  }
  // Authored cluster locations follow the terrain modules without filling every hill.
  for(const [cx,cz] of [[-273,-120],[-190,-112],[-199,82],[-48,139],[-309,-114]]) {
    for(let i=0;i<14;i++) {
      const angle=random()*Math.PI*2,radius=4+random()*14;
      attempt(i%5===0?'bramble-hedge3m':'heather-bush',cx+Math.cos(angle)*radius,cz+Math.sin(angle)*radius,angle,.75+random()*.5);
    }
  }
  return placements;
}
