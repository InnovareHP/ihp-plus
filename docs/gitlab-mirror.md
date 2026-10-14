# GitLab mirror — setup

GitHub (`InnovareHP/ihp-plus`) is the source of truth. `.github/workflows/mirror-to-gitlab.yml`
pushes every branch and tag to `gitlab.com/innovare-hp-group/ihp-mirror-test` on each push, and
removes a branch or tag from GitLab when it is deleted on GitHub.

**Never commit on the GitLab side.** The next sync overwrites it, or the push is rejected and the
mirror stops.

## Setup

1. **Create the GitLab project** → New project → Create blank project. Leave _Initialize
   repository with a README_ unchecked: the first mirror push is rejected if the project is not
   empty. Ignore GitLab's "push an existing repository" instructions — the workflow does it.
2. **Create an access token** → project Settings → Access Tokens. Role **Maintainer**, scope
   `write_repository`, with an expiry date. Maintainer is what lets it push to protected `main`.
3. **Store it on GitHub** → repo Settings → Secrets and variables → Actions → **Repository
   secret** named `GITLAB_TOKEN`. Not an organization secret: the token belongs to one project.
4. **Set the target** in the workflow's `GITLAB_REPO` as `gitlab.com/<group>/<project>.git` —
   a slash after the host, not the colon from GitLab's SSH clone URL, or git reads the group as
   a port.

## How it works

| Part                         | Purpose                                                |
| ---------------------------- | ------------------------------------------------------ |
| `push` trigger               | syncs new commits, branches, tags                      |
| `delete` trigger + `--prune` | a branch or tag deleted on GitHub is deleted on GitLab |
| `concurrency`                | one sync at a time, so runs never overlap              |
| `workflow_dispatch`          | manual **Run workflow** button in the Actions tab      |
| `fetch-depth: 0`             | full history, so every branch can be pushed            |

GitHub runs a `push` workflow from the branch that was pushed, but a `delete` workflow only from
the default branch — deletions are not mirrored until the workflow is on `main`.

## Verify

After a change to the workflow, check each path once:

- [ ] Push a commit → it appears on GitLab
- [ ] Push a new branch → it appears on GitLab
- [ ] Push a tag → it appears on GitLab
- [ ] Delete the branch and tag on GitHub → both disappear from GitLab
- [ ] GitHub → Actions shows the **Mirror to GitLab** runs green

## Access on GitLab

- Teammates get the **Reporter** role — read access to code, no push.
- Keep `main` protected; the Maintainer token still pushes to it.
- If a branch is ever force-pushed on GitHub, allow force push for the token on GitLab's
  protected branch, or that sync fails.

## Maintenance

- **Token expiry** stops the mirror with no warning beyond red Actions runs. Rotate it before
  the date: create a new token, replace `GITLAB_TOKEN`, then run the workflow manually.
- A failed run is safe to re-run from the Actions tab; the push is idempotent.
