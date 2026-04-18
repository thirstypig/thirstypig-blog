# Hit List Phase 4 — Obsidian vault sync setup

One-time manual setup for the separate vault repo. After this, editing
`hitlist.md` in Obsidian on your phone and syncing via Obsidian Git auto-pushes
to the vault repo, which fires a `repository_dispatch` at this repo, which runs
`hitlist-sync.yml`, which converts markdown → YAML and commits to main, which
redeploys Vercel.

## Why a separate repo?

Direct Obsidian Git on the main repo is a non-starter: isomorphic-git crashes
on this repo's 1.6 GB `.git` directory. The vault repo stays tiny — just a few
KB of markdown — so mobile sync is instant.

## Step 1 — Create the vault repo

1. On GitHub, create a new **private** repo (suggested name: `thirstypig-hitlist-vault`).
2. Clone locally and add `hitlist.md` using the format in
   [`docs/hitlist-vault-template.md`](./hitlist-vault-template.md).
3. Push. The repo should contain just `hitlist.md` and (optionally) a README.

## Step 2 — Configure Obsidian on mobile

1. Install the **Obsidian Git** community plugin.
2. Open the vault repo as an Obsidian vault (clone via the plugin or Working Copy).
3. Enable auto-push on save. You're now editing `hitlist.md` on mobile with
   seconds-to-deploy turnaround.

## Step 3 — Create a fine-grained PAT for vault read access

Because the main repo needs to clone a private vault repo:

1. Go to GitHub → Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → **Generate new token**.
2. Resource owner: your account. Repository access: **Only select repositories**
   → pick the vault repo only.
3. Permissions → Repository permissions → **Contents: Read-only**. No other scopes.
4. Expiration: 90 days (set a reminder to rotate).
5. Copy the token — you won't see it again.

## Step 4 — Add secrets to this repo

In this repo's Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `VAULT_REPO` | `<owner>/<vault-repo-name>` e.g. `thirstypig/thirstypig-hitlist-vault` |
| `VAULT_READ_TOKEN` | the PAT from step 3 |

## Step 5 — Add the dispatcher workflow to the vault repo

In the **vault repo**, create `.github/workflows/trigger-hitlist-sync.yml`:

```yaml
name: Trigger hit list sync

on:
  push:
    branches: [main]
    paths: ["hitlist.md"]

jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Fire repository_dispatch at main repo
        env:
          # PAT with "Actions: Write" on the main repo
          DISPATCH_TOKEN: ${{ secrets.MAIN_REPO_DISPATCH_TOKEN }}
        run: |
          curl -X POST \
            -H "Accept: application/vnd.github+json" \
            -H "Authorization: Bearer $DISPATCH_TOKEN" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            https://api.github.com/repos/<main-owner>/<main-repo>/dispatches \
            -d '{"event_type":"hitlist-sync","client_payload":{"path":"hitlist.md"}}'
```

Then in the **vault repo** secrets, add `MAIN_REPO_DISPATCH_TOKEN` — a second
fine-grained PAT, this time with **Actions: Read and write** on the *main* repo
only.

## Step 6 — Test it

Edit `hitlist.md` in the vault repo (add or tweak an entry), commit, push.
Within ~30s you should see:

1. A green check on the vault repo's push.
2. A running workflow on the main repo (Actions tab → "Sync Hit List from vault").
3. A bot commit to main updating `src/data/places-hitlist.yaml`.
4. Vercel rebuild.

If something goes wrong, you can also trigger the sync manually: main repo →
Actions → "Sync Hit List from vault" → "Run workflow".

## Rolling back

If a bad markdown edit produces bad YAML, the validator step fails before the
commit, so main stays clean. Fix the vault markdown, push again, new run
succeeds.

If a committed YAML turns out to be undesirable, revert the bot commit on main
manually — the sync job won't fight you because it only commits when `git diff`
shows actual changes.

## Future simplifications

If you ever get tired of the two-PAT dance, one future option is to host the
vault inside a separate-but-shallow clone of this repo via `git worktree` — but
that needs more design. For now, two repos + two tokens is the simplest
working architecture given the 1.6 GB `.git` constraint.
