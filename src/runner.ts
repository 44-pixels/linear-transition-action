import * as core from '@actions/core'
import { Issue, LinearClient, Team } from '@linear/sdk'
import Labeler from './labeler'

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
    const issues = await this.fetchIssues(inputs.issueNumbers)

    if (inputs.transitionTo) {
      const { transitionToStateId, transitionFromStateIds } = await this.fetchStates(inputs.transitionTo, inputs.transitionFrom)
      await this.updateIssues(issues, transitionToStateId, transitionFromStateIds)
    }

    await this.addLabels(issues, inputs.addLabels)
    await this.removeLabels(issues, inputs.removeLabels)
  }

  private async addLabels(issues: Issue[], labels: string[]): Promise<void> {
    const labeler = new Labeler(this.client, this.team)

    for await (const issue of issues) {
      labeler.addLabels(issue, labels)
    }
  }

  private async removeLabels(issues: Issue[], labels: string[]): Promise<void> {
    const labeler = new Labeler(this.client, this.team)

    for await (const issue of issues) {
      labeler.removeLabels(issue, labels)
    }
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

  private async updateIssues(issues: Issue[], transitionToId: string, transitionFromIds: string[]): Promise<void> {
    const updatePromises = issues.map(async issue => this.updateIssue(issue, transitionToId, transitionFromIds))
    await Promise.all(updatePromises)
  }

  // This method is designed not to fail other updates,
  // since if previous validations were passed, then we can proceed.
  // Instead it notifies user about failures, but does not exit the process
  private async updateIssue(issue: Issue, transitionToId: string, transitionFromIds: string[]): Promise<void> {
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

      await issue.update({ stateId: transitionToId })
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