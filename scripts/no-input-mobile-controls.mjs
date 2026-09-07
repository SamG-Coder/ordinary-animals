import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
if (!process.argv.includes('--run')) { console.log('Dormant mobile controls check. Pass --run for isolated no-input verification.'); process.exit(0); }
const browser = await chromium.launch({channel:'msedge',headless:true});
const report = { scope:'Emulated touch viewports and direct controller state; no browser mouse, keyboard, synthetic events, focus or pointer lock. Not physical phone validation.', checks:[], errors:[] };
try {
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
    HTMLElement.prototype.focus=()=>{};
    HTMLElement.prototype.click=()=>{throw Error('Input forbidden');};
    Element.prototype.requestPointerLock=()=>{throw Error('Pointer lock forbidden');};
    document.exitPointerLock=()=>{};
  });
  await page.route('**/src/main.js*',async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:await response.text()+`\nwindow.__mobileCheck={
      setup(){state=initialSave();state.note=true;state.bagTaken=true;enterWorld();close(false);position.set(0,EYE_HEIGHT,1.5);yaw=0;pitch=0;updatePhone();},
      drive(){touchControls.input.beginMove(1,0,-40,0,0,40);},
      stop(){touchControls.input.end(1);},
      menu(){showJournal('apps');}, close,
      snapshot(){const rect=id=>{const r=$(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};const stick=rect('move-stick');const hit=document.elementFromPoint(stick.x+stick.width/2,stick.y+stick.height/2);return{position:{x:position.x,z:position.z},axes:{...touchControls.input.axes},enabled:touchControls.enabled,hidden:$('touch').hidden,display:getComputedStyle($('touch')).display,stick,torch:rect('touch-torch'),sprint:rect('touch-sprint'),pointerEvents:getComputedStyle($('move-stick')).pointerEvents,touchAction:getComputedStyle(renderer.domElement).touchAction,stickReceivesTouch:hit?.closest('#move-stick')!==null,rightCanvas:document.elementFromPoint(innerWidth*.75,innerHeight*.4)===renderer.domElement};}
    };`});
  });
  await page.goto('http://127.0.0.1:5174');
  await page.waitForFunction(()=>window.__mobileCheck&&!document.getElementById('begin').disabled,null,{timeout:60000});
  await page.evaluate(()=>window.__mobileCheck.setup());
  for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(viewport);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    let s=await page.evaluate(()=>window.__mobileCheck.snapshot());
    assert.ok(s.enabled&&!s.hidden&&s.display==='block');
    assert.equal(s.touchAction,'none');assert.equal(s.pointerEvents,'auto');assert.ok(s.stickReceivesTouch);assert.ok(s.rightCanvas);
    for(const r of [s.stick,s.torch,s.sprint]) assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width&&r.y+r.height<=viewport.height);
    const before=s.position.z;
    await page.evaluate(()=>window.__mobileCheck.drive());
    await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)));
    s=await page.evaluate(()=>window.__mobileCheck.snapshot());
    assert.ok(s.position.z<before-.15,'Joystick state must move actual player through the ordinary frame loop');
    await page.evaluate(()=>window.__mobileCheck.menu());
    s=await page.evaluate(()=>window.__mobileCheck.snapshot());
    assert.ok(s.hidden&&s.axes.x===0&&s.axes.z===0,'Opening phone must stop movement and hide controls');
    await page.evaluate(()=>window.__mobileCheck.close(false));
    await page.screenshot({path:'artifacts/mobile-controls-'+viewport.width+'.png'});
    report.checks.push({viewport,...await page.evaluate(()=>window.__mobileCheck.snapshot())});
  }
  assert.deepEqual(report.errors,[]);
} catch(error) {report.failure=String(error.stack);process.exitCode=1;}
finally {await browser.close();await writeFile('artifacts/mobile-controls-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
