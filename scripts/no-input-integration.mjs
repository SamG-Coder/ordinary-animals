// Dormant until explicitly run after the requested world-building interval.
// Usage: node scripts/no-input-integration.mjs --run
// Calls original business functions through an appended, test-only module bridge.
// It NEVER clicks, types, presses keys, dispatches input events or focuses a page.
// Native focus and pointer-lock requests are stubbed before game code is loaded.
// Semantic position/save fixtures test logic and rendering, not walked traversal.
// Direct target callbacks also bypass line-of-sight/interaction selection.
import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

if (!process.argv.includes("--run")) {
  console.log(
    "Dormant integration harness. No browser or game actions were started. Run with --run only when the requested playtest time arrives.",
  );
  process.exit(0);
}

const bridge = String.raw`
// Test-only attachment appended to the original Vite response. No original
// function body, RNG source, asset, animation or timing is replaced.
window.__integration = {
  view() {
    const visible = id => {
      const el = $(id);
      return Boolean(el && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
    };
    const actorInfo = a => a ? { species:a.species,level:a.level,scale:a.root.scale.x,visible:a.root.visible,parent:Boolean(a.root.parent),x:a.root.position.x,y:a.root.position.y,z:a.root.position.z } : null;
    const rectInfo = id => {const r=$(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};};
    return {
      state: JSON.parse(JSON.stringify(state)), roundTrip: parseSave(JSON.stringify(state)),
      stored: parseSave(localStorage.getItem(SAVE_KEY)), playing, modal, currentTab,
      selectedStarter,position:{x:position.x,y:position.y,z:position.z},
      cameraPosition:{x:camera.position.x,y:camera.position.y,z:camera.position.z},titlePosition:{x:titlePosition.x,y:titlePosition.y,z:titlePosition.z},
      phoneClasses:[...$('phone').classList],hasHeldModel:$('phone').classList.contains('has-held-model'),phoneRect:rectInfo('phone'),phoneScreenRect:rectInfo('phone-screen'),
      phoneFocusableIds:phoneFocusables($('phone')).map(el=>el.id).filter(Boolean),
      visible:Object.fromEntries(['title-app','registration','settings-panel','dialogue','choose','journal','battle','phone','battle-root','move-buttons','battle-actions','battle-continue'].map(id=>[id,visible(id)])),
      phoneTitle:$('phone-app-title').textContent, objective:$('objective')?.textContent,
      contacts:$('tab-contacts').textContent,bagText:$('tab-bag').textContent,
      smsBubbles:[...$('tab-contacts').querySelectorAll('.sms-bubble')].map(el=>el.textContent),
      bagButtons:[...$('tab-bag').querySelectorAll('button')].map(el=>({text:el.textContent,disabled:el.disabled})),
      partyLeadButtons:[...$('tab-party').querySelectorAll(':scope > .party-row')].map(row=>{const button=row.querySelector('button');return{text:button?.textContent,disabled:button?.disabled};}),
      mapButtons:[...$('badge-list').querySelectorAll('button')].map(el=>({text:el.textContent,disabled:el.disabled})),
      room:roomAt(position.x,position.z),atSupplyCounter:atSupplyCounter(),
      bagVisible:worldInfo?.openingBag?.visible,bagUnavailable:targets.find(t=>t.id==='school-bag')?.unavailable,
      companion:actorInfo(companion),reusesStarter:[...starterAnimals.values()].includes(companion),
      starterActors:Object.fromEntries([...starterAnimals.entries()].map(([id,a])=>[id,{...actorInfo(a),unavailable:a.target.unavailable,removed:a.removed}])),
      battle:battle?{config:battle.config,enemy:battle.enemy,enemyIndex:battle.enemyIndex,active:battle.active,busy:battle.busy,finished:battle.finished,turn:battle.turn,menu:battle.menu,left:actorInfo(battle.left),right:actorInfo(battle.right),growthMessages:battle.growthMessages,log:$('battle-log').textContent,allyStatus:$('ally-status').textContent,enemyStatus:$('enemy-status').textContent,medkitDisabled:$('heal-btn').disabled}:null,
      safety:{...window.__inputStubs},pointerLocked:Boolean(document.pointerLockElement)
    };
  },
  register(playerName,rivalName) {
    open('registration');
    $('player-name').value=playerName;$('rival-name').value=rivalName;
    $('overwrite-save').checked=true;
    const submit=$('registration-form').onsubmit;
    submit({preventDefault(){}});
  },
  finishDialogue(){let n=0;while(modal==='dialogue'&&n++<40) advanceDialogue();if(n>=40)throw new Error('Dialogue did not terminate');},
  target(id){const t=targets.find(t=>t.id===id);if(!t)throw new Error('Missing target '+id);t.fn();},
  choose(species){const button=document.querySelector('[data-starter="'+species+'"]');const action=button.onclick;action.call(button);},
  mum(){openMumChat();},
  mumReply(index){const button=$('tab-contacts').querySelectorAll('.sms-reply')[index];if(!button)throw new Error('Missing SMS reply');const action=button.onclick;action.call(button);},
  showJournal,phoneHome,showSettings,close,travelToKnownLocation,travelToDistrict,
  purchase(label){const button=[...$('tab-bag').querySelectorAll('button')].find(el=>/^(COLLECT|ORDER) /.test(el.textContent)&&el.textContent.includes(label));if(!button)throw new Error('Missing bag purchase '+label);return button.onclick.call(button);},
  treat(index){const button=$('tab-bag').querySelectorAll('.bag-treatment')[index];if(!button)throw new Error('Missing treatment target '+index);return button.onclick.call(button);},
  manualParty(index){const button=$('tab-party').querySelectorAll(':scope > .party-row')[index]?.querySelector('button');if(!button)throw new Error('Missing party target '+index);return button.onclick.call(button);},
  openBattleParty(){return $('switch-btn').onclick();},
  loadCampaign(){return $('load-game').onclick();},
  settingsClose(){const action=$('settings-close').onclick;action();},
  back(){const action=$('phone-back').onclick;action();},
  chooseBattleMenu(menu){battle.menu=menu;renderBattle();},
  startBattle,endBattle,swapAnimal,turn,
  retreat(){return $('run-btn').onclick();},
  medkit(){const action=$('heal-btn').onclick;return action();},
  continueBattle(){const action=$('battle-continue').onclick;return action();},
  takeStarter,
  semanticPosition(x,z,angle=0){position.set(x,floor(x,z)+EYE_HEIGHT,z);yaw=angle;pitch=-0.045;},
  semanticApproach(id,dx=0,dz=2){const t=targets.find(t=>t.id===id);if(!t)throw new Error('Missing target '+id);const x=t.x+dx,z=t.z+dz;position.set(x,floor(x,z)+EYE_HEIGHT,z);yaw=Math.atan2(dx,dz);pitch=-0.045;return{x,z,target:{x:t.x,z:t.z}};},
  semanticGymApproach(i){const t=worldInfo.towns[i];const x=t.gymX,z=t.gymZ+2.6;position.set(x,floor(x,z)+EYE_HEIGHT,z);yaw=0;pitch=-0.045;return{x,z};},
  semanticFixture(raw){if(battle)throw new Error('Cannot replace an active battle');state=parseSave(JSON.stringify(raw));if(!state)throw new Error('Invalid fixture');position.set(state.position.x,floor(state.position.x,state.position.z)+EYE_HEIGHT,state.position.z);yaw=state.yaw;pitch=state.pitch;enterWorld();},
  semanticBattleModifiers(ally,enemy){if(!battle||battle.busy||battle.finished)throw new Error('No idle fixture battle');for(const key of ['attackStage','defenseStage','status']){state.party[battle.active][key]=ally[key];battle.enemy[key]=enemy[key];}renderBattle();},
  semanticPreBattleStages(){if(battle)throw new Error('Fixture requires exploration');state.party.forEach(animal=>{animal.attackStage=2;animal.defenseStage=1;});},
  semanticPartyGuardFixture(){if(battle)throw new Error('Fixture requires exploration');state.party=[state.party[0],makeAnimal('dog',11),{...makeAnimal('rat',5),hp:0}];return JSON.parse(JSON.stringify(state.party));},
  semanticPartyGuardPhase(phase){if(!battle||!['busy','finished','idle'].includes(phase))throw new Error('Invalid guard fixture phase');battle.busy=phase==='busy';battle.finished=phase==='finished';renderBattle();},
  semanticAutomaticReplacementFixture(){if(!battle)throw new Error('Missing fixture battle');battle.busy=true;state.party[battle.active].hp=0;state.party[battle.active].attackStage=-1;state.party[1].defenseStage=2;},
  save,rest,
  modelLookPreference(){lookControl.engage();},
};
`;

