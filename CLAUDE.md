# Instructions for Claude

## Before every push: check whether the branch's PR is already merged

The owner merges PRs quickly, often while follow-up work is still going on. Before **every** `git push`, look up the
pull request for the branch you are on (GitHub MCP `pull_request_read` with `method: get`, or `list_pull_requests`
filtered by the branch) and check `merged`.

- **Not merged (open):** push as usual.
- **Merged:** commits pushed to the old branch after the merge never reach `main` on their own. Do not force-push
  (it rewrites a published branch). Instead:
  1. `git fetch origin main` and merge it into the branch: `git merge origin/main`. Everything the PR merged is
     already in `main`, so the new PR's diff is only the unmerged work.
  2. If the fix is to a game already released at a version, bump its patch version (the game's `js/config.js`,
     its entry in `js/gamedata.js`, a `### Fixed` entry in `CHANGELOG.md`, its row in `status.md`).
  3. Push normally and open a **new** draft PR for the branch; the merged one cannot take new work.
- **Closed without merging:** ask the owner before pushing.

This happened once: a fix for game-127 was pushed to its branch a few minutes after PR #304 was merged, so it never
reached `main` and had to be moved to a new PR.
