---
name: session-start
description: This skill should be used at the beginning of a conversation to load project context, check git status, and orient to the current state of work.
---

# Session Start

Begin by loading context and orienting to the current state of the project.

## Steps

1. **Read memory files** — Read all files referenced in the MEMORY.md index to load prior context about the user, project, and past decisions.

2. **Check git status** — Run `git status` and `git log --oneline -10` to understand:
   - What branch we're on
   - Any uncommitted changes or work in progress
   - Recent commit history

3. **Scan for open work** — Check for any TODO comments, draft branches, or partially completed features that may need attention.

4. **Summarize** — Present a brief session briefing:
   - Who: User context (from memory)
   - Where: Current branch and repo state
   - What: Any in-progress work or recent changes
   - Next: Suggest what to work on based on context, or ask the user what they'd like to focus on

Keep the briefing concise — no more than 10-15 lines. The goal is to get oriented quickly so we can start working.
