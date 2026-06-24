# Releasing & merging

How changes land on `main` and how versions are cut. Two rules sit underneath all
of this:

- **Semi-linear history.** `main` reads as a mostly-straight line. Every branch is
  rebased onto the latest `main` before it merges, so there is no criss-cross.
- **Versions are tags on `main`. No release branches.** A release *is* an
  annotated `vX.Y.Z` tag on a `main` commit — never on a feature/PR branch, never
  a long-lived `release/*` branch.

## Branching & merge model

1. Branch off the latest `main` with a short-lived branch (`feat/…`, `fix/…`,
   `docs/…`). The branch name does **not** confer a version — the tag does.
2. Open a PR targeting `main`. Reference the issues it closes (`Closes #NN`).
3. Keep it **semi-linear**: before merging, rebase your branch onto the latest
   `main` and force-push:
   ```sh
   git fetch origin
   git rebase origin/main        # resolve conflicts here, on your branch
   git push --force-with-lease
   ```
   Do **not** merge `main` into your branch — that creates the criss-cross we
   avoid. Always rebase the branch onto `main` instead.
4. Merge once green. Either is fine because the branch was rebased first, so
   `main` stays semi-linear:
   - **Rebase and merge** — fast-forward, fully linear; or
   - **Merge commit** (`--no-ff`) — records the integration point on an otherwise
     straight `main`.
5. Delete the branch after merge.

## Versioning (SemVer, pre-1.0)

We are in `0.x`. Major stays `0`:

- **Breaking change** → bump the **minor** (`0.1.x` → `0.2.0`).
- **Feature or fix (backwards-compatible)** → bump the **patch** (`0.2.0` → `0.2.1`).

The version lives in **three** places that must stay in lockstep:

- `package.json` `version`,
- the `export const version` constant in `jst.js` (the runtime's in-page
  `JST.version` — a browser ES module can't read `package.json`, so this is a
  hand-kept copy), and
- the top entry in `CHANGELOG.md` (Keep a Changelog format, with an
  `old → new` migration table for breaking releases).

Bump all three **in the PR** that completes the release's work. A drift test
(`runtime_tests.mjs`) fails CI if `jst.js` and `package.json` disagree, so a
missed bump can't merge.

## Cutting a release

Releases are cut from `main` **after** the work has merged. Never tag a PR branch.

1. Merge the PR(s) for the release into `main`.
2. Update `main` locally and confirm the release state is correct there:
   ```sh
   git checkout main && git pull --ff-only
   ```
   - `package.json` `version` is the new `X.Y.Z`.
   - `CHANGELOG.md` has the matching `## X.Y.Z - <date>` entry.
3. Tag the `main` commit and push the tag:
   ```sh
   git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z
   ```
4. Create the GitHub release from that tag (notes from the CHANGELOG entry):
   ```sh
   gh release create vX.Y.Z --verify-tag --title "vX.Y.Z" --notes-file <(…CHANGELOG section…)
   ```

If you ever tag the wrong commit, delete it and re-tag from `main`:
```sh
gh release delete vX.Y.Z --yes --cleanup-tag   # removes the GitHub release + tag
```

## Checklist

- [ ] Branch off latest `main`; PR targets `main` with `Closes #NN`.
- [ ] `package.json` + `jst.js` `version` + `CHANGELOG.md` bumped in the PR (minor for breaking in 0.x, else patch).
- [ ] CI green (`npm test`).
- [ ] Branch rebased onto `main` (no merge-from-main commits); merged.
- [ ] On `main`: `vX.Y.Z` tag pushed, GitHub release created from the tag.
- [ ] No release branch created; no tag on a non-`main` commit.
