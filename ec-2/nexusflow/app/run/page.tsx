'use client';
import { useState } from 'react';
import { runEchoWorkflow } from '../actions';

export default function RunPage() {
  const [msg, setMsg] = useState('');
  return (
    <div style={{ padding: 20 }}>
      <input value={msg} onChange={e => setMsg(e.target.value)} />
      <button onClick={() => runEchoWorkflow(msg)}>Run</button>
    </div>
  );
}
