// Custom commands for the application

// Command to clean up workflows between tests
Cypress.Commands.add('cleanupWorkflows', () => {
  cy.request('DELETE', '/api/test-cleanup')
})

// Command to wait for workflow to be saved
Cypress.Commands.add('waitForWorkflowSave', (workflowName) => {
  cy.request('GET', `/api/workflows?name=${workflowName}`)
    .its('body')
    .should('have.length.greaterThan', 0)
})

// Command to verify workflow JSON in database
Cypress.Commands.add('verifyWorkflowInDatabase', (workflowName, expectedStructure) => {
  cy.request('GET', `/api/workflows?name=${workflowName}`)
    .then((response) => {
      expect(response.body).to.have.length.greaterThan(0)
      const workflow = response.body[0]
      expect(workflow).to.have.property('definition')
      expect(workflow.definition).to.deep.include(expectedStructure)
    })
})