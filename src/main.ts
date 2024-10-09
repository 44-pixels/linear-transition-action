import * as core from '@actions/core'

import { default as Runner, Inputs } from './runner'
import { parseInputs } from './utils'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const inputs: Inputs[] = parseInputs()

    const runners: Promise<void>[] = inputs.map(async input => {
      const runner = new Runner(input.apiKey)
      return runner.run(input)
    })

    await Promise.all(runners)

    core.info('Action completed successfully')
  } catch (error) {
    core.setFailed(`Action failed: ${error instanceof Error ? error.message : error}`)
  }
}
