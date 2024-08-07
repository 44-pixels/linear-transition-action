import * as core from '@actions/core'
import { Issue, LinearClient, Team } from '@linear/sdk'

interface Measurable {
  length: number
}

export interface Inputs {
  apiKey: string
  teamKey: string
  transitionTo: string
  issueNumbers: number[]
  addLabels: string[]
  removeLabels: string[]
  transitionFrom: string[]
}

// This is the main runner class
// It's run method calls private methods (steps) in a proper order
export default class Runner {
  client: LinearClient
  team!: Team

  constructor(apiKey: string) {
    this.client = new LinearClient({ apiKey })
  }

  // Runs steps in proper order
  async run(inputs: Inputs): Promise<void> {
    this.team = await this.fetchTeam(inputs.teamKey)
    const { transitionToStateId, transitionFromStateIds } = await this.fetchStates(inputs.transitionTo, inputs.transitionFrom)
    const { addLabelIds, removeLabelIds } = await this.fetchLabels(inputs.addLabels, inputs.removeLabels)
    const issues = await this.fetchIssues(inputs.issueNumbers)

    await this.updateIssues(issues, transitionToStateId, transitionFromStateIds, addLabelIds, removeLabelIds)
  }

  // Fetches Linear team
  // Fails action if not found
  private async fetchTeam(key: string): Promise<Team> {
    const response = await this.client.teams({
      filter: { key: { eq: key } }
    })

    core.debug(`Team found: ${JSON.stringify(response.nodes)}`)
    this.assertLength(response.nodes, [key])

    return response.nodes[0]
  }

  // Fetches states (to get their ids).
  // Fails action if any of provided (transition_to, transition_from) not found on Linear
  private async fetchStates(transitionTo: string, transitionFrom: string[]): Promise<{ transitionToStateId: string; transitionFromStateIds: string[] }> {
    const response = await this.client.workflowStates({
      filter: {
        name: { in: [...new Set([transitionTo, ...transitionFrom])] },
        team: { id: { eq: this.team.id } }
      }
    })

    const transitionToStates = response.nodes.filter(state => state.name === transitionTo)
    core.debug(`Transition to state found: ${JSON.stringify(transitionToStates)}`)
    this.assertLength(transitionToStates, [transitionTo])

    const transitionFromStates = response.nodes.filter(state => transitionFrom.includes(state.name))
    core.debug(`Transition from states found: ${JSON.stringify(transitionFromStates)}`)
    this.assertLength(transitionFromStates, transitionFrom)

    return {
      transitionToStateId: transitionToStates[0].id,
      transitionFromStateIds: transitionFromStates.map(state => state.id)
    }
  }

  // Fetches labels (to get their ids). And splits them into 2 groups (to remove / to add)
  // Fails action if any of provided (addLabels, removeLabels) not found on Linear
  private async fetchLabels(addLabelNames: string[], removeLabelNames: string[]): Promise<{ addLabelIds: string[]; removeLabelIds: string[] }> {
    const response = await this.team.labels({
      filter: { name: { in: [...new Set([...addLabelNames, ...removeLabelNames])] } }
    })

    const addLabelNodes = response.nodes.filter(label => addLabelNames.includes(label.name))
    core.debug(`Add labels found: ${JSON.stringify(addLabelNodes)}`)
    this.assertLength(addLabelNodes, addLabelNames)

    const removeLabelNodes = response.nodes.filter(label => removeLabelNames.includes(label.name))
    core.debug(`Remove labels found: ${JSON.stringify(removeLabelNodes)}`)
    this.assertLength(removeLabelNodes, removeLabelNames)

    return {
      addLabelIds: addLabelNodes.map(label => label.id),
      removeLabelIds: removeLabelNodes.map(label => label.id)
    }
  }

  // Fetches issues to update.
  // Fails action if any of provided issues not found on Linear
  private async fetchIssues(issueNumbers: number[]): Promise<Issue[]> {
    const response = await this.client.issues({
      filter: {
        number: { in: issueNumbers },
        team: { id: { eq: this.team.id } }
      }
    })

    core.debug(`Issues found: ${JSON.stringify(response.nodes)}`)
    this.assertLength(response.nodes, issueNumbers)

    return response.nodes
  }

  private async updateIssues(issues: Issue[], transitionToId: string, transitionFromIds: string[], toAddLabelIds: string[], toRemoveLabelIds: string[]): Promise<void> {
    const updatePromises = issues.map(async issue => this.updateIssue(issue, transitionToId, transitionFromIds, toAddLabelIds, toRemoveLabelIds))
    await Promise.all(updatePromises)
  }

  // This method is designed not to fail other updates,
  // since if previous validations were passed, then we can proceed.
  // Instead it notifies user about failures, but does not exit the process
  private async updateIssue(issue: Issue, transitionToId: string, transitionFromIds: string[], toAddLabelIds: string[], toRemoveLabelIds: string[]): Promise<void> {
    try {
      const state = await issue.state

      if (!state) {
        core.warning(`Can't get state for issue ${issue.identifier}. Skipping`)
        return
      }

      if (transitionFromIds.length > 0 && !transitionFromIds.includes(state.id)) {
        core.warning(`Issue ${issue.identifier} is not in whitelisted state (${state.name}). Skipping`)
        return
      }

      const compoundLabelIds = [...new Set([...issue.labelIds, ...toAddLabelIds])].filter(id => !toRemoveLabelIds.includes(id))
      await issue.update({ stateId: transitionToId, labelIds: compoundLabelIds })
      core.info(`Issue ${issue.identifier} updated!`)
    } catch (error) {
      core.setFailed(`Unexpected error happened updating ${issue.identifier}: ${error instanceof Error ? error.message : error}. Continuing with other issues`)
    }
  }

  // This method helps to avoid a lot of boilerplate validation code
  // Is used to validate that all identifiers provided in inputs can be found in Linear
  private assertLength(nodes1: Measurable, nodes2: Measurable): void {
    if (nodes1.length !== nodes2.length) {
      core.setFailed('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
      process.exit(1)
    }
  }
}
