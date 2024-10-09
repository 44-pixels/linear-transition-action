import * as core from '@actions/core'
import { Inputs } from './runner'

export interface InputsGroup {
  [key: string]: Inputs
}

const INPUT_KEYS = {
  API_KEY: 'api_key',
  TEAM_KEY: 'team_key',
  TRANSITION_TO: 'transition_to',
  ISSUE_IDENTIFIERS: 'issue_identifiers',
  ADD_LABELS: 'add_labels',
  REMOVE_LABELS: 'remove_labels',
  TRANSITION_FROM: 'transition_from',
  FILTER_LABEL: 'filter_label'
}

// Github actions only support string, number and boolean types.
// For inputs that are not provided - it sets empty value (e.g. "" for string, not null or undefined)
// Arrays are oficially not supported, so, we assume that arrays are provided as a multiline yaml string (see .github/workflows/ci.yml for example)
// and we split them by eol character
export function parseInputs(): Inputs[] {
  // Required
  const apiKey = core.getInput(INPUT_KEYS.API_KEY)
  const teamKeys = core.getInput(INPUT_KEYS.TEAM_KEY).split(',').filter(Boolean)
  const transitionTo = core.getInput(INPUT_KEYS.TRANSITION_TO)

  // Not required
  const addLabels = core.getInput(INPUT_KEYS.ADD_LABELS).split('\n').filter(Boolean)
  const removeLabels = core.getInput(INPUT_KEYS.REMOVE_LABELS).split('\n').filter(Boolean)
  const transitionFrom = core.getInput(INPUT_KEYS.TRANSITION_FROM).split('\n').filter(Boolean)

  const filterLabel = core.getInput(INPUT_KEYS.FILTER_LABEL)
  const issueIdentifiers = core.getInput(INPUT_KEYS.ISSUE_IDENTIFIERS).split(',').filter(Boolean)

  return teamKeys.map(teamKey => {
    const issueNumbers = issueIdentifiers
      .filter(identifier => identifier.startsWith(`${teamKey}-`))
      .map(identifier => {
        return parseInt(identifier.replace(`${teamKey}-`, ''), 10)
      })

    return { apiKey, teamKey, transitionTo, issueNumbers, addLabels, removeLabels, transitionFrom, filterLabel }
  })
}
