export function insertHollowCrownRoadDetour(route) {
  return route.flatMap((p,i)=>p[0]===220&&p[1]===160&&route[i+1]?.[0]===45 ? [p,[86,268]] : [p]);
}
export function buildHollowCrown({place,lamp}) {
  place('league-inspection-office',62,233);
  for(const x of [58,62,66]) for(const z of [240,244]) place('court-paving-4m',x,z);
  for(let x=48;x<=62;x+=2) place('path-2m',x,250,0,Math.PI/2,1.3,true,1/1.3);
  for(let z=248;z>=246;z-=2) place('path-2m',62,z,0,0,1.3,true,1/1.3);
  place('inspection-barrier',59.7,247,0,Math.PI);
  place('inspection-notice',55.4,246.1);
  for(const [x,z,rotation] of [[56,239,.3],[68,246,-.6]]) place('cctv-mast',x,z,0,rotation,1,false);
  place('estate-railing-3m',53,247);
  for(const x of [68,71]) place('estate-railing-3m',x,247);
  for(const z of [243,240,237,234,231]) place('estate-railing-3m',73,z,0,Math.PI/2);
  place('wheelie-bin',69,232);
  place('storm-drain',65.4,245);
  place('puddle',59,239,.01,.4,1.8);
  lamp(52,245);lamp(70,239);
  return {interactions:[{id:'inspection-notice',x:55.4,z:246.1,label:'Read the final inspection notice',radius:2.2,title:'FINAL INSPECTION',lines:['Eight badges. One ten-year-old. No guardian present.','The form asks whether you have learned responsibility. Nobody has filled in the section for the adults.']}]};
}
