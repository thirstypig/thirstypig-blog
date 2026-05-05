// Shared GitHub Contents API helpers used by HitListManager + BucketListManager.
// Extracted so fixes (401/403/409 handling, sanitization, etc.) live in one place
// instead of being duplicated across each TinaCMS admin screen.

// ── Encoding helpers (UTF-8 safe round trip) ──────────────────────
//
// `atob`/`btoa` only handle Latin-1. Multi-byte characters (é, í, 川 …) get
// corrupted on every round-trip without explicit UTF-8 encoding.

export function base64ToUtf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

// ── Typed errors so callers can disambiguate failure modes ────────

export class TokenRejectedError extends Error {
  constructor(public status: number) {
    super(`GitHub rejected the token (${status}). It may have expired or lack the required scope.`);
    this.name = "TokenRejectedError";
  }
}

export class ShaConflictError extends Error {
  constructor() {
    super("Concurrent edit conflict. Reload to fetch the latest sha and retry.");
    this.name = "ShaConflictError";
  }
}

// ── Commit-message sanitization ───────────────────────────────────
//
// Titles can contain control chars or be excessively long. Strip newlines
// and tabs (which would inject fake commit-message lines / co-author trailers
// if user input ever became untrusted) and cap length so the first line of
// a commit message stays readable in `git log --oneline`.

export function safeForCommitMessage(s: string, maxLen = 80): string {
  return s.replace(/[\r\n\t]+/g, " ").trim().slice(0, maxLen);
}

// ── GitHub Contents API wrappers ──────────────────────────────────

export interface GithubContentsRead {
  content: string;
  sha: string;
}

export async function githubGet(
  token: string,
  owner: string,
  repo: string,
  path: string
): Promise<GithubContentsRead> {
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" } }
  );
  if (resp.status === 401 || resp.status === 403) throw new TokenRejectedError(resp.status);
  if (!resp.ok) throw new Error(`GitHub GET failed: ${resp.status} ${resp.statusText}`);
  const data = await resp.json();
  return { content: base64ToUtf8(data.content), sha: data.sha as string };
}

export async function githubPut(
  token: string,
  owner: string,
  repo: string,
  path: string,
  newContent: string,
  sha: string,
  message: string,
  branch: string = "main"
): Promise<string /* new sha */> {
  const b64 = utf8ToBase64(newContent);
  const resp = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: b64, sha, branch }),
    }
  );
  if (resp.status === 401 || resp.status === 403) throw new TokenRejectedError(resp.status);
  if (resp.status === 409) throw new ShaConflictError();
  if (!resp.ok) throw new Error(`GitHub PUT failed: ${resp.status} ${resp.statusText}`);
  const result = await resp.json();
  return result.content.sha as string;
}
