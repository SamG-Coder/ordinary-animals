// Explicit fixtures and business callbacks only. No browser input is dispatched.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
if (!process.argv.includes('--run')) { console.log('Dormant. Pass --run for no-input mobile battle checks.'); process.exit(0); }
await mkdir('artifacts', { recursive:true });
const browser = await chromium.launch({channel:'msedge',headless:true});
const report = {scope:'Explicit battle/save fixtures, original menu callbacks and projected animal bounds in emulated portrait viewports. No earned progression, physical device or input-dispatch claim.',checks:[],errors:[]};
try {
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  page.on('pageerror', error => report.errors.push(error.message));
  await page.addInitScript(()=>{
    HTMLElement.prototype.focus=()=>{};
    HTMLElement.prototype.click=()=>{throw Error('Input forbidden');};
    Element.prototype.requestPointerLock=()=>{throw Error('Pointer lock forbidden');};
    document.exitPointerLock=()=>{};
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`\nwindow.__mobileBattle={
      setup(species='cat') {if(battle)endBattle(false);state=initialSave();state.note=true;state.bagTaken=true;state.starter=species;state.party=[makeAnimal(species,5),makeAnimal('dog',5)];enterWorld();close(false);position.set(24,EYE_HEIGHT,-12);yaw=0;pitch=-.045;startBattle({kind:'rival',id:'mobile-layout-fixture',name:'Rowan',roster:['hamster'],level:4});},
      menu(name){if(name==='fight')$('fight-btn').onclick();else if(name==='bag')$('bag-btn').onclick();else if(name==='party')$('switch-btn').onclick();else if(name==='root')phoneHome();},
      finishedFixture(){battle.finished=true;battle.busy=false;$('battle-log').textContent='Fixture result for checking the Continue layout.';$('battle-continue').hidden=false;renderBattle();},
      snapshot(){
        const rect=el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
        const phoneRect=rect($('phone')), hardware=rect($('phone').querySelector('.phone-hardware'));
        const buttons=[...$('phone').querySelectorAll('button')].filter(b=>!b.closest('[hidden]')&&b.getClientRects().length).map(b=>{const r=rect(b),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{id:b.id,text:b.textContent,disabled:b.disabled,rect:r,reachable:hit===b||b.contains(hit)};});
        const animal=a=>{const box=new THREE.Box3().setFromObject(a.root);let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new THREE.Vector3(x,y,z).project(camera);const px=(p.x+1)*innerWidth/2,py=(1-p.y)*innerHeight/2;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}return{minX,minY,maxX,maxY};};
        return{phoneRect,hardware,buttons,modal,menu:battle.menu,animals:[animal(battle.left),animal(battle.right)],screen:rect($('phone-screen')),hp:[$('enemy-status').textContent,$('ally-status').textContent],scrollTop:$('phone-screen').scrollTop};
      }
    };`});
  });
  await page.goto('http://127.0.0.1:5174');
  await page.waitForFunction(()=>window.__mobileBattle&&!document.getElementById('begin').disabled,null,{timeout:60000});
  for (const viewport of [{width:390,height:844},{width:360,height:640},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    await page.evaluate(()=>window.__mobileBattle.setup());
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,300)));
    for (const menu of ['root','fight','bag','party','root','finished']) {
      await page.evaluate(menu=>menu==='finished'?window.__mobileBattle.finishedFixture():window.__mobileBattle.menu(menu),menu);
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const s=await page.evaluate(()=>window.__mobileBattle.snapshot());
      const path='artifacts/mobile-battle-'+viewport.width+'-'+menu+'.png';
      await page.screenshot({path});
      report.checks.push({viewport,phase:menu,...s});
      assert.ok(Math.abs(s.phoneRect.width/s.phoneRect.height-74/157)<.001,'Preserve authored handset proportions');
      assert.ok(s.phoneRect.y>=viewport.height*.35,'Leave the upper world visible');
      assert.ok(s.hardware.y+s.hardware.height<=viewport.height+1,'Phone screen stays within viewport');
      for(const animal of s.animals) assert.ok(animal.minX>=0&&animal.maxX<=viewport.width&&animal.minY>=0&&animal.maxY<s.phoneRect.y,'Both complete animals stay above the phone');
      const required=menu==='root'?['fight-btn','bag-btn','switch-btn','run-btn']:menu==='bag'?['capture-btn','heal-btn']:menu==='finished'?['battle-continue']:menu==='party'?['phone-home','phone-back']:[];
      const commands=menu==='fight'?s.buttons.filter(b=>['Scratch','Bite','Hiss'].some(move=>b.text.startsWith(move))):s.buttons.filter(b=>required.includes(b.id));
      assert.equal(commands.length,menu==='fight'?3:required.length,'Expected controls exist');
      for(const b of commands) assert.ok(b.reachable&&b.rect.height>=44&&b.rect.width>=44, b.text+' must be visible and reachable at44px minimum');
    }
  }
  assert.deepEqual(report.errors,[]);
} catch(error) {report.failure=String(error.stack);process.exitCode=1;}
finally {await browser.close();await writeFile('artifacts/mobile-battle-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify({checks:report.checks.length,errors:report.errors,failure:report.failure}));}
