# IRONLOG — Roadmap

Captures what's genuinely still pending. Read alongside `PATCHLOG.md` (full history) and `README.md` (architecture).

---

## Deferred / Blocked

| Item | Blocked by |
|---|---|
| Swap rule-based plan generator → Claude API | Anthropic API credits (checkout unavailable as of May 2026) |
| DMARC DNS record for revtech.com.mv | Dhiraagu registrar portal access |

---

## Future Candidates

These are unscheduled ideas — not committed to, no detailed spec yet.

| Item | Notes |
|---|---|
| AI-powered plan generator | Replace rule-based generator with a Claude API call for truly personalised plans. Blocked on billing. |
| Exercise GIF demos | Full animated GIFs per exercise in the workout view. Currently using JPG start/end frames. Needs asset sourcing. |
| Username change | Allow users to change username (with cooldown). Currently set at registration only. |
| Display name | Separate display name from login username. `displayName String?` on `User`. |
| Plan auto-suggest supersets | Plan generator detects antagonist pairs (push/pull, quads/hamstrings) and marks them as supersets automatically for intermediate/advanced users. |
| Trainer approval flow | Admin approves trainer upgrade requests rather than self-serve. `roleRequest` field already on `User` schema. |
