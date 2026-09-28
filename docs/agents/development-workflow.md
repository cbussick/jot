# Development workflow

## Start a task

Treat `main` as the integration branch. Use a dedicated branch and worktree for each task, including documentation and configuration changes. Keep worktrees in this repository under `.worktrees/`; the primary checkout stays on `main`. Before starting, inspect `git status`, `git worktree list`, and the branch you intend to use. Preserve any pre-existing edits: if the primary checkout is dirty, leave those files alone and ask the user how to handle them if the task requires touching them. Update `main` from the remote with `git pull --ff-only` only when its checkout is clean. Never reset or stash another person's work to prepare a task.

From the primary checkout, create a short, task-specific branch from the current `main`:

```sh
git worktree add .worktrees/<task-name> -b <task-branch> main
```

For an existing task branch that is not already checked out, attach it with `git worktree add .worktrees/<task-name> <task-branch>` instead. Resume an existing worktree only for its own task. Do implementation, verification, commits, and PR work from that task's worktree. Keep unrelated work out of its commits.

## Deliver

Run the applicable checks from `package.json`, review the diff against the request, and commit the task's changes on its branch. Deliver changes to `main` through a reviewed pull request; do not commit, push, or locally merge directly to `main`. Include the purpose, verification results, and any remaining risks in the PR. Address review feedback on the same branch. Merge using GitHub's PR controls after required checks and reviews pass.

If the work is not merged yet, leave its branch and worktree intact for review or continuation, and tell the user where it lives. Do not call it cleaned up while it is still awaiting merge.

## Clean up after merge

Once the PR is merged, check that the task worktree contains no uncommitted changes. Preserve unexpected edits and ask before removing anything. Then, from the primary checkout:

```sh
git worktree remove .worktrees/<task-name>
git worktree prune
git branch -d <task-branch>
```

Delete the remote task branch if GitHub has not already deleted it. With a clean primary checkout, fast-forward `main` from the remote before starting the next task. Confirm `git worktree list`, `git branch`, and `git status` show no leftover task worktree, branch, or uncommitted task files. Never force-remove a worktree or force-delete an unmerged branch as routine cleanup.
