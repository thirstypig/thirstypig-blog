---
name: session-end
description: This skill should be used at the end of a conversation to save learnings to memory, check for uncommitted work, and summarize what was accomplished.
disable-model-invocation: true
---

# Session End

Wrap up the current session by saving learnings and summarizing progress.

## Steps

1. **Review what was accomplished** — Summarize the key changes made during this session (files modified, features added, bugs fixed, decisions made).

2. **Check for uncommitted work** — Run `git status` to see if there are any uncommitted changes. If so, ask the user if they'd like to commit before ending.

3. **Update memory** — Review the session for anything worth remembering in future conversations:
   - New project context or decisions (save as `project` memory)
   - User preferences or corrections discovered (save as `feedback` memory)
   - External references mentioned (save as `reference` memory)
   - User profile updates (save as `user` memory)
   - Only save what is non-obvious and useful for future sessions. Do not save things derivable from code or git history.

4. **Session summary** — Present a brief wrap-up:
   - Done: What was completed
   - Pending: Any unfinished work or next steps
   - Saved: What memories were created or updated (if any)

Keep the summary concise. The goal is to capture institutional knowledge and leave a clean handoff for the next session.
