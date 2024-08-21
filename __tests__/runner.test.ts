/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
import * as core from '@actions/core'
import { LinearClient, Team, Issue, TeamConnection, WorkflowStateConnection, IssueConnection, IssueLabel } from '@linear/sdk'
import Runner, { Inputs } from '../src/runner'
import Labeler from '../src/labeler'

jest.mock('@actions/core')
jest.mock('@linear/sdk')
jest.mock('../src/labeler')

const mockCore = core as jest.Mocked<typeof core>
const mockLinearClient = LinearClient as jest.MockedClass<typeof LinearClient>

describe('Runner', () => {
  let runner: Runner
  let inputs: Inputs
  let originalExit: typeof process.exit
  let addLabels: typeof jest.fn
  let removeLabels: typeof jest.fn
  let findOrCreateLabels: typeof jest.fn
  let foundLabels: IssueLabel[]

  beforeAll(() => {
    originalExit = process.exit
    process.exit = jest.fn((code?: number) => {
      throw new Error(`process.exit: ${code}`)
    }) as any
  })

  afterAll(() => {
    process.exit = originalExit
  })

  beforeEach(() => {
    inputs = {
      apiKey: 'test-api-key',
      teamKey: 'test-team-key',
      transitionTo: 'In Progress',
      issueNumbers: [1, 3, 7],
      addLabels: ['bug', 'urgent'],
      removeLabels: ['wontfix'],
      transitionFrom: ['Backlog']
    }

    runner = new Runner(inputs.apiKey)

    foundLabels = [{ id: 'label' }] as any

    addLabels = jest.fn()
    removeLabels = jest.fn()
    findOrCreateLabels = jest.fn(() => foundLabels as any)
    ;(Labeler as jest.Mock).mockImplementation(() => ({
      findOrCreateLabels,
      addLabels,
      removeLabels
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('run method completes successfully with valid inputs', async () => {
    const mockTeam: Team = { id: 'team-id' } as any
    const mockIssue1: Issue = { id: 'issue-id', identifier: 'T-1', state: { id: 'backlog-id', name: 'Backlog' }, update: jest.fn() } as any
    const mockIssue3: Issue = { id: 'issue-id', identifier: 'T-3', state: { id: 'in-progress-id', name: 'In Progress' }, update: jest.fn() } as any
    const mockIssue7: Issue = { id: 'issue-id', identifier: 'T-7', state: undefined, update: jest.fn() } as any

    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = {
      nodes: [
        { id: 'in-progress-id', name: 'In Progress' },
        { id: 'backlog-id', name: 'Backlog' }
      ]
    } as any
    const mockIssueConnection: IssueConnection = { nodes: [mockIssue1, mockIssue3, mockIssue7] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)
    mockLinearClient.prototype.issues.mockResolvedValue(mockIssueConnection)

    await runner.run(inputs)

    expect(mockIssue1.update).toHaveBeenCalledWith({ stateId: 'in-progress-id' })
    expect(mockIssue3.update).not.toHaveBeenCalled()
    expect(mockIssue7.update).not.toHaveBeenCalled()

    expect(mockCore.debug).toHaveBeenCalled()
    expect(mockCore.info).toHaveBeenCalledWith('Issue T-1 updated!')
    expect(mockCore.info).not.toHaveBeenCalledWith('Issue T-3 updated!')
    expect(mockCore.warning).toHaveBeenCalledWith('Issue T-3 is not in whitelisted state (In Progress). Skipping')
    expect(mockCore.info).not.toHaveBeenCalledWith('Issue T-7 updated!')
    expect(mockCore.warning).toHaveBeenCalledWith("Can't get state for issue T-7. Skipping")

    expect(findOrCreateLabels).toHaveBeenCalledWith(['bug', 'urgent'])
    expect(addLabels).toHaveBeenCalledWith(mockIssue1, foundLabels)
    expect(removeLabels).toHaveBeenCalledWith(mockIssue1, ['wontfix'])
    expect(addLabels).toHaveBeenCalledWith(mockIssue3, foundLabels)
    expect(removeLabels).toHaveBeenCalledWith(mockIssue3, ['wontfix'])
    expect(addLabels).toHaveBeenCalledWith(mockIssue7, foundLabels)
    expect(removeLabels).toHaveBeenCalledWith(mockIssue7, ['wontfix'])
  })

  it('run method fails with invalid team key', async () => {
    const mockTeamConnection: TeamConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Team found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('run method fails with invalid state names', async () => {
    const mockTeam: Team = { id: 'team-id' } as any
    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Transition to state found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('run method fails with invalid issue numbers', async () => {
    const mockTeam: Team = { id: 'team-id' } as any
    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = {
      nodes: [
        { id: 'in-progress-id', name: 'In Progress' },
        { id: 'backlog-id', name: 'Backlog' }
      ]
    } as any
    const mockIssueConnection: IssueConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)
    mockLinearClient.prototype.issues.mockResolvedValue(mockIssueConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Issues found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  describe('when transitionTo is absent', () => {
    beforeEach(() => {
      inputs.transitionTo = ''
      inputs.issueNumbers = [1]
    })

    it('still updates labels', async () => {
      const mockTeam: Team = { id: 'team-id' } as any
      const mockIssue: Issue = { id: 'issue-id', identifier: 'T-1', update: jest.fn() } as any

      const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
      const mockIssueConnection: IssueConnection = { nodes: [mockIssue] } as any

      mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
      mockLinearClient.prototype.issues.mockResolvedValue(mockIssueConnection)

      await runner.run(inputs)

      expect(mockIssue.update).not.toHaveBeenCalled()

      expect(findOrCreateLabels).toHaveBeenCalledWith(['bug', 'urgent'])
      expect(addLabels).toHaveBeenCalledWith(mockIssue, foundLabels)
      expect(removeLabels).toHaveBeenCalledWith(mockIssue, ['wontfix'])
    })
  })
})
