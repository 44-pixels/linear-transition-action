/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
import { Issue, IssueLabelPayload, LinearClient, LinearFetch, Team } from '@linear/sdk'
import Labeler from '../src/labeler'
import * as core from '@actions/core'

jest.mock('@actions/core')
jest.mock('@linear/sdk')

describe('Labeler', () => {
  let labeler: Labeler
  let mockClient: jest.Mocked<LinearClient>
  let mockTeam: jest.Mocked<Team>
  let mockIssue: jest.Mocked<Issue>
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
    mockClient = {
      issueAddLabel: jest.fn(),
      issueRemoveLabel: jest.fn(),
      createIssueLabel: jest.fn()
    } as unknown as jest.Mocked<LinearClient>

    mockTeam = {
      id: 'team-id',
      labels: jest.fn()
    } as unknown as jest.Mocked<Team>

    mockIssue = {
      id: 'issue-id'
    } as unknown as jest.Mocked<Issue>

    labeler = new Labeler(mockClient, mockTeam)
  })

  describe('removeLabels', () => {
    it('removes label from the issue', async () => {
      const labelId = 'label-id'
      mockTeam.labels.mockResolvedValue({ nodes: [{ id: labelId, name: 'label' }] } as any)

      await labeler.removeLabels(mockIssue, ['nested/label'])

      expect(mockClient.issueRemoveLabel).toHaveBeenCalledWith(mockIssue.id, labelId)
    })

    describe('when label not found', () => {
      it('cancels action', async () => {
        mockTeam.labels.mockResolvedValue({ nodes: [] } as any)

        await expect(labeler.removeLabels(mockIssue, ['label'])).rejects.toThrow('process.exit: 1')

        expect(core.setFailed).toHaveBeenCalledWith('Found [], while expected ["label"]')
        expect(mockClient.issueRemoveLabel).not.toHaveBeenCalled()
      })
    })
  })

  describe('addLabels', () => {
    it('adds labels to the issue', async () => {
      const labelId = 'label-id'
      mockTeam.labels.mockResolvedValue({ nodes: [{ id: labelId, name: 'label' }] } as any)

      await labeler.addLabels(mockIssue, ['label'])
      const expectedFilter = {
        filter: {
          or: [{ name: { eq: 'label' }, parent: {} }]
        }
      }

      expect(mockTeam.labels).toHaveBeenCalledWith(expectedFilter)
      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, labelId)
    })

    it('adds nested labels to the issue', async () => {
      const labelId = 'label-id'
      mockTeam.labels.mockResolvedValue({ nodes: [{ id: labelId, name: 'label' }] } as any)

      await labeler.addLabels(mockIssue, ['nested/label'])

      const expectedFilter = {
        filter: {
          or: [{ name: { eq: 'label' }, parent: { name: { eq: 'nested' }, parent: {} } }]
        }
      }

      expect(mockTeam.labels).toHaveBeenCalledWith(expectedFilter)
      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, labelId)
    })

    it('creates absent labels', async () => {
      mockTeam.labels.mockResolvedValueOnce({ nodes: [] } as any)

      const nestedIssueLabel = { id: 'new-nested-label-id' }
      const mockNestedLabelCreateResponse: jest.Mocked<LinearFetch<IssueLabelPayload>> = { issueLabel: nestedIssueLabel } as any

      const issueLabel = { id: 'new-label-id' }
      const mockLabelCreateResponse: jest.Mocked<LinearFetch<IssueLabelPayload>> = { issueLabel } as any

      mockClient.createIssueLabel.mockResolvedValueOnce(mockNestedLabelCreateResponse)
      mockClient.createIssueLabel.mockResolvedValueOnce(mockLabelCreateResponse)

      await labeler.addLabels(mockIssue, ['nested/label'])

      expect(mockClient.createIssueLabel).toHaveBeenCalledWith({
        teamId: mockTeam.id,
        name: 'nested'
      })

      expect(mockClient.createIssueLabel).toHaveBeenCalledWith({
        teamId: mockTeam.id,
        name: 'label',
        parentId: 'new-nested-label-id'
      })
      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, 'new-label-id')
    })

    it('fails when cannot create label', async () => {
      mockTeam.labels.mockResolvedValue({ nodes: [] } as any)

      const mockLabelCreateResponse: jest.Mocked<LinearFetch<IssueLabelPayload>> = { issueLabel: undefined } as any
      mockClient.createIssueLabel.mockResolvedValueOnce(mockLabelCreateResponse)

      await expect(labeler.addLabels(mockIssue, ['nested'])).rejects.toThrow('process.exit: 1')

      expect(core.setFailed).toHaveBeenCalledWith('Label nested was not created! Failing')
      expect(mockClient.issueAddLabel).not.toHaveBeenCalled()
    })

    it('handles complex flow with multiple labels', async () => {
      mockTeam.labels.mockResolvedValueOnce({ nodes: [{ id: 'bug-id', name: 'bug' }] } as any)
      mockTeam.labels.mockResolvedValueOnce({ nodes: [{ id: 'version-id', name: 'version' }] } as any)
      mockTeam.labels.mockResolvedValue({ nodes: [] } as any)

      const v2Label = { id: 'v2-id' }
      const mockV2CreateResponse: jest.Mocked<LinearFetch<IssueLabelPayload>> = { issueLabel: v2Label } as any

      const approvedLabel = { id: 'approved-id' }
      const mockApprovedCreateResponse: jest.Mocked<LinearFetch<IssueLabelPayload>> = { issueLabel: approvedLabel } as any

      mockClient.createIssueLabel.mockResolvedValueOnce(mockV2CreateResponse)
      mockClient.createIssueLabel.mockResolvedValueOnce(mockApprovedCreateResponse)

      await labeler.addLabels(mockIssue, ['version/v2.0.0', 'approved', 'bug'])

      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, 'bug-id')
      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, 'v2-id')
      expect(mockClient.issueAddLabel).toHaveBeenCalledWith(mockIssue.id, 'approved-id')
    })
  })
})