const report = {
  scope:
    "Original game business functions called directly in an isolated headless context. Semantic approaches and direct target callbacks bypass traversal, line-of-sight and interaction selection; those are outside this check. Focus/pointer lock are stubbed and no browser input controls are used. Combat uses the original Math.random and finite inventory. Separate save fixtures prove rendering/logic, not earned progression.",
  executedAt: new Date().toISOString(),
  checks: [],
  snapshots: {},
  errors: [],
  servedMainHash: null,
};
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
    reducedMotion: "reduce",
  });
  page.on("pageerror", (error) => report.errors.push(error.message));
  await page.addInitScript(() => {
    window.__inputStubs = {
      focus: 0,
      captureRequests: 0,
      captureReleases: 0,
      forbiddenClicks: 0,
    };
    HTMLElement.prototype.focus = function () {
      window.__inputStubs.focus++;
    };
    HTMLElement.prototype.click = function () {
      window.__inputStubs.forbiddenClicks++;
      throw new Error("DOM click forbidden in no-input harness");
    };
    Element.prototype.requestPointerLock = function () {
      window.__inputStubs.captureRequests++;
      return Promise.resolve();
    };
    document.exitPointerLock = function () {
      window.__inputStubs.captureReleases++;
    };
  });
  let originalMain;
  await page.route("**/src/main.js*", async (route) => {
    const response = await route.fetch();
    originalMain ??= await response.text();
    report.servedMainHash = createHash("sha256")
      .update(originalMain)
      .digest("hex");
    await route.fulfill({ response, body: originalMain + "\n" + bridge });
  });
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5174");
  await page.waitForFunction(
    () => window.__integration && !document.getElementById("begin").disabled,
    null,
    { timeout: 60000 },
  );
  const call = (name, ...args) =>
    page.evaluate(({ name, args }) => window.__integration[name](...args), {
      name,
      args,
    });
  const view = () => call("view");
  const check = (description, predicate) => {
    assert.ok(predicate, description);
    report.checks.push(description);
  };

  report.snapshots.title = await view();
  check(
    "Fresh title has an available home page and no active game",
    report.snapshots.title.visible["title-app"] &&
      !report.snapshots.title.playing,
  );
  check(
    "The title phone exposes the prepared Blender model frame and a visible screen",
    report.snapshots.title.hasHeldModel &&
      report.snapshots.title.phoneRect.width > 0 &&
      report.snapshots.title.phoneRect.height > 0 &&
      report.snapshots.title.phoneScreenRect.width > 0 &&
      report.snapshots.title.phoneScreenRect.height > 0,
  );
  await call("showSettings");
  check(
    "Settings opens from the title page without starting the game",
    (await view()).visible["settings-panel"] && !(await view()).playing,
  );
  await call("settingsClose");
  check(
    "Closing title Settings restores the title page",
    (await view()).visible["title-app"],
  );
  await call("register", "Morgan", "Rowan");
  let s = await view();
  check(
    "New Game stores supplied names and marks Mum's arriving message as received",
    s.state.playerName === "Morgan" &&
      s.state.rivalName === "Rowan" &&
      s.modal === "dialogue" &&
      s.state.note,
  );
  check(
    "No starter or collected bag is invented",
    !s.state.starter && !s.state.bagTaken && s.state.party.length === 0,
  );
  check(
    "Opening the introduction immediately persists all four Mum SMS entries",
    s.state.note &&
      s.state.messages.length === 4 &&
      s.state.messages.every((message) => message.from === "mum") &&
      JSON.stringify(s.state.messages) === JSON.stringify(s.stored.messages),
  );
  const arrivedSms = JSON.stringify(s.state.messages);
  report.snapshots.openingSms = s;
  check(
    "The opening SMS focus scope includes phone Back, Home, NEXT and the Home bar",
    ["phone-back", "phone-home", "next", "phone-home-bar"].every((id) =>
      s.phoneFocusableIds.includes(id),
    ) &&
      !s.phoneFocusableIds.includes("player-name") &&
      !s.phoneFocusableIds.includes("load-game"),
  );
  await call("phoneHome");
  s = await view();
  check(
    "Home during the unfinished introduction preserves all four arrived messages",
    s.modal === "journal" &&
      s.currentTab === "apps" &&
      s.state.note &&
      JSON.stringify(s.state.messages) === arrivedSms &&
      JSON.stringify(s.stored.messages) === arrivedSms,
  );
  await call("showJournal", "contacts");
  await call("mum");
  s = await view();
  check(
    "Opening Mum's chat after leaving the introduction displays the four saved messages",
    JSON.stringify(s.state.messages) === arrivedSms &&
      JSON.stringify(s.smsBubbles) ===
        JSON.stringify(s.state.messages.map((message) => message.text)),
  );
  await call("mumReply", 0);
  s = await view();
  check(
    "Mum's contextual SMS is persisted and points to the bag",
    s.state.interactions.includes("messaged-mum") &&
      s.contacts.includes("school bag") &&
      s.state.messages.length === 6 &&
      s.state.messages.at(-2).from === "you" &&
      s.state.messages.at(-1).from === "mum" &&
      JSON.stringify(s.state.messages) === JSON.stringify(s.stored.messages),
  );
  const savedSms = JSON.stringify(s.state.messages);
  await call("showJournal", "party");
  await call("showSettings", "journal");
  await call("settingsClose");
  check(
    "Closing in-game Settings restores the previously open Animals app",
    (await view()).modal === "journal" && (await view()).currentTab === "party",
  );
  await call("showJournal", "contacts");
  await call("mum");
  s = await view();
  check(
    "Reopening Mum's chat displays saved history without adding duplicate messages",
    JSON.stringify(s.state.messages) === savedSms &&
      JSON.stringify(s.smsBubbles) ===
        JSON.stringify(s.state.messages.map((message) => message.text)),
  );
  await call("showJournal", "bag");
  check(
    "Bag app reflects the uncollected world prop",
    (await view()).bagText.includes("Pick it up"),
  );
  await call("close");
  report.snapshots.bagApproach = await call(
    "semanticApproach",
    "school-bag",
    0,
    -0.8,
  );
  await call("target", "school-bag");
  await call("finishDialogue");
  s = await view();
  report.snapshots.bag = s;
  check(
    "Bag pickup hides the actual prop and disables repeated pickup",
    s.state.bagTaken && !s.bagVisible && s.bagUnavailable,
  );
  check(
    "Bag pickup retains the intended finite starting supplies",
    s.state.carriers === 8 && s.state.medkits === 5 && s.state.money === 100,
  );
  // Business-function fixtures are placed beside the current actual targets;
  // none of these steps claims walked traversal or uses browser input.
  report.snapshots.garyApproach = await call("semanticApproach", "gary", 0, 2);
  check(
    "Researcher interaction takes place inside the clinic",
    (await view()).room?.id === "county-research",
  );
  await call("target", "gary");
  await call("finishDialogue");
  check(
    "Gary remains eligible after Home interrupted Mum's introduction and leads to a choice without granting an animal",
    (await view()).modal === "choose" && !(await view()).state.starter,
  );
  await call("choose", "cat");
  await call("finishDialogue");
  check(
    "Selection leaves the cat in its pen until actual handover",
    !(await view()).state.starter && (await view()).selectedStarter === "cat",
  );
  await call("takeStarter", "dog");
  check(
    "A different pen does not give a second or unintended starter",
    !(await view()).state.starter,
  );
  report.snapshots.starterApproach = await call(
    "semanticApproach",
    "starter-cat",
    0,
    1.1,
  );
  await call("target", "starter-cat");
  await call("finishDialogue");
  s = await view();
  report.snapshots.starter = s;
  check(
    "Handover reuses the pen animal as the level-five companion",
    s.state.starter === "cat" &&
      s.state.party.length === 1 &&
      s.reusesStarter &&
      s.companion.level === 5 &&
      s.companion.parent,
  );
  check(
    "Same-version save validation preserves health and chosen moves",
    JSON.stringify(s.roundTrip.party) === JSON.stringify(s.state.party),
  );
  const healthyStarter = {
    medkits: s.state.medkits,
    party: JSON.stringify(s.state.party),
  };
  await call("showJournal", "bag");
  await call("treat", 0);
  s = await view();
  check(
    "Field treatment rejects a fully healthy starter without spending supplies",
    s.state.medkits === healthyStarter.medkits &&
      JSON.stringify(s.state.party) === healthyStarter.party,
  );
  await call("close");
  await call("modelLookPreference");
  report.snapshots.rivalApproach = await call(
    "semanticApproach",
    "rival",
    0,
    2.6,
  );
  await call("target", "rival");
  await call("finishDialogue");
  s = await view();
  check(
    "Rival dialogue chains into a real battle with the selected names",
    s.battle?.config.id === "rival" &&
      s.battle.config.name === "Rowan" &&
      s.visible.battle,
  );
  check(
    "Battle models use actual animal levels",
    s.battle.left.level === 5 && s.battle.right.level === 4,
  );
  const beforeFullBattleKit = {
    medkits: s.state.medkits,
    party: JSON.stringify(s.state.party),
    enemy: JSON.stringify(s.battle.enemy),
    turn: s.battle.turn,
  };
  await call("medkit");
  s = await view();
  check(
    "A full-HP battle medkit is disabled and its handler spends neither item nor turn",
    s.battle.medkitDisabled &&
      !s.battle.busy &&
      s.state.medkits === beforeFullBattleKit.medkits &&
      JSON.stringify(s.state.party) === beforeFullBattleKit.party &&
      JSON.stringify(s.battle.enemy) === beforeFullBattleKit.enemy &&
      s.battle.turn === beforeFullBattleKit.turn,
  );
  await call("showJournal", "party");
  check(
    "Animal app hides the battle page while retaining its state",
    !(await view()).visible.battle && Boolean((await view()).battle),
  );
  await call("phoneHome");
  check(
    "Phone Home returns to the current battle",
    (await view()).visible.battle && (await view()).battle.menu === "root",
  );
  await call("chooseBattleMenu", "fight");
  await page.screenshot({ path: "artifacts/no-input-rival-battle.png" });
  const turns = [];
  while ((s = await view()).battle && !s.battle.finished && turns.length < 30) {
    const pet = s.state.party[s.battle.active];
    const action =
      pet.hp < pet.maxHp * 0.5 && s.state.medkits > 0 ? "medkit" : "scratch";
    if (action === "medkit") await call("medkit");
    else await call("turn", action);
    turns.push({ action, snapshot: await view() });
  }
  report.snapshots.rivalTurns = turns;
  s = await view();
  check(
    "Rival sequence reaches a terminal result without supplied resources",
    Boolean(s.battle?.finished),
  );
  report.rivalOutcome = s.state.wins.includes("rival") ? "win" : "loss";
  const beforeFinishedKit = {
    medkits: s.state.medkits,
    party: JSON.stringify(s.state.party),
    turn: s.battle.turn,
  };
  await call("medkit");
  s = await view();
  check(
    "The medkit handler rejects a finished battle without changing health or supplies",
    s.battle.finished &&
      s.state.medkits === beforeFinishedKit.medkits &&
      JSON.stringify(s.state.party) === beforeFinishedKit.party &&
      s.battle.turn === beforeFinishedKit.turn,
  );
  await call("continueBattle");
  await call("finishDialogue");
  s = await view();
  report.snapshots.afterRival = s;
  check(
    "Continue returns to exploration with no orphaned battle page",
    !s.battle && !s.modal && !s.visible.phone && !s.visible.battle,
  );

  // A real purchase after the terminal rival result keeps the original rival
  // run's five-medkit starting fixture unchanged. The purchase spends earned
  // or remaining money; it never changes inventory directly.
  report.snapshots.shopApproach = await call(
    "semanticApproach",
    "mercy-shop-counter",
    0,
    1,
  );
  await call("target", "mercy-shop-counter");
  s = await view();
  check(
    "The physical shop counter opens Bag with in-person collection prices",
    s.modal === "journal" &&
      s.currentTab === "bag" &&
      s.phoneTitle === "BAG" &&
      s.room?.id === "mercy-general-stores" &&
      s.atSupplyCounter &&
      s.bagButtons.some(
        (button) => button.text === "COLLECT MEDKIT · £25" && !button.disabled,
      ) &&
      s.bagButtons.some(
        (button) => button.text === "COLLECT CARRIER · £15" && !button.disabled,
      ),
  );
  const beforePurchase = {
    money: s.state.money,
    medkits: s.state.medkits,
    carriers: s.state.carriers,
  };
  await call("purchase", "MEDKIT");
  s = await view();
  check(
    "Shop collection spends £25 and adds exactly one medkit",
    s.state.money === beforePurchase.money - 25 &&
      s.state.medkits === beforePurchase.medkits + 1 &&
      s.state.carriers === beforePurchase.carriers &&
      s.stored.money === s.state.money &&
      s.stored.medkits === s.state.medkits,
  );
  report.snapshots.shopPurchase = { before: beforePurchase, after: s };
  const fieldTarget = s.state.party.findIndex(
    (animal) => animal.hp > 0 && animal.hp < animal.maxHp,
  );
  await page.screenshot({ path: "artifacts/no-input-bag-treatment.png" });
  if (fieldTarget >= 0 && s.state.medkits > 0) {
    const before = structuredClone(s.state);
    const animal = before.party[fieldTarget];
    const recovered = Math.min(
      animal.maxHp - animal.hp,
      Math.ceil(animal.maxHp * 0.6),
    );
    await call("treat", fieldTarget);
    s = await view();
    check(
      "A real field treatment spends one medkit on the selected injured animal and saves recovery",
      s.state.party[fieldTarget].hp === animal.hp + recovered &&
        s.state.medkits === before.medkits - 1 &&
        s.state.money === before.money &&
        s.state.carriers === before.carriers &&
        s.stored.medkits === s.state.medkits &&
        s.stored.party[fieldTarget].hp === s.state.party[fieldTarget].hp,
    );
    report.snapshots.fieldTreatment = {
      before,
      target: fieldTarget,
      recovered,
      after: s,
    };
  } else {
    report.fieldTreatmentNotExercised =
      "The original-RNG rival result left no conscious injured animal with a medkit available. No damage or resources were invented to force this check; pure treatment tests cover recovery.";
  }
  await call("back");
  check(
    "Phone Back returns from Bag to the phone home screen",
    (await view()).currentTab === "apps",
  );
  await call("close");

  await call("semanticApproach", "home-television", -1.2, 0);
  await call("target", "home-television");
  s = await view();
  check(
    "Switching the television off persists its world interaction flag",
    s.state.interactions.includes("home-tv-off") &&
      s.stored.interactions.includes("home-tv-off"),
  );
  await call("showJournal", "bag");
  s = await view();
  check(
    "Away from the shop, Bag returns to delivery pricing",
    !s.atSupplyCounter &&
      s.bagButtons.some((button) => button.text === "ORDER MEDKIT · £30") &&
      s.bagButtons.some((button) => button.text === "ORDER CARRIER · £20"),
  );
  await call("close");
  await call("save");
  const beforeReload = await view();
  await page.reload();
  await page.waitForFunction(
    () =>
      window.__integration && !document.getElementById("load-game").disabled,
    null,
    { timeout: 60000 },
  );
  await call("loadCampaign");
  s = await view();
  check(
    "Load preserves names, messages, inventory, party health/moves and television power",
    s.playing &&
      s.state.playerName === "Morgan" &&
      s.state.rivalName === "Rowan" &&
      JSON.stringify(s.state.messages) ===
        JSON.stringify(beforeReload.state.messages) &&
      s.state.money === beforeReload.state.money &&
      s.state.medkits === beforeReload.state.medkits &&
      s.state.carriers === beforeReload.state.carriers &&
      JSON.stringify(s.state.party) ===
        JSON.stringify(beforeReload.roundTrip.party) &&
      s.state.interactions.includes("home-tv-off"),
  );
  report.snapshots.loadedCampaign = s;

  // This separate setup proves rendering and growth-level propagation, not that
  // this session earned two badges. It is the previously documented finite save.
  const fixture = {
    ...s.state,
    party: [
      {
        species: "cat",
        nickname: "Cat",
        level: 11,
        hp: 90,
        maxHp: 90,
        moves: ["scratch", "bite", "hiss", "pounce"],
      },
    ],
    badges: [0, 1],
    wins: ["rival", "gym0", "gym1"],
    medkits: 2,
    carriers: 14,
    money: 460,
    position: { x: -193, z: -206 },
    yaw: 0,
    pitch: -0.045,
  };
  report.semanticBattleFixture = fixture;
  await call("semanticFixture", fixture);
  // A distant save must not shift title lighting/culling away from the bedroom.
  // This reload remains part of the documented semantic fixture, not progression.
  await page.reload();
  await page.waitForFunction(
    () =>
      window.__integration && !document.getElementById("load-game").disabled,
    null,
    { timeout: 60000 },
  );
  s = await view();
  report.snapshots.distantSaveTitle = s;
  check(
    "A distant saved campaign keeps the title camera in the bedroom",
    !s.playing &&
      s.visible["title-app"] &&
      s.state.position.x === fixture.position.x &&
      s.state.position.z === fixture.position.z &&
      Math.hypot(
        s.cameraPosition.x - s.titlePosition.x,
        s.cameraPosition.y - s.titlePosition.y,
        s.cameraPosition.z - s.titlePosition.z,
      ) < 0.001,
  );
  await page.screenshot({ path: "artifacts/no-input-distant-save-title.png" });
  await call("loadCampaign");
  await call("travelToKnownLocation", "clinic");
  s = await view();
  check(
    "An earned-badge save can use the clinic bus destination",
    s.position.x === 24 && s.position.z === -16.4 && !s.modal,
  );
  report.snapshots.thirdLeaderApproach = await call("semanticGymApproach", 2);
  await call("target", "gym2");
  await call("finishDialogue");
  await call("chooseBattleMenu", "fight");
  s = await view();
  check(
    "Semantic battle shows adult lead and juvenile enemy at distinct growth scales",
    s.battle.left.level === 11 &&
      s.battle.left.scale === 1 &&
      s.battle.right.level === 9 &&
      s.battle.right.scale === 0.8,
  );
  await page.screenshot({ path: "artifacts/no-input-third-battle.png" });
  report.snapshots.semanticBattle = s;
  report.semanticBattleModifiers = {
    ally: { attackStage: -1, defenseStage: 2, status: "dazed" },
    enemy: { attackStage: -2, defenseStage: 1, status: null },
    scope:
      "Display-only modifiers applied to the separate documented third-leader fixture. No combat actions, healing or RNG changes follow.",
  };
  await call(
    "semanticBattleModifiers",
    report.semanticBattleModifiers.ally,
    report.semanticBattleModifiers.enemy,
  );
  s = await view();
  check(
    "Battle health panels persist signed ATK/DEF stages alongside HP and daze",
    s.battle.allyStatus.includes("DAZED · ATK −1 · DEF +2") &&
      s.battle.enemyStatus.includes("ATK −2 · DEF +1"),
  );
  report.snapshots.semanticStatusDisplay = s;
  await page.screenshot({ path: "artifacts/no-input-third-status.png" });
  const beforeGuard = {
    money: s.state.money,
    medkits: s.state.medkits,
    x: s.position.x,
    z: s.position.z,
  };
  await call("showJournal", "bag");
  check(
    "Live battle disables every Bag purchase",
    (await view()).bagButtons.every((button) => button.disabled),
  );
  await call("purchase", "MEDKIT");
  await call("travelToKnownLocation", "clinic");
  await call("travelToDistrict", 0);
  s = await view();
  check(
    "Purchase and unlocked travel business functions reject an active battle",
    s.state.money === beforeGuard.money &&
      s.state.medkits === beforeGuard.medkits &&
      s.position.x === beforeGuard.x &&
      s.position.z === beforeGuard.z &&
      Boolean(s.battle),
  );
  await call("phoneHome");
  s = await view();
  check(
    "Phone Home restores the live battle after guarded app actions",
    s.visible.battle && !s.modal,
  );
  // Boundary-only checks use the preceding explicit semantic fixture. Ending
  // that leader fixture directly is cleanup, not a legal player retreat/win.
  const boundaryBefore = structuredClone(s.state);
  const withoutStages = (party) =>
    party.map(({ attackStage, defenseStage, ...animal }) => animal);
  const boundaryUnchanged = (before, after) =>
    JSON.stringify(withoutStages(before.party)) ===
      JSON.stringify(withoutStages(after.party)) &&
    before.medkits === after.medkits &&
    before.carriers === after.carriers &&
    before.money === after.money &&
    JSON.stringify(before.badges) === JSON.stringify(after.badges) &&
    JSON.stringify(before.wins) === JSON.stringify(after.wins);
  await call("endBattle", false);
  s = await view();
  check(
    "Ending the semantic encounter clears temporary stages without healing, curing or awarding resources",
    !s.battle &&
      s.state.party.every(
        (animal) => animal.attackStage === 0 && animal.defenseStage === 0,
      ) &&
      boundaryUnchanged(boundaryBefore, s.state),
  );
  await call("semanticPreBattleStages");
  await call("startBattle", {
    id: "boundary-wild-fixture",
    kind: "wild",
    name: "Boundary fixture",
    roster: ["rat"],
    level: 3,
  });
  s = await view();
  check(
    "A new encounter discards stale stages while preserving HP, daze, moves and supplies",
    s.battle &&
      s.state.party.every(
        (animal) => animal.attackStage === 0 && animal.defenseStage === 0,
      ) &&
      boundaryUnchanged(boundaryBefore, s.state),
  );
  await call(
    "semanticBattleModifiers",
    report.semanticBattleModifiers.ally,
    report.semanticBattleModifiers.enemy,
  );
  await call("retreat");
  s = await view();
  check(
    "The actual wild-retreat handler clears stages and gives no healing or progression reward",
    !s.battle &&
      s.state.party.every(
        (animal) => animal.attackStage === 0 && animal.defenseStage === 0,
      ) &&
      boundaryUnchanged(boundaryBefore, s.state),
  );
  report.snapshots.afterBoundaryRetreat = s;
  report.boundaryFixtureScope =
    "The staged third-leader fixture is closed directly for cleanup without rewards, then a separate LV3 Rat encounter checks start/reset and actual retreat handlers. Only temporary stage fields are seeded; HP, moves and finite inventory are unchanged. No capture or victory is forced.";
  report.partyGuardFixture = {
    scope:
      "Separate guard-only fixture adds a conscious LV11 Dog and a fainted LV5 Rat to the existing cat, then explicitly marks a new battle busy/finished/idle. No opponent actions are run and no victory, capture or reward is fabricated. The final internal-replacement check explicitly marks the outgoing animal fainted; it does not claim a played defeat.",
    party: await call("semanticPartyGuardFixture"),
  };
  await call("startBattle", {
    id: "party-guard-wild-fixture",
    kind: "wild",
    name: "Party guard fixture",
    roster: ["rat"],
    level: 3,
  });
  const partyGuardState = (snapshot) =>
    JSON.stringify({
      party: snapshot.state.party,
      medkits: snapshot.state.medkits,
      carriers: snapshot.state.carriers,
      money: snapshot.state.money,
      badges: snapshot.state.badges,
      wins: snapshot.state.wins,
      active: snapshot.battle.active,
      turn: snapshot.battle.turn,
      busy: snapshot.battle.busy,
      finished: snapshot.battle.finished,
      enemy: snapshot.battle.enemy,
    });
  for (const phase of ["busy", "finished"]) {
    await call("semanticPartyGuardPhase", phase);
    await call("showJournal", "party");
    s = await view();
    const before = partyGuardState(s);
    check(
      `The ${phase} fixture disables SEND OUT / MAKE LEAD even for a conscious backup`,
      s.state.party[1].hp > 0 && s.partyLeadButtons[1].disabled,
    );
    await call("manualParty", 1);
    s = await view();
    check(
      `The original manual-switch callback rejects a ${phase} battle without a second turn or reward`,
      partyGuardState(s) === before && s.modal === "journal",
    );
    await call("phoneHome");
    await call("openBattleParty");
    check(
      `The battle ANIMALS callback rejects the ${phase} fixture`,
      !(await view()).modal,
    );
  }
  await call("semanticPartyGuardPhase", "idle");
  await call("showJournal", "party");
  s = await view();
  const idleBefore = partyGuardState(s);
  check(
    "Idle party selection disables the active and fainted slots while enabling a conscious backup",
    s.partyLeadButtons[0].disabled &&
      !s.partyLeadButtons[1].disabled &&
      s.partyLeadButtons[2].disabled,
  );
  await call("manualParty", 0);
  await call("manualParty", 2);
  check(
    "Active-slot and fainted-target callbacks are harmless even when invoked directly",
    partyGuardState(await view()) === idleBefore,
  );
  await call("phoneHome");
  await call("semanticAutomaticReplacementFixture");
  const beforeAutomatic = await view();
  await call("swapAnimal", 1);
  s = await view();
  check(
    "Internal automatic replacement remains available while busy and resets outgoing/incoming stages",
    s.battle.busy &&
      s.battle.active === 1 &&
      s.state.party[0].hp === 0 &&
      s.state.party[1].hp === beforeAutomatic.state.party[1].hp &&
      s.state.party
        .slice(0, 2)
        .every(
          (animal) => animal.attackStage === 0 && animal.defenseStage === 0,
        ) &&
      s.battle.turn === beforeAutomatic.battle.turn &&
      JSON.stringify(s.battle.enemy) ===
        JSON.stringify(beforeAutomatic.battle.enemy) &&
      s.state.medkits === beforeAutomatic.state.medkits &&
      s.state.carriers === beforeAutomatic.state.carriers,
  );
  report.snapshots.partyGuardAutomaticReplacement = s;
  await call("endBattle", false);
  s = await view();
  check(
    "No real focus, pointer capture or DOM click was used",
    !s.pointerLocked && s.safety.forbiddenClicks === 0,
  );
  check("No browser runtime exceptions occurred", report.errors.length === 0);
} catch (error) {
  report.failure = error.stack || String(error);
  process.exitCode = 1;
} finally {
  await browser.close();
  await writeFile(
    "artifacts/no-input-integration.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        outcome: report.rivalOutcome,
        failure: report.failure,
        errors: report.errors,
      },
      null,
      2,
    ),
  );
}
