# Git & Terminal Execution Guidelines for Sena

## 1. Sandbox Awareness & Prefix Matching
Antigravity executes shell commands inside a restricted sandbox by default.
- Write operations to `.git/` (like `git add`, `git commit`) and network operations (`git push`, `gh`) require bypassing the sandbox (`BypassSandbox: true`).
- To allow seamless execution without repeated UI permission popups, **always use standardized, prefix-matchable command shapes**:
  - `git status`
  - `git diff`
  - `git add <files>`
  - `git commit -m "<message>"`
  - `git push origin <branch>`
  - `gh pr <subcommand>`
- **NEVER** wrap Git commands in subshells (`zsh -c "git ..."`) or complex bash string interpolations, as this prevents IDE permission prefix-matching.

## 2. Terminal Fallback
If an IDE sandbox permission prompt does not surface or is delayed:
- Provide the exact, isolated shell commands for the developer to run directly in their native Mac Terminal.
- Never loop or poll repeatedly on stuck background tasks.

## 3. Branching Standard
- Every feature or bugfix must be developed on an isolated branch (`feat/<name>` or `fix/<name>`).
- Direct commits to `main` are restricted.
- Deployments to production occur automatically via Vercel when an approved PR is merged to `main`.
