'use client';
import React, { useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';

import Sidebar from './components/Sidebar';
import WorkflowToolbar from './components/WorkflowToolbar';
import CustomNode from './components/CustomNode';

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = {
  trigger: CustomNode,
  polling: CustomNode,
  action: CustomNode,
  merge: CustomNode,
  log: CustomNode,
};

export default function Home() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [workflowName, setWorkflowName] = useState('');

  const isValidConnection = useCallback((connection: Connection) => {
    // Allow any connection between different nodes
    return connection.source !== connection.target;
  }, []);

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      console.log('Connection attempt:', params);
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const reactFlowBounds = (event.currentTarget as Element).getBoundingClientRect();
      const type = event.dataTransfer.getData('application/reactflow');
      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: { 
          label: type,
          nodeType: type,
          config: {}
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes]
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <WorkflowToolbar 
          workflowName={workflowName}
          onWorkflowNameChange={setWorkflowName}
          nodes={nodes}
          edges={edges}
        />
        <div style={{ flex: 1 }}>
          <ReactFlowProvider>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={onDragOver}
              nodeTypes={nodeTypes}
              isValidConnection={isValidConnection}
              connectionLineStyle={{ stroke: '#007bff', strokeWidth: 3, strokeDasharray: '5,5' }}
              defaultEdgeOptions={{ 
                style: { stroke: '#6c757d', strokeWidth: 2 }, 
                type: 'smoothstep',
                markerEnd: {
                  type: 'arrowclosed',
                  color: '#6c757d',
                }
              }}
              snapToGrid
              snapGrid={[15, 15]}
              fitView
              connectOnClick={false}
              deleteKeyCode="Delete"
            >
              <Controls />
              <MiniMap />
              <Background variant="dots" gap={12} size={1} />
            </ReactFlow>
          </ReactFlowProvider>
        </div>
      </div>
    </div>
  );
}
