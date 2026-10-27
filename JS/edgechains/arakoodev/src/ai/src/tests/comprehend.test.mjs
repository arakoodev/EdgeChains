import test, { mock } from 'node:test';
import { ComprehendClient, DetectPiiEntitiesCommand } from '@aws-sdk/client-comprehend';
import assert from 'node:assert/strict';
import { firstValueFrom, from, toArray } from 'rxjs';
import { ComprehendPiiRedactor, redactSpans } from '../lib/comprehend/comprehend.ts';

const span = (BeginOffset, EndOffset) => ({ BeginOffset, EndOffset });
const redactor = (spans) => new ComprehendPiiRedactor({
    detector: { detect: async () => spans },
});

test('redacts multiple unsorted entities without changing offsets', () => {
    assert.equal(redactSpans('Ana llama a Luis', [span(12,16), span(0,3)], '***'), '*** llama a ***');
});
test('Unicode astral characters before a detection preserve offsets', () => {
    assert.equal(redactSpans('😀 Ana', [span(2,5)], 'X'), '😀 X');
});
test('overlapping detections are fully covered', () => {
    assert.equal(redactSpans('abcdefgh', [span(1,4), span(3,7)], 'X'), 'aXh');
});
test('adjacent entities are independently replaced', () => {
    assert.equal(redactSpans('abcdef', [span(0,3), span(3,6)], 'X'), 'XX');
});
test('invalid or incomplete offsets fail closed', () => {
    for (const s of [span(-1,2),span(2,1),span(0,99),span(0.5,2),{},span(1,1)]) {
        assert.throws(() => redactSpans('abc', [s], 'X'), /invalid PII offsets/);
    }
});
test('empty input skips service calls', async () => {
    const r = new ComprehendPiiRedactor({detector:{detect:async()=>{throw Error('called');}}});
    assert.equal(await r.redact(''), '');
});
test('UTF-8 byte limit checked before API call', async () => {
    const r = new ComprehendPiiRedactor({detector:{detect:async()=>{throw Error('called');}}});
    await assert.rejects(r.redact('😀'.repeat(25001)), /100,000/);
});
test('Spanish and configurable replacement reach the detector', async () => {
    const r = new ComprehendPiiRedactor({language:'es',replacement:'OCULTO',detector:{
        detect:async(text,lang)=>{assert.equal(text,'Ana');assert.equal(lang,'es');return [span(0,3)];}
    }});
    assert.equal(await r.redact('Ana'), 'OCULTO');
});
test('observable does not send text before subscription', async () => {
    let calls=0;
    const r = new ComprehendPiiRedactor({detector:{detect:async()=>{calls++;return [];}}});
    const stream=r.observe('hola'); assert.equal(calls,0);
    assert.equal(await firstValueFrom(stream),'hola');assert.equal(calls,1);
});
test('operator preserves every input and order', async () => {
    const r=redactor([]);
    assert.deepEqual(await firstValueFrom(from(['uno','dos','tres']).pipe(r.operator(),toArray())),['uno','dos','tres']);
});
test('chat wrapper redacts both input forms and preserves options and source objects', async () => {
    const r=redactor([span(0,3)]);
    const original={prompt:'Ana',messages:[{role:'user',content:'Ana',name:'x'}],temperature:0.2};
    let received;
    const chain=r.next({chat:async options=>{received=options;return {content:'ok'};}});
    assert.deepEqual(await chain.chat(original),{content:'ok'});
    assert.equal(received.prompt,'[REDACTED]');assert.equal(received.messages[0].content,'[REDACTED]');
    assert.equal(received.temperature,0.2);assert.equal(received.messages[0].name,'x');
    assert.equal(original.prompt,'Ana');assert.equal(original.messages[0].content,'Ana');
});
test('service failure prevents all downstream chat calls', async () => {
    let calls=0;
    const r=new ComprehendPiiRedactor({detector:{detect:async()=>{throw Error('unavailable');}}});
    const chain=r.next({chat:async()=>{calls++;}});
    await assert.rejects(chain.chat({prompt:'private'}),/unavailable/);assert.equal(calls,0);
});

test('default AWS adapter sends DetectPiiEntities with Spanish input', async () => {
    const send = mock.method(ComprehendClient.prototype, 'send', async function(command) {
        assert.ok(command instanceof DetectPiiEntitiesCommand);
        assert.deepEqual(command.input, {Text:'Ana', LanguageCode:'es'});
        return {Entities:[span(0,3)]};
    });
    try {
        const r=new ComprehendPiiRedactor({region:'us-east-1',language:'es'});
        assert.equal(await r.redact('Ana'),'[REDACTED]');
        assert.equal(send.mock.callCount(),1);
    } finally { send.mock.restore(); }
});

test('AWS response without Entities fails closed', async () => {
    const send = mock.method(ComprehendClient.prototype,'send',async()=>({}));
    try {
        const r=new ComprehendPiiRedactor({region:'us-east-1'});
        await assert.rejects(r.redact('private'), /omitted PII detections/);
    } finally { send.mock.restore(); }
});

test('empty AWS entity list preserves a prompt', async () => {
    const send = mock.method(ComprehendClient.prototype,'send',async()=>({Entities:[]}));
    try {
        const r=new ComprehendPiiRedactor({region:'us-east-1'});
        assert.equal(await r.redact('A plain sentence.'),'A plain sentence.');
    } finally { send.mock.restore(); }
});
