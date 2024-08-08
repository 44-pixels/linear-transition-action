import * as core from '@actions/core'
import { Issue, IssueLabel, IssuePayload, LinearClient, Team } from '@linear/sdk'
import { IssueLabelCreateInput, IssueLabelFilter } from '@linear/sdk/dist/_generated_documents'

interface Labels {
  [key: string]: IssueLabel
}

export default class Labeler {
  client: LinearClient
  team: Team

  constructor(client: LinearClient, team: Team) {
    this.client = client
    this.team = team
  }

  // Add labels to the issue
  // If labels does not exist - creates them in a scope of a team
  //
  // Accepts grouped labels in a format "version/v0.0.1"
  async addLabels(issue: Issue, labelNames: string[]): Promise<IssuePayload[]> {
    const labels = await this.findOrCreateLabels(labelNames)

    return await Promise.all(labels.map(async label => await this.client.issueAddLabel(issue.id, label.id)))
  }

  // Removes labels from issue. Does not delete label from Linear
  //
  // Accepts grouped labels in a format "version/v0.0.1"
  async removeLabels(issue: Issue, labelNames: string[]): Promise<void> {
    const labels = await this.findLabels(labelNames)
    const foundLabels = Object.keys(labels)

    if (foundLabels.length !== labelNames.length) {
      core.setFailed(`Found ${JSON.stringify(foundLabels)}, while expected ${JSON.stringify(labelNames)}`)
      process.exit(1)
    }

    await Promise.all(
      Object.values(labels).map(label => {
        this.client.issueRemoveLabel(issue.id, label.id)
      })
    )
  }

  // Find everything that's possible and tries to create the rest.
  private async findOrCreateLabels(labelNames: string[]): Promise<IssueLabel[]> {
    const foundLabels = await this.findLabels(labelNames)

    const notFoundLabelNames = labelNames.filter(name => !foundLabels[name])

    const newLabels = await this.createLabels(notFoundLabelNames)

    return [...Object.values(foundLabels), ...Object.values(newLabels)]
  }

  private async createLabels(labelNames: string[]): Promise<Labels> {
    const labels: Labels = {}

    await Promise.all(
      labelNames.map(async name => {
        const label = await this.createLabel(name)
        core.info(`Label "${name}" was created.`)
        labels[name] = label
      })
    )

    return labels
  }

  // Linear supports nested labels, it's useful for example for versions.
  // However, the way to create them is to pass parentId to each label.
  // So, we have to create each nested label 1 by 1 starting from the root one.
  // This method does it recursively.
  //
  private async createLabel(name: string, parentId?: string): Promise<IssueLabel> {
    const [head, ...tail] = name.split('/')

    let label = await this.findLabel(head, parentId)
    if (!label) {
      const params: IssueLabelCreateInput = {
        teamId: this.team.id,
        name: head
      }

      if (parentId) {
        params.parentId = parentId
      }

      const labelResponse = await this.client.createIssueLabel(params)

      const issueLabel = await labelResponse?.issueLabel

      if (issueLabel?.id) {
        label = issueLabel
      }
    }

    if (!label) {
      core.setFailed(`Label ${name} was not created! Failing`)
      process.exit(1)
    }

    if (tail.length > 0) {
      return await this.createLabel(tail.join('/'), label.id)
    } else {
      return label
    }
  }

  // It fetches all labels that it can find and creates a map of key (might be nested, that's why) and label entity.
  private async findLabels(labelNames: string[]): Promise<Labels> {
    const labels = await this.fetchLabels(labelNames)

    return labelNames.reduce<Labels>((memo, name) => {
      const topName = name.split('/').at(-1)
      const label = labels.find(_ => _.name === topName)

      if (label) {
        memo[name] = label
      }

      return memo
    }, {})
  }

  // This method searches for label by NOT NESTED name and it's parentId
  // I decided not to go with generic nested implementation with nested name support, etc.
  // because I don't need it for my purposes. Sorry, feature me
  private async findLabel(name: string, parentId?: string): Promise<IssueLabel | undefined> {
    const filter: IssueLabelFilter = {
      name: {
        eq: name
      }
    }

    if (parentId) {
      filter.parent = { id: { eq: parentId } }
    }

    const labels = await this.team.labels({ filter })

    return labels?.nodes?.at(0)
  }

  // This method gets an array of label names e.g. ['approved', 'version/v0.0.1']
  // and fetches them all.
  //
  private async fetchLabels(labels: string[]): Promise<IssueLabel[]> {
    const filter: IssueLabelFilter = {}
    filter.or = labels.map<IssueLabelFilter>(label => this.buildFilterByName(label))

    return (await this.team.labels({ filter })).nodes
  }

  // Instead of being able to pass nested labels as it is (e.g. 'version/v0.0.1'),
  // we have to pass parentId to each label.
  //
  // So, for example for label 'test/fest/v0.0.1' we have to provide such filter
  //
  // {
  //   name: {
  //     eq: "v0.0.1"
  //   },
  //   parent: {
  //     name: {
  //       eq: "fest",
  //     },
  //     parent: {
  //       name: {
  //         eq: "test"
  //       },
  //       parent: {}
  //     }
  //   }
  // }
  //
  private buildFilterByName(name: string): IssueLabelFilter {
    const filter = {}

    name
      .split('/')
      .reverse()
      .reduce<IssueLabelFilter>((memo, label) => {
        memo.name = { eq: label }
        memo.parent = {}
        return memo.parent
      }, filter)

    return filter
  }
}
