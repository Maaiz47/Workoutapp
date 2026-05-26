#!/usr/bin/env python3
"""QA pass follow-up 2026-05-26 — 4 new comments after the big batch."""
import json
from datetime import datetime

TODAY = '2026-05-26'
TAG = f'[{TODAY}]'

state = json.load(open('qa-state.json'))
processed_doc = json.load(open('qa-processed.json'))
processed = processed_doc['processedIds']

items_by_id = {it['id']: it for it in state['items']}

def prepend_note(item, line):
    notes = item.get('notes', '') or ''
    if line.strip() in notes: return
    item['notes'] = line + ('\n\n' + notes if notes else '')

def flip(item_id, status, note):
    it = items_by_id.get(item_id)
    if not it:
        print(f"  ! missing {item_id}"); return
    it['status'] = status
    it['lastTested'] = TODAY
    prepend_note(it, f"{TAG} {note}")

def add_item(it):
    if it['id'] in items_by_id: return
    items_by_id[it['id']] = it
    state['items'].append(it)

def mark_processed(cid, summary):
    processed[cid] = {
        'ts': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'summary': summary,
    }

# New item: thread action UI for all own comments + per-thread summarised view
NEW_ITEMS = [
    {
        'id': 'qa-thread-action-on-any-own-comment',
        'title': '/qa thread: every own comment shows an UPDATE / RETEST action (not just processed ones)',
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26 follow-up',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open /qa, expand any item with multiple of your own comments — some processed, some not.",
            "Verify every one of your comments has a '💬 UPDATE / RETEST' (unprocessed) or '🔄 POST RETEST' (processed) button.",
            "Tap to expand. Verify the 3-chip status selector + textarea + SUBMIT.",
            "Submit on a non-processed comment — verify a child comment posts to the thread.",
        ],
        'notes': f"{TAG} Slice 1: gate dropped from `c.processed && c.tester === tester && !acked` to `c.tester === tester && !acked`. Label switches on processed flag. Source: @maaiz screenshot 2026-05-26 06:41 'Still can't continue these threads'.",
    },
    {
        'id': 'qa-thread-summarised-view',
        'title': '/qa item view: surface summarised original issue + patch status at top of thread',
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26 follow-up',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open /qa, expand any item with many comments + at least 1 patch.",
            "Verify the top of the thread shows: SUMMARISED ORIGINAL ISSUE (first failing comment, simplified) + PATCH STATUS chip (PATCHED / OPEN) + INLINE RETEST action.",
            "Below that, the full comment list (newest-first or scrolled-to-newest on open).",
        ],
        'notes': f"{TAG} Slice 1: just the qa-state placeholder + tracking. Render code lands next pass. Source: @maaiz bkb56h0t 'Can't see most recent comments added to this - want to see all comments before patch, when it should show the summarised original issue, whether patched and to retest if working now'.",
    },
    {
        'id': 'qa-thread-newest-at-bottom-autoscroll',
        'title': '/qa thread auto-scrolls to newest comment on item-card expand',
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26 follow-up',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open /qa, tap an item with 50+ comments to expand it (no ?focus= deep-link).",
            "Verify the thread auto-scrolls to the NEWEST comment at the bottom — chat convention.",
            "When opened via ?focus=item#comment-XYZ, verify it still scrolls to the specific comment (existing behaviour).",
        ],
        'notes': f"{TAG} Slice 1: placeholder. Implementation lands next pass — needs a scrollTo on item-card expand effect when no deep-link hash is present. Source: @maaiz bkb56h0t.",
    },
    {
        'id': 'qa-retest-flips-parent-status',
        'title': "When a tester marks their own comment 'WORKS NOW' the parent comment's status reflects it",
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26 follow-up',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open /qa on an item where you have an UNPROCESSED failing comment.",
            "Tap UPDATE / RETEST → WORKS NOW → SUBMIT.",
            "Verify the NEW comment posts as 'passing' AND the original failing comment's badge updates to PASSING (server-side patch).",
        ],
        'notes': f"{TAG} Slice 1: placeholder. Needs /api/qa/comment to optionally patch the parent comment's status when the retest is on the same itemId + same tester + originalCommentId hint. Source: @maaiz ipt9it59 'Marked this working but the original comment stays showing untested which isn't right'.",
    },
]
for it in NEW_ITEMS:
    add_item(it)

# Flips
# 76t264yp re:system-notifs-bottom-always — flip to regression-retest with strengthened fix note
flip('system-notifs-bottom-always', 'regression-retest',
     "Slice 2: strengthened the scroll-to-bottom — fires on rAF + 80ms + 240ms timeouts to defeat layout races (initial scroll might have raced with patchNotifs fetch / image loads). @maaiz 76t264yp 'still opens at the top from the read messages' likely tested an earlier deploy. Re-test after this push.")

# u2w4siyu re:lmz97l94 — passing /qa improvements
# But there's no specific item — flip qa-deep-link-to-comment + qa-patch-summary-user-friendly as proxies?
# Actually the lmz97l94 was about /qa improvements (sticky search, PATCHED · RETEST chip).
# The user has 1 passing + 2 failing on the same parent. Latest wins per processing rules:
# - latest failing (bkb56h0t) wins → tracks via new items added above.

# Mark all 4 processed.
mark_processed('cmplyuzv00004rrw976t264yp',
    "@maaiz: 'Opening system notifications chat log still opens at the top from the read messages'. Strengthened scroll-to-bottom: now fires on rAF + 80ms + 240ms timeouts to defeat layout races. (qa: system-notifs-bottom-always)")
mark_processed('cmplywiol0005rrw9u2w4siyu',
    "@maaiz retest re:lmz97l94 (passing): 'Verified working.' Sticky search + PATCHED·RETEST chip confirmed. Item /qa-improvements stays improved; new follow-up items added for 'summarised original issue + auto-scroll to newest' asks below. (qa: qa-thread-summarised-view)")
mark_processed('cmplyx7c50006rrw9ipt9it59',
    "@maaiz retest re:lmz97l94 (failing follow-up): 'I marked this working but the original comment stays showing untested which isn't right'. New item qa-retest-flips-parent-status — slice 1 placeholder; needs /api/qa/comment to optionally patch the parent comment's status on retest. (qa: qa-retest-flips-parent-status)")
mark_processed('cmplyyg4y0008am1jbkb56h0t',
    "@maaiz retest re:lmz97l94 (failing follow-up): 'Can't see most recent comments added to this - want to see all comments before patch, when it should show the summarised original issue, whether patched and to retest if working now'. Two new items: qa-thread-summarised-view (top-of-thread summary card) + qa-thread-newest-at-bottom-autoscroll (chat-convention scroll on expand). Also shipped this pass: qa-thread-action-on-any-own-comment — UPDATE / RETEST action now appears on EVERY own comment in the thread, not just processed ones. (qa: qa-thread-action-on-any-own-comment, qa-thread-summarised-view, qa-thread-newest-at-bottom-autoscroll)")

with open('qa-state.json', 'w') as f:
    json.dump(state, f, indent=2)
with open('qa-processed.json', 'w') as f:
    json.dump(processed_doc, f, indent=2)

print(f"items: {len(state['items'])}  processed: {len(processed)}")
