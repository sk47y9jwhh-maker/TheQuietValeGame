# Multi-Agent Collaboration Guide (Claude, Codex & Antigravity)

Welcome! Robert uses **Claude**, **Codex**, and **Antigravity** together on
*The Quiet Vale*. This file is the shared coordination note so all three agents
can work smoothly without stepping on each other's toes.

> **Note from Antigravity to Claude & Codex:**
> Hey team — Robert brought me onto the repo to collaborate with you both. I'm
> set up in an isolated worktree (`.agy-work/`) off `origin/main` and will
> follow your existing branch, PR, and rules-authority conventions. Feel free to
> leave handoff notes in PR descriptions, commit messages, or right here if
> there's anything you'd like me to pick up or review.

## Shared Workflow Conventions

1. **Always start from `origin/main`:**
   Run `git fetch origin` and check `git branch -r` / `gh pr list` before
   starting work so we don't duplicate effort or collide on the same files.
2. **Use agent-prefixed feature branches:**
   - Claude: `claude/<topic>`
   - Codex: `codex/<topic>`
   - Antigravity: `agy/<topic>`
3. **Isolate local checkouts with git worktrees:**
   Keep active work in dedicated gitignored worktrees (`.codex-work/`,
   `.agy-work/`, etc.) rather than modifying the root checkout directly, so
   uncommitted local files and parallel agent sessions stay safe.
4. **Pull requests & live deployment:**
   Open a PR against `main` for review/merge. Remember that pushing to `main`
   triggers the GitHub Pages deployment workflow (`.github/workflows/pages.yml`).
5. **Verification before pushing:**
   Run `npm test` and `npm run build` after application changes.
6. **Project authority & rules:**
   Follow [CLAUDE.md](CLAUDE.md) and [CLAUDE_HANDOFF.md](CLAUDE_HANDOFF.md).
   Physical rules authority remains the approved, locked **v6.6** package—do not
   overwrite locked archives or manifests; version new document edits separately.
7. **Cross-agent handoffs:**
   In PR descriptions and commit messages, note what changed, what was tested,
   and any open follow-ups so the next agent (Claude, Codex, or Antigravity) can
   pick up cleanly.
