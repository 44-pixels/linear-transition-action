/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */

import * as core from '@actions/core'
import { parseInputs } from '../src/utils'

jest.mock('@actions/core')

// Mocking Runner class
jest.mock('../src/runner', () => {
  return jest.fn().mockImplementation(() => {
    return { run: jest.fn() }
  })
})

const mockCore = core as jest.Mocked<typeof core>

describe('parseInputs', () => {
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
    jest.clearAllMocks()
  })

  it('should parse inputs correctly', () => {
    // Prettier and eslint are conflicting here
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'api_key':
          return 'test_api_key'
        case 'team_key':
          return 'team'
        case 'transition_to':
          return 'test_transition_to'
        case 'issue_identifiers':
          return 'team-1,team-2,team-3'
        case 'add_labels':
          return 'label1\nlabel2'
        case 'remove_labels':
          return 'label3\nlabel4'
        case 'transition_from':
          return 'from1\nfrom2'
        case 'filter_label':
          return 'label_substring'
        default:
          return ''
      }
    })

    const inputs = parseInputs()

    expect(inputs).toEqual([
      {
        apiKey: 'test_api_key',
        teamKey: 'team',
        transitionTo: 'test_transition_to',
        issueNumbers: [1, 2, 3],
        addLabels: ['label1', 'label2'],
        removeLabels: ['label3', 'label4'],
        transitionFrom: ['from1', 'from2'],
        filterLabel: 'label_substring'
      }
    ])
  })

  it('should handle omitted non-required values', () => {
    // Prettier and eslint are conflicting here
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'api_key':
          return 'test_api_key'
        case 'team_key':
          return 'team'
        case 'transition_to':
          return 'test_transition_to'
        case 'issue_identifiers':
          return 'team-1'
        default:
          return ''
      }
    })

    const inputs = parseInputs()

    expect(inputs).toEqual([
      {
        apiKey: 'test_api_key',
        teamKey: 'team',
        transitionTo: 'test_transition_to',
        issueNumbers: [1],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: ''
      }
    ])
  })

  it('fails if neither issue numbers nor filter label provided', () => {
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'api_key':
          return 'test_api_key'
        case 'team_key':
          return 'team'
        case 'transition_to':
          return 'test_transition_to'
        default:
          return ''
      }
    })

    expect(parseInputs).toThrow('process.exit: 1')
    expect(mockCore.setFailed).toHaveBeenCalledWith('Neither issue numbers nor filter label provided.')
    expect(process.exit).toHaveBeenCalledWith(1)
  })

  it('passes blank issue numbers if filter label set and issue identifiers are not', () => {
    // Prettier and eslint are conflicting here
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'api_key':
          return 'test_api_key'
        case 'team_key':
          return 'team1,team2,team3'
        case 'transition_to':
          return 'test_transition_to'
        case 'filter_label':
          return 'label_substring'
        default:
          return ''
      }
    })

    const inputs = parseInputs()

    expect(inputs).toEqual([
      {
        apiKey: 'test_api_key',
        teamKey: 'team1',
        transitionTo: 'test_transition_to',
        issueNumbers: [],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: 'label_substring'
      },
      {
        apiKey: 'test_api_key',
        teamKey: 'team2',
        transitionTo: 'test_transition_to',
        issueNumbers: [],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: 'label_substring'
      },
      {
        apiKey: 'test_api_key',
        teamKey: 'team3',
        transitionTo: 'test_transition_to',
        issueNumbers: [],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: 'label_substring'
      }
    ])
  })

  it('filters out inputs where no issues numbers found if issue identifiers provided', () => {
    // Prettier and eslint are conflicting here
    // eslint-disable-next-line no-extra-semi
    ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'api_key':
          return 'test_api_key'
        case 'team_key':
          return 'team1,team2,team3'
        case 'transition_to':
          return 'test_transition_to'
        case 'issue_identifiers':
          return 'team1-1,team2-2,team1-3'
        default:
          return ''
      }
    })

    const inputs = parseInputs()

    expect(inputs).toEqual([
      {
        apiKey: 'test_api_key',
        teamKey: 'team1',
        transitionTo: 'test_transition_to',
        issueNumbers: [1, 3],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: ''
      },
      {
        apiKey: 'test_api_key',
        teamKey: 'team2',
        transitionTo: 'test_transition_to',
        issueNumbers: [2],
        addLabels: [],
        removeLabels: [],
        transitionFrom: [],
        filterLabel: ''
      }
    ])
  })

  describe('with multiple teamkeys', () => {
    beforeEach(() => {
      // Prettier and eslint are conflicting here
      // eslint-disable-next-line no-extra-semi
      ;(core.getInput as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'api_key':
            return 'test_api_key'
          case 'team_key':
            return 'team,team2,team3'
          case 'transition_to':
            return 'test_transition_to'
          case 'issue_identifiers':
            return 'team-1,team-2,team-3,team2-1,team2-12,team2-13,team3-1,team3-12,team3-23,FAKE-1'
          case 'add_labels':
            return 'label1\nlabel2'
          case 'remove_labels':
            return 'label3\nlabel4'
          case 'transition_from':
            return 'from1\nfrom2'
          case 'filter_label':
            return 'label_substring'
          default:
            return ''
        }
      })
    })

    it('splits issues betweeen corresponding teams and ignore unassosiated issues', () => {
      const inputs = parseInputs()

      expect(inputs).toEqual([
        {
          apiKey: 'test_api_key',
          teamKey: 'team',
          transitionTo: 'test_transition_to',
          issueNumbers: [1, 2, 3],
          addLabels: ['label1', 'label2'],
          removeLabels: ['label3', 'label4'],
          transitionFrom: ['from1', 'from2'],
          filterLabel: 'label_substring'
        },
        {
          apiKey: 'test_api_key',
          teamKey: 'team2',
          transitionTo: 'test_transition_to',
          issueNumbers: [1, 12, 13],
          addLabels: ['label1', 'label2'],
          removeLabels: ['label3', 'label4'],
          transitionFrom: ['from1', 'from2'],
          filterLabel: 'label_substring'
        },
        {
          apiKey: 'test_api_key',
          teamKey: 'team3',
          transitionTo: 'test_transition_to',
          issueNumbers: [1, 12, 23],
          addLabels: ['label1', 'label2'],
          removeLabels: ['label3', 'label4'],
          transitionFrom: ['from1', 'from2'],
          filterLabel: 'label_substring'
        }
      ])
    })
  })
})
