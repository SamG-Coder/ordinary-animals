import test from "node:test";
import assert from "node:assert/strict";
import { appendMessage, cleanMessages, MESSAGE_LIMIT } from "../src/phone-messages.js";
import { initialSave, parseSave } from "../src/rules.js";

test("Mum's conversations survive a save and retain message order",()=>{
  const state=initialSave();
  appendMessage(state,"mum","Please take your bag. x");
  appendMessage(state,"you","Are you coming with me?");
  appendMessage(state,"mum","I'll call on my break.");
  const restored=parseSave(JSON.stringify(state));
  assert.deepEqual(restored.messages,state.messages);
  assert.deepEqual(parseSave(JSON.stringify({party:[]})).messages,[]);
});
test("message history retains recent complete records and discards malformed entries",()=>{
  const history=cleanMessages([null,{from:"unknown",text:"bad"},{from:"mum",text:3},...Array.from({length:60},(_,i)=>({from:i%2?"you":"mum",text:String(i)}))]);
  assert.equal(history.length,MESSAGE_LIMIT);
  assert.equal(history[0].text,"20");
  assert.equal(history.at(-1).text,"59");
  assert.equal(cleanMessages([{from:"mum",text:"a".repeat(1200)}])[0].text.length,900);
});
