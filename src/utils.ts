import * as core from '@actions/core'
import { Inputs } from './runner'

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
export function parseInputs(): Inputs {
  // Required
  const apiKey = core.getInput(INPUT_KEYS.API_KEY)
  const teamKey = core.getInput(INPUT_KEYS.TEAM_KEY)
  const transitionTo = core.getInput(INPUT_KEYS.TRANSITION_TO)

  // Not required
  const filterLabel = core.getInput(INPUT_KEYS.FILTER_LABEL)
  const issueNumbers = core
    .getInput(INPUT_KEYS.ISSUE_IDENTIFIERS)
    .split(',')
    .filter(Boolean)
    .map(identifier => parseInt(identifier.replace(`${teamKey}-`, ''), 10))

  const addLabels = core.getInput(INPUT_KEYS.ADD_LABELS).split('\n').filter(Boolean)
  const removeLabels = core.getInput(INPUT_KEYS.REMOVE_LABELS).split('\n').filter(Boolean)
  const transitionFrom = core.getInput(INPUT_KEYS.TRANSITION_FROM).split('\n').filter(Boolean)

  return { apiKey, teamKey, transitionTo, issueNumbers, addLabels, removeLabels, transitionFrom, filterLabel }
}
