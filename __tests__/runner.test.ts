/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
import * as core from '@actions/core'
import { LinearClient, Team, Issue, TeamConnection, WorkflowStateConnection, IssueConnection, IssueLabelConnection } from '@linear/sdk'
import Runner, { Inputs } from '../src/runner'

jest.mock('@actions/core')
jest.mock('@linear/sdk')

const mockCore = core as jest.Mocked<typeof core>
const mockLinearClient = LinearClient as jest.MockedClass<typeof LinearClient>

describe('Runner', () => {
  let runner: Runner
  let inputs: Inputs
  let originalExit: typeof process.exit

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
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('run method completes successfully with valid inputs', async () => {
    const mockTeam: Team = { id: 'team-id', labels: jest.fn() } as any
    const mockIssue1: Issue = { id: 'issue-id', identifier: 'T-1', state: { id: 'backlog-id', name: 'Backlog' }, labelIds: ['wontfix-id', 'in-review'], update: jest.fn() } as any
    const mockIssue3: Issue = { id: 'issue-id', identifier: 'T-3', state: { id: 'in-progress-id', name: 'In Progress' }, labelIds: [], update: jest.fn() } as any
    const mockIssue7: Issue = { id: 'issue-id', identifier: 'T-7', state: undefined, labelIds: [], update: jest.fn() } as any

    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = {
      nodes: [
        { id: 'in-progress-id', name: 'In Progress' },
        { id: 'backlog-id', name: 'Backlog' }
      ]
    } as any
    const mockLabelConnection: IssueLabelConnection = {
      nodes: [
        { id: 'bug-id', name: 'bug' },
        { id: 'urgent-id', name: 'urgent' },
        { id: 'wontfix-id', name: 'wontfix' }
      ]
    } as any
    const mockIssueConnection: IssueConnection = { nodes: [mockIssue1, mockIssue3, mockIssue7] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)
    ;(mockTeam.labels as jest.Mock).mockResolvedValue(mockLabelConnection)
    mockLinearClient.prototype.issues.mockResolvedValue(mockIssueConnection)

    await runner.run(inputs)

    expect(mockIssue1.update).toHaveBeenCalledWith({ stateId: 'in-progress-id', labelIds: ['in-review', 'bug-id', 'urgent-id'] })
    expect(mockIssue3.update).not.toHaveBeenCalled()
    expect(mockIssue7.update).not.toHaveBeenCalled()

    expect(mockCore.debug).toHaveBeenCalled()
    expect(mockCore.info).toHaveBeenCalledWith('Issue T-1 updated!')
    expect(mockCore.info).not.toHaveBeenCalledWith('Issue T-3 updated!')
    expect(mockCore.warning).toHaveBeenCalledWith('Issue T-3 is not in whitelisted state (In Progress). Skipping')
    expect(mockCore.info).not.toHaveBeenCalledWith('Issue T-7 updated!')
    expect(mockCore.warning).toHaveBeenCalledWith("Can't get state for issue T-7. Skipping")
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
    const mockTeam: Team = { id: 'team-id', labels: jest.fn() } as any
    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Transition to state found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('run method fails with invalid label names', async () => {
    const mockTeam: Team = { id: 'team-id', labels: jest.fn() } as any
    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = {
      nodes: [
        { id: 'in-progress-id', name: 'In Progress' },
        { id: 'backlog-id', name: 'Backlog' }
      ]
    } as any
    const mockLabelConnection: IssueLabelConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)
    ;(mockTeam.labels as jest.Mock).mockResolvedValue(mockLabelConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Add labels found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('run method fails with invalid issue numbers', async () => {
    const mockTeam: Team = { id: 'team-id', labels: jest.fn() } as any
    const mockTeamConnection: TeamConnection = { nodes: [mockTeam] } as any
    const mockWorkflowStateConnection: WorkflowStateConnection = {
      nodes: [
        { id: 'in-progress-id', name: 'In Progress' },
        { id: 'backlog-id', name: 'Backlog' }
      ]
    } as any
    const mockLabelConnection: IssueLabelConnection = {
      nodes: [
        { id: 'bug-id', name: 'bug' },
        { id: 'urgent-id', name: 'urgent' },
        { id: 'wontfix-id', name: 'wontfix' }
      ]
    } as any
    const mockIssueConnection: IssueConnection = { nodes: [] } as any

    mockLinearClient.prototype.teams.mockResolvedValue(mockTeamConnection)
    mockLinearClient.prototype.workflowStates.mockResolvedValue(mockWorkflowStateConnection)
    ;(mockTeam.labels as jest.Mock).mockResolvedValue(mockLabelConnection)
    mockLinearClient.prototype.issues.mockResolvedValue(mockIssueConnection)

    await expect(runner.run(inputs)).rejects.toThrow('process.exit: 1')

    expect(mockCore.setFailed).toHaveBeenCalledWith('Number of resources fetched from Linear does not match number of provided identifiers. See debug logs for more details.')
    expect(mockCore.debug).toHaveBeenCalledWith('Issues found: []')
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})
