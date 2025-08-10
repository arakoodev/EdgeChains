import ReactFlow, { addEdge, Background, Controls, MiniMap, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { useEffect } from 'react';
import { v4 as uuid } from 'uuid';

const api = 'http://localhost:3001';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    fetch(`${api}/nodes`).then(res => res.json()).then(data => {
      if(data.nodes){
        setNodes(data.nodes.map((n:any) => ({id:n.id, position:{x:n.posX,y:n.posY}, data: JSON.parse(n.data), type:n.type})));
      }
      if(data.edges){
        setEdges(data.edges);
      }
    });
  }, []);

  const addNode = () => {
    const id = uuid();
    const newNode = { id, position: { x: Math.random()*250, y: Math.random()*250 }, data: { label: 'node' } };
    setNodes(ns => [...ns, newNode]);
    fetch(`${api}/nodes`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id, type:'default', data:{label:'node'}, posX:newNode.position.x, posY:newNode.position.y})});
  };

  const onConnect = (params:any) => {
    const edge = { ...params, id: uuid() };
    setEdges((eds) => addEdge(edge, eds));
    fetch(`${api}/edges`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(edge)});
  };

  return (
    <div style={{width:'100vw', height:'100vh'}}>
      <button onClick={addNode}>Add Node</button>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}>
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  );
}

export default App;
