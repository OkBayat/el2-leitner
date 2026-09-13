import assert from 'node:assert/strict';
import { it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ConversationQuestionAudio } from '../src/application/adaptive-conversation/ConversationQuestionAudio.js';
const options={allowedVoices:['af_heart'],defaultVoice:'af_heart',defaultSpeed:1,defaultFormat:'mp3',model:'kokoro',modelVersion:'fixture'};
function fixture(){
 const calls=[];const sessions={requireEnabled(){},async owned(user,id){if(user==='other')throw Object.assign(new Error('missing'),{code:'CONVERSATION_NOT_FOUND'});return {state:{turns:[{id:'turn',question:'What do you eat?'}]}};}};
 const synthesizeSpeech={async execute(request){calls.push(request);return {filePath:fileURLToPath(import.meta.url),cacheStatus:'hit'};}};
 return {audio:new ConversationQuestionAudio({sessions,synthesizeSpeech,options,logger:{info(){}}}),calls};
}
it('resolves authoritative owned question text through the shared Kokoro cache',async()=>{
 const {audio,calls}=fixture();await assert.rejects(audio.generate('other','session','turn'),{code:'CONVERSATION_NOT_FOUND'});assert.equal(calls.length,0);
 const stream=await audio.generate('user','session','turn');assert.equal(calls[0].text,'What do you eat?');assert.equal(calls[0].format,'mp3');assert.equal(audio.active.size,1);
 stream.resume();await new Promise(r=>stream.once('close',r));assert.equal(audio.active.size,0);
});
it('holds owner/global admission during streaming and cancels upstream on disconnect or session cancellation',async()=>{
 const {audio,calls}=fixture();const controller=new AbortController();const first=await audio.generate('user','session','turn',{signal:controller.signal});
 await assert.rejects(audio.generate('user','session','turn'),{code:'CONVERSATION_AUDIO_BUSY'});
 const second=await audio.generate('user2','session2','turn');await assert.rejects(audio.generate('user3','session3','turn'),{code:'CONVERSATION_AUDIO_BUSY'});
 controller.abort();await new Promise(r=>first.once('close',r));assert.equal(audio.active.size,1);
 audio.cancelSession('session2');await new Promise(r=>second.once('close',r));assert.equal(audio.active.size,0);
});
it('refuses pre-cancelled requests before synthesis and releases failed provider admission',async()=>{
 const {audio,calls}=fixture();const c=new AbortController();c.abort();await assert.rejects(audio.generate('user','session','turn',{signal:c.signal}),{code:'CONVERSATION_CANCELLED'});assert.equal(calls.length,0);
 audio.synthesizeSpeech.execute=async()=>{throw new Error('unavailable');};await assert.rejects(audio.generate('user','session','turn'));assert.equal(audio.active.size,0);
});
