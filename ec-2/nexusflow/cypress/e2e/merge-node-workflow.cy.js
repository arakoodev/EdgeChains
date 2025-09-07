describe('Merge Node Workflow E2E Test - Real UI Interaction', () => {
  beforeEach(() => {
    // Clean up any existing test data
    cy.cleanupWorkflows()
    
    // Visit the application
    cy.visit('/')
    
    // Wait for the application to fully load
    cy.get('[data-cy="node-trigger"]').should('be.visible')
    cy.get('.react-flow__renderer').should('be.visible')
  })

  it('should create a merge node workflow through actual drag and drop UI interactions', () => {
    const workflowName = 'Critical Cypress Test Merge Workflow'
    
    // Step 1: Enter workflow name in the toolbar
    cy.get('input[placeholder="Enter workflow name..."]')
      .clear()
      .type(workflowName)
      .should('have.value', workflowName)
    
    // Step 2: Perform actual drag and drop operations
    // Add trigger node via real drag and drop
    cy.get('[data-cy="node-trigger"]')
      .should('be.visible')
      .then(($trigger) => {
        const trigger = $trigger[0]
        const canvas = Cypress.$('.react-flow__renderer')[0]
        
        // Create real drag and drop events
        const dataTransfer = new DataTransfer()
        
        // Start drag from trigger
        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true })
        trigger.dispatchEvent(dragStartEvent)
        
        // Set the data transfer
        dataTransfer.setData('application/reactflow', 'trigger')
        
        // Drag over canvas
        const dragOverEvent = new DragEvent('dragover', { 
          dataTransfer, 
          bubbles: true,
          cancelable: true 
        })
        canvas.dispatchEvent(dragOverEvent)
        
        // Drop on canvas
        const dropEvent = new DragEvent('drop', { 
          dataTransfer,
          bubbles: true,
          clientX: 300,
          clientY: 150
        })
        canvas.dispatchEvent(dropEvent)
      })
    
    // Verify trigger node was created
    cy.get('.react-flow__node').should('have.length', 1)
    
    // Add first action node
    cy.get('[data-cy="node-action"]')
      .should('be.visible')
      .then(($action) => {
        const action = $action[0]
        const canvas = Cypress.$('.react-flow__renderer')[0]
        
        const dataTransfer = new DataTransfer()
        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true })
        action.dispatchEvent(dragStartEvent)
        
        dataTransfer.setData('application/reactflow', 'action')
        
        const dragOverEvent = new DragEvent('dragover', { 
          dataTransfer, 
          bubbles: true,
          cancelable: true 
        })
        canvas.dispatchEvent(dragOverEvent)
        
        const dropEvent = new DragEvent('drop', { 
          dataTransfer,
          bubbles: true,
          clientX: 200,
          clientY: 300
        })
        canvas.dispatchEvent(dropEvent)
      })
    
    // Verify we now have 2 nodes
    cy.get('.react-flow__node').should('have.length', 2)
    
    // Add second action node
    cy.get('[data-cy="node-action"]')
      .should('be.visible')
      .then(($action) => {
        const action = $action[0]
        const canvas = Cypress.$('.react-flow__renderer')[0]
        
        const dataTransfer = new DataTransfer()
        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true })
        action.dispatchEvent(dragStartEvent)
        
        dataTransfer.setData('application/reactflow', 'action')
        
        const dragOverEvent = new DragEvent('dragover', { 
          dataTransfer, 
          bubbles: true,
          cancelable: true 
        })
        canvas.dispatchEvent(dragOverEvent)
        
        const dropEvent = new DragEvent('drop', { 
          dataTransfer,
          bubbles: true,
          clientX: 400,
          clientY: 300
        })
        canvas.dispatchEvent(dropEvent)
      })
    
    // Verify we now have 3 nodes
    cy.get('.react-flow__node').should('have.length', 3)
    
    // Add the critical merge node
    cy.get('[data-cy="node-merge"]')
      .should('be.visible')
      .then(($merge) => {
        const merge = $merge[0]
        const canvas = Cypress.$('.react-flow__renderer')[0]
        
        const dataTransfer = new DataTransfer()
        const dragStartEvent = new DragEvent('dragstart', { dataTransfer, bubbles: true })
        merge.dispatchEvent(dragStartEvent)
        
        dataTransfer.setData('application/reactflow', 'merge')
        
        const dragOverEvent = new DragEvent('dragover', { 
          dataTransfer, 
          bubbles: true,
          cancelable: true 
        })
        canvas.dispatchEvent(dragOverEvent)
        
        const dropEvent = new DragEvent('drop', { 
          dataTransfer,
          bubbles: true,
          clientX: 300,
          clientY: 450
        })
        canvas.dispatchEvent(dropEvent)
      })
    
    // Verify all 4 nodes are now present
    cy.get('.react-flow__node').should('have.length', 4)
    
    // Step 3: Save the workflow using the actual UI button
    cy.contains('button', 'Save')
      .should('be.visible')
      .should('not.be.disabled')
      .click()
    
    // Step 4: Handle the browser alert that appears on successful save
    cy.window().then((win) => {
      cy.stub(win, 'alert').as('saveAlert')
    })
    
    // Wait for the save operation to complete
    cy.wait(2000)
    
    // Step 5: Verify the workflow was actually saved to the database
    cy.request('GET', `/api/workflows?name=${encodeURIComponent(workflowName)}`)
      .then((response) => {
        expect(response.status).to.eq(200)
        expect(response.body).to.have.length.greaterThan(0)
        
        const workflow = response.body[0]
        const definition = workflow.definition
        
        // Critical verification: workflow structure must be valid
        expect(definition).to.have.property('root')
        expect(definition).to.have.property('nodes')
        expect(definition.root).to.be.a('string')
        expect(definition.nodes).to.be.an('object')
        
        // Verify we have all expected node types
        const nodeEntries = Object.entries(definition.nodes)
        expect(nodeEntries.length).to.eq(4)
        
        // Find and verify the merge node specifically
        const mergeNodes = nodeEntries.filter(([id, node]) => node.queue === 'merge')
        expect(mergeNodes.length).to.eq(1)
        
        const [mergeNodeId, mergeNode] = mergeNodes[0]
        expect(mergeNode).to.have.property('name', 'merge')
        expect(mergeNode).to.have.property('queue', 'merge')
        expect(mergeNode).to.have.property('data')
        
        // Critical: Each node must have proper structure for worker execution
        Object.entries(definition.nodes).forEach(([nodeId, node]) => {
          expect(node).to.have.property('name')
          expect(node).to.have.property('queue')  
          expect(node).to.have.property('data')
          expect(typeof node.name).to.eq('string')
          expect(typeof node.queue).to.eq('string')
          expect(typeof node.data).to.eq('object')
        })
        
        // Log critical test results
        cy.log('🚨 CRITICAL: Workflow created via real UI drag and drop')
        cy.log('📋 Saved workflow structure:', JSON.stringify(definition, null, 2))
        cy.log('🔀 Merge node verification:', JSON.stringify(mergeNode, null, 2))
        cy.log('✅ All nodes have correct structure for worker execution')
      })
  })
  
  afterEach(() => {
    // Critical cleanup
    cy.cleanupWorkflows()
  })
})