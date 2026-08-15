# Contributing

Thanks for looking. This is a small, single-purpose extension — issues and pull requests are welcome.

It follows the shared conventions at
**[Micheal-Friday/Contribution](https://github.com/Micheal-Friday/Contribution)**,
**pinned to [v1.0.0](https://github.com/Micheal-Friday/Contribution/releases/tag/v1.0.0)**.

**Adopted proportionately — four guides, not nine.** This is a 16 KB extension, not a product with a documentation tree, and importing rules nobody here will apply is how conventions get ignored.

| Area | Where |
|---|---|
| Branch names | [branch-naming](https://github.com/Micheal-Friday/Contribution/blob/v1.0.0/git/branch-naming.md) |
| Commit messages | [commit-messages](https://github.com/Micheal-Friday/Contribution/blob/v1.0.0/git/commit-messages.md) |
| Issues | [issues](https://github.com/Micheal-Friday/Contribution/blob/v1.0.0/github/issues.md) |
| Pull requests | [pull-requests](https://github.com/Micheal-Friday/Contribution/blob/v1.0.0/github/pull-requests.md) |

**Not adopted:** status updates, document lifecycle, decision records, reports, research. None of them has anything to govern here.

---

## This project's values

### Commit scopes

| Scope | What |
|---|---|
| `chrome` | the Chrome build — `chrome/` |
| `firefox` | the Firefox build — `firefox/` |

Each builds and ships independently (`npm run build:chrome`, `build:firefox`), which is what makes them scopes rather than folders. Omit the scope for `README.md`, `package.json`, or a change that touches both builds — and **most fixes do touch both**, since `content.js` and `styles.css` are near-duplicates across them.

### Commit types in use

`feat` · `fix` · `docs` · `chore`.

**The SemVer mapping is live here** — `fix:` → PATCH, `feat:` → MINOR, `!` → MAJOR. It governs three files that must move together:

- `package.json`
- `chrome/manifest.json`
- `firefox/manifest.json`

> ⚠️ **They are currently out of sync**: `chrome` 1.0.0, `firefox` 1.0.2, `package.json` 1.0.0. Firefox shipped patches the others did not follow. Whoever cuts the next release should decide the true current version and align all three — a version that differs per build makes bug reports unattributable, because "I'm on 1.0.0" stops identifying which code the reporter is running.

### Branch types in use

`feat/` · `fix/` · `docs/` · `chore/`.

### Labels

GitHub's defaults, uncurated. **This is the one repository here where `good first issue` and `help wanted` would do real work** — it is public, MIT-licensed, and small enough that an outside contributor could land a fix in an evening. Worth applying them the first time an issue qualifies, rather than pruning them as the private repositories should.

### Where work is recorded

GitHub issues. There is no decision record and no backlog; at this size the issue list is both.

---

## Before opening a pull request

- `npm run lint:firefox` passes.
- **Both builds load and work** — `chrome/` and `firefox/` carry near-duplicate `content.js` and `styles.css`, so a fix applied to one is almost always owed to the other. Say in the pull request whether you changed both, and if not, why.
- **Right-to-left behaviour is checked against real mixed content**: a Persian or Arabic paragraph beginning with a Latin word, an inline code span inside an RTL paragraph, and a fenced code block. Those are where the bidi handling actually breaks, and the existing fix history is entirely in that territory.

---

## What this project cannot honestly enforce

| Convention | Reality here |
|---|---|
| **Author ≠ reviewer** | One maintainer. The substitute is a self-review pass plus a cooling-off period. An outside pull request does get a real second pair of eyes, which is the one case where this convention actually holds |
| **Hold cross-cutting changes three business days** | Applies once there is a second reviewer |
| **"Yes, if" review norm** | Adoptable now — a way of writing feedback, not a headcount requirement |

---

## Prior art that is not the model

These conventions start on **2026-08-15**. The two existing commits predate them and are not being rewritten — a log edited to look tidy is worth less than one that is accurate.

**Cite this file for what to do next, never as a description of what the log already looks like.**
