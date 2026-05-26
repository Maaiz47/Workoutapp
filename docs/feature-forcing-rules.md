# Feature forcing rules

Loaded from `CLAUDE.md`. Two non-negotiable rules every shipped slice
follows.

## Every shipped feature MUST have a `qa-state.json` item

This is a forcing rule, not a suggestion. Anything that adds user-visible
behaviour — a new page, a new button, a new API surface, a behaviour
change — needs a corresponding test item so a human can verify it.

Workflow each pass:
1. When you write a PATCHLOG entry, tag it inline with the qa-state
   item(s) it addresses: `(qa: workout-rest-timer)` (or comma-separated
   `(qa: foo, bar)` for entries that touch multiple items).
2. If the feature has no existing item, ADD a new one to `qa-state.json`
   with `id`, `title`, `area`, `introduced`, `status: "regression-retest"`,
   a populated `steps[]` array that walks through the new flow, and a
   `notes` line citing the commit.
3. Before pushing, run `npm run qa:scan`. The script reads PATCHLOG and
   qa-state.json and flags:
   - **Orphan tags** (a `(qa: …)` tag referencing an id that doesn't
     exist in qa-state.json) — hard error.
   - **Untagged sections** (recent PATCHLOG entries with no `(qa: …)`
     tag at all) — warning; pass `--strict` to make it an error too.
4. Resolve every orphan tag before pushing. If you legitimately can't,
   add the item.

## Every shipped user-facing feature MUST update the tutorial

Same forcing principle. The first-launch tutorial in `lib/tutorial.ts`
introduces new users to the app's surfaces. When a feature ships a new
surface or meaningfully changes one of the surfaces the tutorial
already covers, add or update the corresponding step. The shape is
data-driven — just edit the `TUTORIAL_STEPS` array.

Workflow each pass:
1. After deciding the slice, check `lib/tutorial.ts` — is the new
   surface already mentioned in a step? If not, add one with an id
   that won't collide, an icon emoji, a 1-3 sentence body, and an
   optional `where` tag telling the user where it lives.
2. If the change is large enough that existing users should see the
   tutorial again, bump `TUTORIAL_VERSION` (it's used to derive the
   localStorage key). Use sparingly — once or twice per major arc.
3. If a step is genuinely out of date because the feature was
   removed, edit the step. The tutorial is not append-only audit
   trail (unlike PATCHLOG); it's the live "how to use the app"
   intro and should reflect current reality.
4. If a slice legitimately doesn't change any user-facing surface
   (e.g. pure internal refactor, infra change), no step needed —
   just say so in the PATCHLOG entry so the next reviewer knows.
