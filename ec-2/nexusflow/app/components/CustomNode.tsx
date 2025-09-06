'use client';
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';

const nodeConfig = {
  trigger: { icon: '🔗', color: '#28a745', label: 'Webhook Trigger' },
  polling: { icon: '⏰', color: '#ffc107', label: 'Polling Trigger' },
  action: { icon: '⚡', color: '#007bff', label: 'Action Node' },
  merge: { icon: '🔀', color: '#6f42c1', label: 'Merge Node' },
  log: { icon: '📝', color: '#17a2b8', label: 'Log Node' },
};

export default function CustomNode({ data, type }: NodeProps) {
  const config = nodeConfig[type as keyof typeof nodeConfig] || nodeConfig.action;
  
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: '8px',
      border: `2px solid ${config.color}`,
      backgroundColor: 'white',
      minWidth: '120px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      position: 'relative'
    }}>
      {/* Top handle - input */}
      <Handle
        type="target"
        position={Position.Top}
        id="input"
        style={{
          background: config.color,
          width: 14,
          height: 14,
          border: '3px solid white',
          borderRadius: '50%',
          top: -7,
          cursor: 'crosshair'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {/* Bottom handle - output */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        style={{
          background: config.color,
          width: 14,
          height: 14,
          border: '3px solid white',
          borderRadius: '50%',
          bottom: -7,
          cursor: 'crosshair'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.2)';
          e.currentTarget.style.boxShadow = '0 0 10px rgba(0,0,0,0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />

      {/* Left handle - can be source or target */}
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        style={{
          background: '#17a2b8',
          width: 12,
          height: 12,
          border: '2px solid white',
          borderRadius: '50%',
          left: -6,
          cursor: 'crosshair'
        }}
      />

      {/* Right handle - can be source or target */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        style={{
          background: '#17a2b8',
          width: 12,
          height: 12,
          border: '2px solid white',
          borderRadius: '50%',
          right: -6,
          cursor: 'crosshair'
        }}
      />
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '4px'
      }}>
        <span style={{ fontSize: '24px' }}>{config.icon}</span>
        <div style={{
          fontSize: '12px',
          fontWeight: '600',
          color: '#212529',
          textAlign: 'center',
          lineHeight: '1.2'
        }}>
          {data.label || config.label}
        </div>
      </div>
    </div>
  );
}