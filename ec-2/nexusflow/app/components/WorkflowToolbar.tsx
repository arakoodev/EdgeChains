'use client';
import React, { useState } from 'react';
import { Node, Edge } from 'reactflow';

interface WorkflowToolbarProps {
  workflowName: string;
  onWorkflowNameChange: (name: string) => void;
  nodes: Node[];
  edges: Edge[];
}

export default function WorkflowToolbar({
  workflowName,
  onWorkflowNameChange,
  nodes,
  edges
}: WorkflowToolbarProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const saveWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name');
      return;
    }

    setIsSaving(true);
    try {
      // Convert ReactFlow nodes/edges to workflow definition
      const workflowDef = convertToWorkflowDefinition(nodes, edges);
      
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workflowName,
          definition: workflowDef
        }),
      });

      if (response.ok) {
        alert('Workflow saved successfully!');
      } else {
        throw new Error('Failed to save workflow');
      }
    } catch (error) {
      alert('Error saving workflow: ' + (error as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const runWorkflow = async () => {
    if (!workflowName.trim()) {
      alert('Please save the workflow first');
      return;
    }

    setIsRunning(true);
    try {
      const response = await fetch('/api/workflows/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: workflowName,
          nodes: nodes,
          edges: edges
        }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Workflow started! Run ID: ${result.runId}`);
      } else {
        throw new Error('Failed to run workflow');
      }
    } catch (error) {
      alert('Error running workflow: ' + (error as Error).message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{
      height: '60px',
      backgroundColor: '#343a40',
      borderBottom: '1px solid #495057',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '16px'
    }}>
      <input
        type="text"
        placeholder="Enter workflow name..."
        value={workflowName}
        onChange={(e) => onWorkflowNameChange(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid #6c757d',
          borderRadius: '4px',
          fontSize: '14px',
          width: '250px',
          backgroundColor: 'white'
        }}
      />
      
      <button
        onClick={saveWorkflow}
        disabled={isSaving || !workflowName.trim()}
        style={{
          padding: '8px 16px',
          backgroundColor: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          opacity: (isSaving || !workflowName.trim()) ? 0.6 : 1
        }}
      >
        {isSaving ? 'Saving...' : 'Save'}
      </button>

      <button
        onClick={runWorkflow}
        disabled={isRunning || nodes.length === 0}
        style={{
          padding: '8px 16px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '14px',
          cursor: 'pointer',
          opacity: (isRunning || nodes.length === 0) ? 0.6 : 1
        }}
      >
        {isRunning ? 'Running...' : 'Run'}
      </button>

      <div style={{ marginLeft: 'auto', color: '#adb5bd', fontSize: '14px' }}>
        {nodes.length} nodes, {edges.length} connections
      </div>
    </div>
  );
}

function convertToWorkflowDefinition(nodes: Node[], edges: Edge[]) {
  const workflowNodes: Record<string, any> = {};
  
  // Find root node (node with no incoming edges)
  const incomingEdges = new Set(edges.map(e => e.target));
  const rootNode = nodes.find(n => !incomingEdges.has(n.id));
  
  if (!rootNode) {
    throw new Error('No root node found');
  }

  // Build workflow definition
  nodes.forEach(node => {
    const children = edges
      .filter(edge => edge.source === node.id)
      .map(edge => edge.target);

    workflowNodes[node.id] = {
      name: node.data.nodeType || node.type,
      queue: getQueueName(node.type),
      ...(children.length > 0 && { children }),
      data: node.data.config || {}
    };
  });

  return {
    root: rootNode.id,
    nodes: workflowNodes
  };
}

function getQueueName(nodeType: string): string {
  switch (nodeType) {
    case 'merge':
      return 'merge';
    case 'log':
      return 'log';
    case 'action':
      return 'action';
    default:
      return 'default';
  }
}