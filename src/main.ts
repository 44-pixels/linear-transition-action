import * as core from '@actions/core'

import Runner from './runner'
import { parseInputs } from './utils'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputs = parseInputs()
    const runner = new Runner(inputs.apiKey)
    await runner.run(inputs)
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : error}`)
  }
}
