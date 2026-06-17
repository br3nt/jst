# JST Merge Session Log

Append-only collaboration log between **claude** (`jst-hardening`) and **codex**
(`codex-jst-roadmap`), merging both into `jst-integrated-roadmap`.

Protocol: see the agreed v2 ruleset. Turn baton is `agent_turn.json`. One commit
per turn. Wake condition: `turn == you` AND `git status --short` is empty. The
previous agent's handoff commit is always `HEAD` — review it with `git show HEAD`.

Branches (single repo `/Users/brent/Development/jst`):
- merge-base / integration root: `553ecb4` (= `main`)
- `jst-hardening`  @ `15668a7` (claude)
- `codex-jst-roadmap` @ `678a5eb` (codex)

---

## Turn 1 — claude — planning

### 1. Protocol
Agreed to v2 plus Codex's correction: `last_commit` dropped (a commit can't carry
its own hash); `HEAD` is the handoff commit. `agent_turn.json` keeps
`turn` / `phase` / `summary` only. Wake = `turn == you` AND clean tree.

### 2. Proposed subsystem ownership
Derived from both prior reviews (each of us verified the other's findings). Source
= which branch the implementation is taken from as the starting point; both still
get reviewed and fixed against the union test suite.

| Subsystem | Source | Why |
|---|---|---|
| Scanner: `input_reader.js`, `lexer.js`, `$ line` | **hardening** | token-aware (strings/templates/regex/comments; regex-vs-division and `<`-tag-vs-less-than via previous-token rule). Codex's lexer was unchanged from original. |
| Morph engine (`morphChildren`, keyed, `syncFormProperties`) | **codex base + hardening fixes** | Codex has more coverage (forms, transitions, SVG, nested keyed). But Codex had the straggler-removal bug (I found it); hardening had the mixed-keyed / uncontrolled-form / `.outside`-leak bugs (Codex found them). **Neither morph engine is fully correct** — assemble carefully, single owner per turn, union tests gate. |
| Dynamic slots (late projection) | **codex** | Codex projects late-added slot content (MutationObserver); hardening captured once on connect. |
| Precompile (in-core) | **codex** | Codex's `registerPrecompiledTemplate` + shared factory is architecturally better than hardening's innerHTML shim. Fix hardening's npm-pack/export gap on top. |
| Dev-mode error overlay | **codex** | Codex built an on-page overlay; hardening was console-only. |
| props model + reserved-name validation | either (≈identical); **fix** | Both use `props="..."`. Must reject reserved/helper names (`class`, `el`, `raw`) — hardening currently accepts them (fail-late). |
| event modifiers + `.outside` cleanup | **hardening base + fix** | `.prevent .stop .self .once .capture .passive`, key guards, `.debounce`, `.outside`. Fix the `.outside` document-listener leak after element removal (Codex found it). |
| SSR / hydration (`jst-ssr`) | **hardening** | Codex didn't add it. |
| Lifecycle: `onDisconnect`, `once(key, setup)` | **hardening** | |
| `JST.configure` knobs (dev/autoRegister/autoRegisterRoot/resolveTemplate) | reconcile (both have) | |
| HATEOAS service-worker demo | **hardening** | live wire-format demo. |
| Concerns lab (`concerns.html`) | **codex** | reviewer-facing design-check page. |
| CI (`.github/workflows`) + package/exports/CHANGELOG | **hardening** | real Chrome gate via `CHROME_PATH`. Extend to run precompile + tooling tests. |
| Docs (~10 pages) | **hardening base, reconcile** | fix the stale pages (`production-path`, `avoid-jst-when`, parity README still claim shipped features are absent). |

### 3. Proposed integration base
Start the integration tree from **Codex's runtime as the substrate** (richest,
hardest-to-port morph/precompile/slots/overlay), then layer in hardening's
well-isolated pieces (scanner, SSR, lifecycle, CI, demo, docs) and apply the
agreed morph fixes. Rationale: the scanner is two isolated files and easy to port
in; the runtime is deeply intertwined and painful to reconstruct piecemeal, so
keep the stronger runtime as the base and fix its known bugs. **Open to a
counter** — if you'd rather start from hardening and port Codex's runtime in,
say why.

### 4. Proposed integration order (one subsystem per turn, union-gated)
1. (done) bootstrap: worktree + coordination files + this plan.
2. codex: agree / tighten this plan.
3. seed union test suite (both adversarial matrices + each side's regression
   probes, incl. my keyed-straggler probe and Codex's mixed-keyed / `.outside` /
   uncontrolled-form probes) — so everything after is gated.
4. import chosen runtime substrate as the starting commit.
5. port scanner (`input_reader.js`/`lexer.js`/`$ line`) → verify scanner tests.
6. assemble morph engine: straggler-removal fix + mixed-keyed/unkeyed-sibling fix
   → verify both sides' morph probes.
7. forms morphing: controlled (template-declared) vs uncontrolled preservation
   → verify checkbox/radio/select/textarea probes.
8. precompile-in-core + fix export/npm-pack gap → verify precompile tests.
9. props reserved-name validation → verify.
10. event modifiers + `.outside` cleanup → verify removal probe.
11. SSR/hydration + lifecycle → verify.
12. dynamic slots (late projection) → verify.
13. dev overlay + `JST.configure` reconcile.
14. HATEOAS demo + concerns lab.
15. CI extended to run union incl. precompile/tooling.
16. docs reconcile (merge both sets, fix staleness).

### 5. Two design forks (need a decision; not deadlocks yet)
These are genuine product calls, not clear bugs. Stating my recommendation;
please give yours. If we disagree we escalate to human early (before the
morph/forms turns), so they don't block implementation.

- **`jst-model` semantics.** hardening = props-down/events-up (`el.emit`);
  codex = local two-way host-property update. My recommendation: **events-up**,
  because local two-way reintroduces hidden local state that JST's philosophy
  explicitly rejects. BUT hardening's *implementation* is broken regardless (it
  regex-rewrites raw template source, including inside `<pre>` — the exact
  anti-pattern the new scanner exists to avoid), so whichever semantics wins,
  the implementation must be reimplemented at the binding level, not by regex
  over source. This is the most likely human-escalation.
- **Equality / republish policy.** codex = assigning the same mutable reference
  republishes (`el.items.push(x); el.items = el.items`); hardening = primitive-only
  equality. I think this is **lower-stakes and likely reconcilable** without
  human input — propose we adopt Codex's same-ref-republish rule (more useful for
  the mutate-in-place pattern) while keeping `.prop` bindings skipping unchanged
  values to avoid fan-out. Tell me if you see a conflict.

### Handoff
Over to **codex** for planning. Agree or tighten ownership, base choice, order,
and give your read on the two forks.
