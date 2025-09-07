import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe('E2E Merge Workflow Test (API-based)', () => {
  const baseUrl = 'http://localhost:3000';
  const testWorkflowName = 'E2E Test Merge Workflow';
  
  beforeAll(async () => {
    // Clean up any existing test data
    try {
      await fetch(`${baseUrl}/api/test-cleanup`, { method: 'DELETE' });
    } catch (error) {
      console.warn('Cleanup failed, continuing...', error);
    }
  });

  afterAll(async () => {
    // Clean up after test
    try {
      await fetch(`${baseUrl}/api/test-cleanup`, { method: 'DELETE' });
    } catch (error) {
      console.warn('Final cleanup failed', error);
    }
  });

  it('should create a merge node workflow via API and verify correct JSON structure', async () => {
    // Step 1: Create a workflow definition that simulates what the UI would create
    const workflowDefinition = {
      root: 'trigger-1',
      nodes: {
        'trigger-1': {
          name: 'trigger',
          queue: 'default',
          children: ['action-1', 'action-2'],
          data: {
            type: 'webhook',
            config: {}
          }
        },
        'action-1': {
          name: 'action',
          queue: 'action', 
          children: ['merge-1'],
          data: {
            type: 'data-processing',
            config: {}
          }
        },
        'action-2': {
          name: 'action',
          queue: 'action',
          children: ['merge-1'], 
          data: {
            type: 'data-processing',
            config: {}
          }
        },
        'merge-1': {
          name: 'merge',
          queue: 'merge',
          data: {
            mode: 'match',
            joinType: 'keepEverything',
            input1Name: 'action-1',
            input2Name: 'action-2',
            field1: 'id',
            field2: 'userId',
            fuzzyCompare: true,
            deepMerge: true
          }
        }
      }
    };

    // Step 2: Save the workflow via API (simulating UI save action)
    const saveResponse = await fetch(`${baseUrl}/api/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: testWorkflowName,
        definition: workflowDefinition
      }),
    });

    expect(saveResponse.ok).toBe(true);
    const savedWorkflow = await saveResponse.json();
    expect(savedWorkflow).toHaveProperty('id');
    expect(savedWorkflow).toHaveProperty('name', testWorkflowName);

    // Step 3: Verify workflow is correctly stored in database
    const getResponse = await fetch(`${baseUrl}/api/workflows?name=${encodeURIComponent(testWorkflowName)}`);
    expect(getResponse.ok).toBe(true);
    
    const workflows = await getResponse.json();
    expect(workflows).toHaveLength(1);
    
    const workflow = workflows[0];
    const definition = workflow.definition;

    // Step 4: Verify the workflow structure is suitable for worker execution
    expect(definition).toHaveProperty('root');
    expect(definition).toHaveProperty('nodes');
    expect(definition.root).toBe('trigger-1');

    // Step 5: Verify each node has the required properties for BullMQ processing
    const nodeEntries = Object.entries(definition.nodes);
    expect(nodeEntries.length).toBe(4); // trigger + 2 actions + 1 merge

    for (const [nodeId, node] of nodeEntries) {
      expect(node).toHaveProperty('name');
      expect(node).toHaveProperty('queue');
      expect(node).toHaveProperty('data');
      expect(typeof node.name).toBe('string');
      expect(typeof node.queue).toBe('string');
      expect(typeof node.data).toBe('object');
    }

    // Step 6: Verify merge node specific properties
    const mergeNode = definition.nodes['merge-1'];
    expect(mergeNode).toHaveProperty('name', 'merge');
    expect(mergeNode).toHaveProperty('queue', 'merge');
    expect(mergeNode.data).toHaveProperty('mode', 'match');
    expect(mergeNode.data).toHaveProperty('joinType', 'keepEverything');
    expect(mergeNode.data).toHaveProperty('input1Name', 'action-1');
    expect(mergeNode.data).toHaveProperty('input2Name', 'action-2');

    // Step 7: Verify workflow structure supports worker execution flow
    const triggerNode = definition.nodes[definition.root];
    expect(triggerNode).toHaveProperty('children');
    expect(triggerNode.children).toEqual(['action-1', 'action-2']);

    const action1Node = definition.nodes['action-1'];
    const action2Node = definition.nodes['action-2'];
    expect(action1Node).toHaveProperty('children', ['merge-1']);
    expect(action2Node).toHaveProperty('children', ['merge-1']);

    // Step 8: Verify the JSON structure matches what merge workers expect
    expect(mergeNode.data).toMatchObject({
      mode: expect.stringMatching(/^(match|append|position)$/),
      joinType: expect.stringMatching(/^(keepEverything|keepMatches|enrichInput1|enrichInput2)$/),
      input1Name: expect.any(String),
      input2Name: expect.any(String)
    });

    console.log('✅ E2E Test: Workflow saved successfully with correct structure');
    console.log('📋 Root node:', definition.root);
    console.log('🔀 Merge node configuration:', JSON.stringify(mergeNode.data, null, 2));
    console.log('🔗 Workflow flow:', {
      trigger: triggerNode.children,
      'action-1': action1Node.children,
      'action-2': action2Node.children
    });

    // Step 9: Verify the workflow would be executable by workers
    // Check that all referenced node IDs exist
    const allNodeIds = Object.keys(definition.nodes);
    const referencedIds = new Set([definition.root]);
    
    Object.values(definition.nodes).forEach(node => {
      if (node.children) {
        node.children.forEach(childId => referencedIds.add(childId));
      }
    });

    referencedIds.forEach(id => {
      expect(allNodeIds).toContain(id);
    });

    console.log('✅ E2E Test: All node references are valid - workflow is executable by workers');
  }, 30000); // 30 second timeout for the E2E test
});