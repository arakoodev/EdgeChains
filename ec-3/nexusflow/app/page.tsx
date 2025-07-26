'use client';
import ReactFlow, { Background } from 'reactflow';
import 'reactflow/dist/style.css';

export default function Home() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <ReactFlow nodes={[]} edges={[]}> 
        <Background />
      </ReactFlow>
    </div>
  );
}
