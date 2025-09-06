'use client';
import React from 'react';

const nodeTypes = [
  { type: 'trigger', label: 'Webhook Trigger', icon: '🔗', description: 'HTTP webhook endpoint' },
  { type: 'polling', label: 'Polling Trigger', icon: '⏰', description: 'Scheduled polling' },
  { type: 'action', label: 'Action Node', icon: '⚡', description: 'Process data' },
  { type: 'merge', label: 'Merge Node', icon: '🔀', description: 'Combine data streams' },
  { type: 'log', label: 'Log Node', icon: '📝', description: 'Log messages' },
];

export default function Sidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div style={{
      width: '280px',
      backgroundColor: '#f8f9fa',
      borderRight: '1px solid #e9ecef',
      padding: '20px',
      overflowY: 'auto'
    }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#495057' }}>Node Types</h3>
      <div>
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            draggable
            onDragStart={(event) => onDragStart(event, node.type)}
            style={{
              padding: '12px 16px',
              margin: '0 0 12px 0',
              backgroundColor: 'white',
              border: '1px solid #dee2e6',
              borderRadius: '8px',
              cursor: 'grab',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '4px'
            }}>
              <span style={{ fontSize: '20px', marginRight: '8px' }}>
                {node.icon}
              </span>
              <span style={{
                fontWeight: '600',
                color: '#212529',
                fontSize: '14px'
              }}>
                {node.label}
              </span>
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6c757d',
              lineHeight: '1.4'
            }}>
              {node.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}