# Linear Transition Action

[![GitHub Super-Linter](https://github.com/actions/typescript-action/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/actions/typescript-action/actions/workflows/ci.yml/badge.svg)
[![Check dist/](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml/badge.svg)](https://github.com/actions/typescript-action/actions/workflows/check-dist.yml)
[![Coverage](./badges/coverage.svg)](./badges/coverage.svg)

This action is quite simple. It allows you to transition your issue/set of issues to some state + assign/remove labels from them.

## Usage

```yaml
steps:
  - name: Checkout
    id: checkout
    uses: actions/checkout@v4

  - name: Transition to some state
    id: transition
    uses: actions/linear-transition-action@v1
    with:
      api_key: ${{ secrets.LINEAR_API_KEY }}
      team_key: 'ABC'
      transition_to: 'In Progress'
      transition_from: |-
        Backlog
        Todo
      issue_identifiers: |-
        ABC-137
      add_labels: |-
        api
      remove_labels: |-
        bug
```

## Development

After you changed files in `./src` folder run:

```bash
npm run all
```

> This step is important! It will run [`ncc`](https://github.com/vercel/ncc) to build the final JavaScript action code with all dependencies included. If you do not run this step,
> your action will not work correctly when it is used in a workflow. This step also includes the `--license` option for `ncc`, which will create a license file for all of the
> production node modules used in your project.

## Publishing a New Release

This project includes a helper script, [`script/release`](./script/release) designed to streamline the process of tagging and pushing new releases for GitHub Actions.

GitHub Actions allows users to select a specific version of the action to use, based on release tags. This script simplifies this process by performing the following steps:

1. **Retrieving the latest release tag:** The script starts by fetching the most recent release tag by looking at the local data available in your repository.
1. **Prompting for a new release tag:** The user is then prompted to enter a new release tag. To assist with this, the script displays the latest release tag and provides a regular
   expression to validate the format of the new tag.
1. **Tagging the new release:** Once a valid new tag is entered, the script tags the new release.
1. **Pushing the new tag to the remote:** Finally, the script pushes the new tag to the remote repository. From here, you will need to create a new release in GitHub and users can
   easily reference the new tag in their workflows.
