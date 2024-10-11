import * as core from '@actions/core'
import { run } from '../src/main'
import { parseInputs } from '../src/utils'
import Runner from '../src/runner'

// Mock the dependencies
jest.mock('@actions/core')
jest.mock('../src/utils')
jest.mock('../src/runner')

describe('run', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should call parseInputs and Runner with correct parameters', async () => {
    const mockInputs = [{ apiKey: 'test-api-key' }]
    const mockRunnerInstance = { run: jest.fn() }

    // Mock implementations
    ;(parseInputs as jest.Mock).mockReturnValue(mockInputs)
    ;(Runner as jest.Mock).mockImplementation(() => mockRunnerInstance)

    await run()

    expect(parseInputs).toHaveBeenCalled()
    for (const input of mockInputs) {
      expect(Runner).toHaveBeenCalledWith(input.apiKey)
      expect(mockRunnerInstance.run).toHaveBeenCalledWith(input)
    }
  })

  it('should call core.setFailed when an error is thrown', async () => {
    const mockError = new Error('Test error')

    // Mock implementations
    ;(parseInputs as jest.Mock).mockImplementation(() => {
      throw mockError
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(`Action failed: ${mockError.message}`)
  })
})
