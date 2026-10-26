import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { IndicatorCommandQueue } from './indicator-command-queue.ts';

test('first command starts before the sender returns', () => {
  const writes: string[] = [];
  const queue = new IndicatorCommandQueue((payload, _done) => {
    writes.push(new TextDecoder().decode(payload));
  }, () => {});
  queue.send('Activate');
  assert.deepEqual(writes, ['Activate\n']);
});

test('later commands wait for the first write completion', () => {
  const writes: string[] = [];
  const callbacks: ((ok:boolean, size:number)=>void)[] = [];
  const queue = new IndicatorCommandQueue((data, cb) => {
    writes.push(new TextDecoder().decode(data));
    callbacks.push(cb);
  }, () => {});
  queue.send('Activate');
  queue.send('showShowButton');
  queue.send('Close');
  assert.deepEqual(writes, ['Activate\n']);
  callbacks[0](true, new TextEncoder().encode(writes[0]).length);
  assert.deepEqual(writes, ['Activate\n','showShowButton\n']);
  callbacks[1](true, new TextEncoder().encode(writes[1]).length);
  assert.deepEqual(writes, ['Activate\n','showShowButton\n','Close\n']);
});

test('failed asynchronous write clears queue and triggers fallback once', () => {
  const callbacks: ((ok:boolean, size:number)=>void)[]=[];
  const writes: string[]=[];
  let failures=0;
  const queue = new IndicatorCommandQueue((data, cb) => {
    writes.push(new TextDecoder().decode(data));
    callbacks.push(cb);
  }, ()=>failures++);
  queue.send('Activate');queue.send('Hide');
  callbacks[0](false,0);
  assert.deepEqual(writes,['Activate\n']);
  assert.equal(failures,1);
});

test('short write triggers fallback', () => {
  let failure = 0;
  const queue=new IndicatorCommandQueue((_data, cb)=> cb(true, 1),()=> failure++);
  queue.send('Activate');
  assert.equal(failure,1);
});

test('synchronous transport exceptions trigger fallback', () => {
  let failure = 0;
  const queue=new IndicatorCommandQueue(()=> {throw new Error('closed stream');},()=> failure++);
  queue.send('Activate');
  assert.equal(failure,1);
});

test('a command sent after a completed command starts immediately', () => {
  let received = '';
  const queue=new IndicatorCommandQueue((data, cb)=> {
    received+=new TextDecoder().decode(data);
    cb(true,data.length);
  },()=>{});
  queue.send('Activate');queue.send('Hide');
  assert.equal(received,'Activate\nHide\n');
});

test('empty command rejected without changing stream', () => {
  let calls=0;
  const queue = new IndicatorCommandQueue(()=>{calls++;},()=>{});
  assert.throws(()=>queue.send(''),/message/);
  assert.equal(calls,0);
});
