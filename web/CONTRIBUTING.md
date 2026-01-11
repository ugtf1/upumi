# Project Guidelines

## Branching Strategy

Checkout to a new branch after cloning using the convention: dev-'number assigned to you', e.g. dev-1.

## Merging and Pulling

Code merges occur on Fridays. Always 'pull' from 'staging' before continuing work post-merge.
Important: NEVER PUSH TO MAIN OR ANYONE ELSE'S BRANCH without mutual agreement (except for the staging branch, which should only be pulled from, never pushed to).

## Staging and Production Branches

Use a staging branch ('staging' branch) for integrating and testing collective work before merging into the main (production) branch.
The staging branch serves as the only link to production. All individual merge requests go into staging and move to the main only after successful testing.
Important: NEVER PUSH TO THE STAGING BRANCH DIRECTLY. Access the staging branch through pull requests alone.

## Pull Requests

Add all team members as reviewers for transparency.
Only the project lead(Engr. Majoroh) is authorized to approve merge requests.

## Commit Messages

### Follow the format

-v'RC'.'RC iteration'.'your change iteration': 'type': 'message'.

-v'RC': The current Release Cycle (e.g., v1, v2).

-.'RC iteration': The current iteration in your development cycle.

-.'your change iteration/commit': The number of changes or iterations you’ve made in that week.

-'type': The type of change (e.g., feat, fix, chore).

-'message': A brief description of the change.

### Types include

feat: a new feature is introduced with the changes.

fix: a bug fix has occurred.

chore: changes that do not relate to a fix or feature and don't modify src or test files (e.g., updating dependencies).

refactor: refactored code that neither fixes a bug nor adds a feature.

docs: updates to documentation such as the README or other markdown files.

style: changes that do not affect the meaning of the code, likely related to code formatting such as white-space, missing semi-colons, etc.

test: including new or correcting previous tests.

 perf: performance improvements.

ci: continuous integration related.

build: changes that affect the build system or external dependencies.

revert: reverts a previous commit.

### Versions follow a weekly iteration

Example formats:
V0.1.0: build: initialized project

V0.9.1: build, fix: implemented login page, auth bug fixed

V1.0.1: refactor: changed login flow

V2.6.22: test, style: testing auth flow, improved settings page styling

Ensure your commit version is in chronological order and aligned with the main or staging branch version.

### Versioning

Refer to your branch or staging branch for the current version.
Match your commit version to the ongoing week's version, e.g., if the main branch is at V0.1, your commits should follow V0.1.'your change iteration'.

## Help and Questions

If unclear about commit messaging formats, refer to the repository or ask questions.
Feel free to reach out at any time (including weekends) for clarification.

NB: Thank you for your cooperation. Please strictly follow these guidelines. Let's achieve great results together!
