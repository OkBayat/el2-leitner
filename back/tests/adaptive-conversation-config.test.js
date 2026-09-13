import assert from 'node:assert/strict';
import { it } from 'node:test';
import { loadConfig } from '../src/config/loadConfig.js';
const base={NODE_ENV:'test'};
it('defaults Conversation off and leaves Writing and service assets optional',()=>{const c=loadConfig(base);assert.deepEqual(c.adaptiveConversation,{enabled:false,retentionDays:30});assert.equal(c.writingFeedback.enabled,false);});
it('requires a backend OpenAI key when only Conversation is enabled',()=>{
 assert.throws(()=>loadConfig({...base,ADAPTIVE_CONVERSATION_ENABLED:'true'}),{code:'INVALID_CONFIGURATION'});
 const c=loadConfig({...base,ADAPTIVE_CONVERSATION_ENABLED:'true',OPENAI_API_KEY:'test-key'});
 assert.equal(c.adaptiveConversation.enabled,true);assert.equal(c.writingFeedback.enabled,false);
 assert.equal(c.writingFeedback.model,'gpt-5-nano');
});
it('rejects ambiguous enable flags and unbounded retention',()=>{for(const extra of [{ADAPTIVE_CONVERSATION_ENABLED:'yes'},{ADAPTIVE_CONVERSATION_RETENTION_DAYS:'0'},{ADAPTIVE_CONVERSATION_RETENTION_DAYS:'91'},{ADAPTIVE_CONVERSATION_RETENTION_DAYS:'1.5'}])assert.throws(()=>loadConfig({...base,...extra}),{code:'INVALID_CONFIGURATION'});});
