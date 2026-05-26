#!/usr/bin/env python3
"""One-shot QA pass script for 2026-05-26. Updates qa-state.json + qa-processed.json.
Reads each unprocessed comment, applies status flips / adds new items / marks comments
processed. Idempotent: re-running re-applies but won't duplicate notes since notes are
prepended only when this script's tag is absent."""
import json, os, sys
from datetime import datetime

TODAY = '2026-05-26'
TAG = f'[{TODAY}]'

state = json.load(open('qa-state.json'))
processed_doc = json.load(open('qa-processed.json'))
processed = processed_doc['processedIds']

items_by_id = {it['id']: it for it in state['items']}

def prepend_note(item, line):
    """Prepend a note to item['notes'] if EXACT line is not already present."""
    notes = item.get('notes', '') or ''
    if line.strip() in notes:
        return
    item['notes'] = line + ('\n\n' + notes if notes else '')

def flip(item_id, status, note):
    it = items_by_id.get(item_id)
    if not it:
        print(f"  ! missing item {item_id}")
        return
    it['status'] = status
    it['lastTested'] = TODAY
    prepend_note(it, f"{TAG} {note}")

def add_item(it):
    if it['id'] in items_by_id:
        # Already exists — leave alone; flips will add notes.
        return
    items_by_id[it['id']] = it
    state['items'].append(it)

def mark_processed(cid, summary):
    processed[cid] = {
        'ts': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'summary': summary,
    }

# ---------------------------------------------------------------------------
# A. STATUS FLIPS — 19 verified-passing retests
# ---------------------------------------------------------------------------
PASSING_FLIPS = [
    # (cid, qa-item-id, brief)
    ('cmpjpadcl000310ajkp0uemr0', 'qa-duplicate-detection',
     "@maaiz retest re:nwsiwhfd: 'Working now because it's not coming back to your patches to retest'. Marking passing."),
    ('cmpjpbr5g0000l2jwcou89iw0', 'qa-duplicate-detection',
     "@maaiz retest re:f2fbk10f: 'Works in search so fine'. Passing."),
    ('cmpjpc70d0001l2jw58d8zn3a', 'messages-pull-to-refresh',
     "@maaiz retest re:mx48ewue: 'Looks to be working'. Passing."),
    ('cmpjped1y0000pz9apq49p256', 'system-notifs-scroll-bottom',
     "@maaiz retest re:3zo6s1l4: 'Think it's working to read notifications yes'. Passing."),
    ('cmpjpex7u000010oon7fxvv1k', 'qa-duplicate-detection',
     "@maaiz retest re:baqpgds6: 'Think you get the idea'. Passing."),
    ('cmpjpfce5000110oo99alepti', 'workout-rest-skipped-counter',
     "@maaiz retest re:cgvit4ib: 'Seems like timer in button working'. Passing."),
    ('cmpjpfrdo0000hgni9lif7xbl', 'qa-patch-summary-user-friendly',
     "@maaiz retest re:679gbxri: 'Looks to be working'. Passing."),
    ('cmpjphme60000141hc1lqvsf6', 'workout-rest-too-fast-warning',
     "@maaiz retest re:xsaj88a0: 'Verified working'. Passing."),
    ('cmpjpipgy0003hgnisiku5yje', 'qa-patch-notif-clickzone',
     "@maaiz retest re:71zoxcpv: 'Verified working'. Passing."),
    ('cmpjpit850004hgnin0ufidpw', 'home-messages-unread-count',
     "@maaiz retest re:w3oedkls: 'Verified working'. Passing."),
    ('cmpjpopxe0002102jnkf46ywg', 'pro-tip-overlay-zindex',
     "@maaiz retest re:pj8scp8z: 'Verified working'. (Note: a later ATTEND in this batch says 'I have this too' — see notes; flagged for re-investigation but latest retest before that was passing.)"),
    ('cmpjt8cpv0000oim2vtgruxxh', 'system-notifications-feed',
     "@maaiz retest re:8ldwlv25: 'Verified working'. Passing."),
    ('cmpjt8mb60000cbzxz49tamt5', 'qa-patch-notification',
     "@maaiz retest re:69besur6: 'Verified working'. Passing."),
    ('cmpjt8w3n0001cbzxyac9ec3s', 'qa-patch-notification',
     "@maaiz retest re:45e2jgzv: 'Disregard'. Passing."),
    ('cmpjtbtib0001n4dugx2wa66i', 'tier-modal-sticky-close',
     "@maaiz retest re:fwqbb4ah: 'Verified working'. Passing."),
    ('cmpjtc02z0002n4dut98pwk7b', 'workout-in-session-exercise-add',
     "@maaiz retest re:iah11umr: 'Verified working'. Passing."),
    ('cmpjtc60w00001eafskzbr3qj', 'home-hub-singleline',
     "@maaiz retest re:2kuu4jho: 'Verified working'. Passing."),
    ('cmpjwafa200022aqa96wc4kfp', 'profile-avatars',
     "@maaiz attend re:zxy2uw7c (ALSO PASSES): 'Now works'. Passing."),
]
for cid, iid, brief in PASSING_FLIPS:
    flip(iid, 'passing', f"Passing: {brief.split(':',1)[1].strip() if ':' in brief else brief}")
    mark_processed(cid, brief + " (qa: " + iid + ")")

# Special: t6l0oran ALSO PASSES — but that item is brand new in this batch
# We'll handle it after creating the trainer-rank-page item.

# Special: pro-tip-overlay-zindex regression — f9zc2vln (later) says I HAVE THIS TOO
# Override to regression-retest with audit-trail note
flip('pro-tip-overlay-zindex', 'regression-retest',
     "Regression-retest: @maaiz ATTEND re:pj8scp8z (later, 19:38Z) says 'I have this too' — earlier same-day retest was 'verified working'. Likely a different overlay/scenario triggers it. Needs another investigation pass.")
mark_processed('cmpk6jlnd0000jctof9zc2vln',
    "@maaiz attend re:pj8scp8z (I HAVE THIS TOO): no extra notes. Bumped pro-tip-overlay-zindex back to regression-retest for re-investigation. (qa: pro-tip-overlay-zindex)")

# ---------------------------------------------------------------------------
# B. RETESTS THAT FED EXISTING ITEMS NEW SIGNAL — flip back to regression-retest with extra notes
# ---------------------------------------------------------------------------
RETEST_CONTEXT = [
    ('cmpjkjzp70000xmm8nemv84vb', 'qa-retest-list-persistence-fix', 'regression-retest',
     "@maaiz retest re:sq9jzsv7: 'Testing if working'. Test ping — keep watching.",
     "@maaiz: 'Testing if working' (qa: qa-retest-list-persistence-fix)"),
    ('cmpjp4w9m0000829xuu5meg6i', 'qa-pending-retests-list', 'regression-retest',
     "@maaiz: 'Can't read the full user feedback from your patches to retest because it's not all shown'. Slice 1: expanded row now shows full untruncated YOU SAID + FIX (was hard 90-char cap). (qa: qa-pending-retests-list)",
     "@maaiz retest re:pf5y98hv: full text not shown in retest list. Expand row to show full note. (qa: qa-pending-retests-list)"),
    ('cmpjp59dl00006wove3aemb5o', 'qa-retest-list-priority-sort', 'regression-retest',
     "@maaiz: 'Change this to low priority it says med' for x7l8846w (image gen). Need a way to set priority from /qa dashboard — added inline priority bumper to admin /qa controls per item. (qa: qa-retest-list-priority-sort)",
     "@maaiz retest re:x7l8846w: 'Change this to low priority it says med'. (qa: qa-retest-list-priority-sort)"),
    ('cmpjp5oz300016wov1of8erxe', 'qa-duplicate-detection', 'regression-retest',
     "@maaiz: 'Just mentioned this so this is a duplicate comment can be merged'. Same theme as 5r37adac/6y0hdjgm/3xtilzm7 — fold under a single duplicate-merge item. (qa: qa-duplicate-detection)",
     "@maaiz retest re:sv8cyzny: duplicate of x7l8846w priority issue. Merge. (qa: qa-duplicate-detection)"),
    ('cmpjp64re00026wovopxo61bb', 'qa-pending-retests-list', 'regression-retest',
     "@maaiz: 'Don't know what this means and can't read all of it' (re:yczbq7i7). Show original tester note alongside summary so context is preserved when summary is cryptic. (qa: qa-pending-retests-list)",
     "@maaiz retest re:yczbq7i7: can't read all of it. (qa: qa-pending-retests-list)"),
    ('cmpjp6xft0000orl95r37adac', 'qa-duplicate-detection', 'regression-retest',
     "@maaiz: 'Catching duplicate reports of same issue which this is, merge these'. Auto-merge proposal: when posting a new comment ≥80% Jaccard to an open thread, prompt user to ATTEND the existing thread instead. (qa: qa-duplicate-detection)",
     "@maaiz retest re:q3j0h7z4: duplicate detection should auto-merge. (qa: qa-duplicate-detection)"),
    ('cmpjp9qkq000210aj6y0hdjgm', 'qa-duplicate-detection', 'regression-retest',
     "@maaiz: 'I reported this on random, it should catch the duplicate feedback about same issue'. Same merge ask as 3xtilzm7 / 5r37adac. (qa: qa-duplicate-detection)",
     "@maaiz retest re:m0q3o7wr: should auto-catch duplicate. (qa: qa-duplicate-detection)"),
    ('cmpjpd4mj0001829xl09zcukj', 'trainer-request-pending-state', 'regression-retest',
     "@maaiz retest re:l1dhjm6j: 'Not sure if push notification working, just checked if Amanii accepted my request and she did but not showing under my clients'. Two separate concerns: (a) push delivery uncertain, (b) accepted trainer-request not surfacing in CLIENTS hub. Investigate /api/trainer/clients return path + the post-accept hook. (qa: trainer-request-pending-state, trainer-client-auto-friend)",
     "@maaiz: accepted trainer request not surfacing in CLIENTS hub. (qa: trainer-request-pending-state)"),
    ('cmpjpdevb0000z21735mzw4dj', 'qa-pending-retests-list', 'regression-retest',
     "@maaiz retest re:m9uwb0lx: 'Not sure what this is about'. simplifyForUser() stripped too much. Show original tester note alongside the dev summary in the retest UI. (qa: qa-pending-retests-list, qa-patch-summary-user-friendly)",
     "@maaiz: re:m9uwb0lx — summary too cryptic. (qa: qa-pending-retests-list)"),
    ('cmpjpdx9d00001136pzw7xnzz', 'qa-patch-summary-user-friendly', 'regression-retest',
     "@maaiz retest re:yfle4mtx: 'Not sure what this is about - reworded by Claude'. simplifyForUser() over-stripped. Show original tester note as fallback when simplified body is < N chars after stripping. (qa: qa-patch-summary-user-friendly)",
     "@maaiz: re:yfle4mtx — simplifyForUser stripped too aggressively. (qa: qa-patch-summary-user-friendly)"),
    ('cmpjpgpch0001hgni0wjm73wr', 'system-notifs-scroll-bottom', 'regression-retest',
     "@maaiz retest re:8rba0u6v: 'Yes still opens systems notifications at the top but need to just see latest first at bottom like normal chats'. Drop the first-unread scroll-into-top behaviour; always land at bottom (chat convention). (qa: system-notifs-scroll-bottom)",
     "@maaiz: bottom-always on open, drop first-unread top behaviour. (qa: system-notifs-scroll-bottom)"),
    ('cmpjpihph0002hgnivb6541lp', 'workout-effort-skip-warning', 'regression-retest',
     "@maaiz retest re:5fxamsnr: 'Works but also warn the points losses too in tier and leaderboard'. Extended: show post-log toast '-N IP / -M leaderboard pts' when user logs without RPE (the lost intensity points the warning prevented). (qa: workout-effort-skip-warning)",
     "@maaiz: warn points losses too. (qa: workout-effort-skip-warning)"),
    ('cmpjpkv7s0000ch8b3xtilzm7', 'qa-duplicate-detection', 'regression-retest',
     "@maaiz retest re:aojajeq0: 'This is a duplicate should be merged together as 1 issue without me saying so'. Same merge ask. (qa: qa-duplicate-detection)",
     "@maaiz: duplicate auto-merge. (qa: qa-duplicate-detection)"),
    ('cmpjpm5a50000gn88wfquj84h', 'system-notifs-swipe-back', 'passing',
     "Passing: @maaiz retest re:ojd9bh1y verified working; also asked to mark the broader full-qa-section item passing. Done.",
     "@maaiz: 'Works and should be marked working in the full qa section'. Item flipped to passing. (qa: system-notifs-swipe-back)"),
    ('cmpjpnn500000102j1m8hjz6b', 'profile-identity-premium', 'regression-retest',
     "@maaiz retest re:1x0h4o1e: 'Better than before but equipment list is messy, with simple first letters of words and multiple items in same kin'. Equipment chip pretty-name pass: title-case each chip + dedupe within category. (qa: profile-identity-premium)",
     "@maaiz: equipment list messy. (qa: profile-identity-premium)"),
    ('cmpjpohcs0001102j2mjg4y7b', 'image-prompts-v2', 'regression-retest',
     "@maaiz retest re:h9xhkwnr: 'Low priority image generation work planned. Can even combine into one issue about all image generations'. Image-gen work already consolidated under image-prompts-v2 + image-gen-plan-v2; bumped priority to LOW in qa-state. (qa: image-prompts-v2)",
     "@maaiz: low priority, fold all image-gen into one item. (qa: image-prompts-v2)"),
    ('cmpjpq75e000enup35rwwem5o', 'home-clients-button-no-count', 'regression-retest',
     "@maaiz retest re:llw0tjef: 'Maybe count is good for both clients and friends, but not as a unread kinda bubble make it look more list a count'. Restored count chips on CLIENTS + FRIENDS home buttons styled as a neutral '(N)' suffix rather than unread-bubble. (qa: home-clients-button-no-count)",
     "@maaiz: counts good but not bubble-style. (qa: home-clients-button-no-count)"),
    ('cmpjtadwa0000jq7bm162bnit', 'profile-role-chip-not-toggle', 'regression-retest',
     "@maaiz retest re:noxarz4t: 'Still looks toggleable and the tier badges can be shown off here a bit larger'. Two follow-ups: (a) make non-toggleability more obvious (lower hover/pressed affordance), (b) tier badges sized up in identity card. (qa: profile-role-chip-not-toggle, profile-identity-premium)",
     "@maaiz: still looks toggleable + tier badges bigger. (qa: profile-role-chip-not-toggle)"),
    ('cmpjtbn470000n4ducbdn8t92', 'celebration-overlays-everywhere', 'regression-retest',
     "@maaiz retest re:h03wlu5h: 'Not sure how to test this, I want groups to get other athlete achievement updates too in the chat'. Slice: schema + endpoint stub for group-chat achievement system-posts (next slice wires fan-out + the chat bubble template). (qa: celebration-overlays-everywhere, groups-chat-achievement-posts)",
     "@maaiz: groups to get achievement updates in chat. (qa: celebration-overlays-everywhere)"),
    ('cmpjtcoqp0000hfgjjxe2pbtg', 'profile-identity-premium', 'regression-retest',
     "@maaiz retest re:ahe189ca: 'Word but they can just be larger icons, no text labeling' (re: profile-card music/external badges). Icons-only larger variant — drop the text labels. (qa: profile-identity-premium)",
     "@maaiz: profile badges as icons-only larger. (qa: profile-identity-premium)"),
    ('cmpjvotyx00005abp8ik7cvlq', 'progress-leaderboards-section-rework', 'regression-retest',
     "@maaiz ATTEND CONTEXT re:n3bxofzy: 'Do want the weight change, bf change and all that in ranks page or inside group leaderboards'. New item progress-leaderboards-section-rework: scope = rework the progress-tab leaderboards card to either (a) point at /ranks for global, (b) show weight/bf delta lifts + group-scoped leaderboards inline. (qa: progress-leaderboards-section-rework)",
     "@maaiz: weight/bf changes in ranks/group leaderboards. (qa: progress-leaderboards-section-rework)"),
    ('cmpjwblxk000012m2iv1u1m85', 'trainer-badge-everywhere', 'regression-retest',
     "@maaiz ATTEND CONTEXT re:t6l0oran: 'Anywhere there is a athlete badge or profile avatar, want to have the trainer badge show too'. New item trainer-badge-everywhere. (qa: trainer-badge-everywhere)",
     "@maaiz: trainer badge to appear wherever athlete avatar/badge shows. (qa: trainer-badge-everywhere)"),
    ('cmpjwc49v000112m27dhrsswl', 'trainer-rank-page', 'passing',
     "Passing: @maaiz ATTEND ALSO PASSES re:t6l0oran: 'Sorry looks like it is there'. Trainer rank page already exists; mark trainer-rank-page passing. (qa: trainer-rank-page)",
     "@maaiz: trainer rank page is there. (qa: trainer-rank-page)"),
    ('cmpkhlsyk0000by3zfffsmdmi', 'workout-music-launcher', 'regression-retest',
     "@maaiz ATTEND ALSO PASSES re:ahe189ca: 'Also make the buttons without text (Apple Music and Spotify) float on the active session pages'. Slice: workout view music launcher floats as a small pill in the bottom-right of active session. (qa: workout-music-launcher)",
     "@maaiz: music buttons float on active session. (qa: workout-music-launcher)"),
]

# (RETEST_CONTEXT processed AFTER NEW_ITEMS are added — see below.)

# ---------------------------------------------------------------------------
# C. NEW QA ITEMS — for brand-new bugs + ideas
# ---------------------------------------------------------------------------
NEW_ITEMS = [
    {
        'id': 'system-notifs-action-prev-feedback',
        'title': 'System-notif link should let user action the previously linked feedback (pass / comment / fail)',
        'area': 'Messages', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "From IRONLOG SYSTEM feed, tap '→ VIEW IN /qa' on a patch bubble.",
            "Verify /qa opens focused on the specific comment AND a quick action row (✓ PASS / ✗ STILL BROKEN / 💬 ADD CONTEXT) sits beneath the comment ready to tap.",
            "Tap one — verify it posts a retest comment without further navigation.",
        ],
        'notes': f"{TAG} Slice 1: deep-link already lands user on the comment via qa-deep-link-to-comment. Next slice: surface a one-tap action row beneath the linked comment in /qa. Source: @maaiz cmpjp92za 510srodo.",
    },
    {
        'id': 'system-notifs-bottom-always',
        'title': 'System feed lands at the BOTTOM on open (drop the first-unread top-scroll behaviour)',
        'area': 'Messages', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open IRONLOG SYSTEM with unread items present.",
            "Verify the feed lands scrolled to the bottom (newest), NOT scrolled to the top of the first unread.",
            "Unread highlight (NEW chip + glow) should still apply on unread bubbles.",
        ],
        'notes': f"{TAG} Slice 1: scroll target bumped to scrollHeight-clientHeight on mount unconditionally; first-unread-into-view dropped. Source: @maaiz cmpjpgpch 0wjm73wr.",
    },
    {
        'id': 'tier-points-loss-warning',
        'title': 'Tier / leaderboard point losses surface a warning toast when triggered (e.g. skipped RPE)',
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Log a set without an RPE chip selected (after acknowledging the existing warning).",
            "Verify a toast appears: '-N IP · -M leaderboard pts (no effort tagged)'.",
        ],
        'notes': f"{TAG} Slice 1: stub toast renderer added; integration with set-log handler in next slice. Source: @maaiz cmpjpihph vb6541lp.",
    },
    {
        'id': 'qa-retest-list-untruncated',
        'title': "YOUR PATCHES TO RETEST list shows the FULL note text (no 90-char snippet)",
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Quick Note FAB → YOUR PATCHES TO RETEST. Expand a row.",
            "Verify YOU SAID and FIX render the FULL text (multi-line, no … truncation).",
        ],
        'notes': f"{TAG} Slice 1: expander now shows full note via whiteSpace:pre-wrap + max-height:60vh scroll. Source: @maaiz cmpjp4w9m uu5meg6i / cmpjp64re opxo61bb.",
    },
    {
        'id': 'qa-retest-list-show-original-when-summary-cryptic',
        'title': 'Retest list shows ORIGINAL tester note alongside dev summary when summary is too cryptic',
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open YOUR PATCHES TO RETEST.",
            "On any expanded row, verify there are TWO sections: ORIGINAL NOTE (verbatim tester text) and PATCH SUMMARY (simplifyForUser output).",
        ],
        'notes': f"{TAG} Slice 1: API /api/qa/comments/mine returns originalNote alongside summary; FAB UI renders both. Source: @maaiz cmpjpdevb 35mzw4dj / cmpjpdx9d pzw7xnzz.",
    },
    {
        'id': 'qa-comment-priority-from-dashboard',
        'title': '/qa dashboard allows admin to bump a comment priority (LOW / MED / HIGH / CRIT)',
        'area': 'Admin', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open /qa as admin. On any comment row, verify a priority bumper chip (current value).",
            "Tap to cycle LOW → MED → HIGH → CRIT → LOW. Verify the value persists on reload.",
        ],
        'notes': f"{TAG} Slice 1: schema field qa-state.json comments.priority (already in some items) + admin POST /api/qa/admin/comment-priority stub. UI bumper next slice. Source: @maaiz cmpjp59dl e3aemb5o.",
    },
    {
        'id': 'profile-equipment-list-pretty',
        'title': 'Equipment list in profile renders pretty-name labels + dedupes within category',
        'area': 'Profile', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Profile → IDENTITY → equipment chips.",
            "Verify each chip is title-cased English (e.g. 'Adjustable Dumbbells', not 'AD' or 'a-dumb').",
            "Verify no two chips in the same category are duplicates / near-duplicates.",
        ],
        'notes': f"{TAG} Slice 1: equipmentPretty(slug) helper + dedupe by canonical. Source: @maaiz cmpjpnn5 1m8hjz6b.",
    },
    {
        'id': 'tier-badges-larger-everywhere',
        'title': 'Tier badges sized up in profile identity card + role-chip context',
        'area': 'Profile', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Profile. Verify tier badges in IDENTITY card are visibly larger than the role chip (≥36px on iPhone).",
        ],
        'notes': f"{TAG} Slice 1: identity card tier badge sizing bumped 24px → 40px. Source: @maaiz cmpjtadwa m162bnit / cmpjtcoqp jxe2pbtg.",
    },
    {
        'id': 'groups-chat-achievement-posts',
        'title': "Group chat auto-posts members' achievement / tier unlocks",
        'area': 'Social', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Member of group A logs a workout that unlocks an achievement / tier sub-rank.",
            "Open group A chat. Verify a SYSTEM bubble: '🏆 @username unlocked <achievement>'.",
        ],
        'notes': f"{TAG} Slice 1: groupSystemPost(groupId, kind, payload) stub in lib/systemNotifications.ts; wired from achievement-grant pipeline next slice. Source: @maaiz cmpjtbn4 cbdn8t92.",
    },
    {
        'id': 'progress-wellness-reminders-on-home',
        'title': 'Home shows daily wellness-update reminders (hydration / sleep) if data missing today',
        'area': 'Wellness', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "On any day where hydration or sleep hasn't been logged, open home.",
            "Verify a 💧 LOG HYDRATION or 😴 LOG SLEEP nudge card appears in the home pro-tips strip.",
            "Tap it — opens the wellness modal scoped to that field.",
        ],
        'notes': f"{TAG} Slice 1: wellnessRemindersForToday(user) helper + home pro-tip row hook. Source: @maaiz cmpjv3chl v8gh26f3.",
    },
    {
        'id': 'progress-daily-mission-counters',
        'title': 'Daily-mission counters audit (deadlift / pull-up / assisted variants)',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Pick a deadlift exercise on the current daily mission. Log a set of N reps.",
            "Verify the daily-mission progress bar moves by N reps (not 0, not N/2).",
            "Repeat for pull-ups; for ASSISTED pull-ups, verify the counter increments at the configured weight (half-rep / quarter-rep / full).",
            "Verify the UI surfaces the modifier when assisted ('counts as 0.5 reps').",
        ],
        'notes': f"{TAG} Slice 1: audit + fix DEADLIFT keyword match in lib/gamification.ts dailyMissionCounters (was only matching 'deadlift' lowercase, missing 'Deadlift' / 'Romanian DL'). Pull-up assisted modifier shipped at 0.5x with on-card hint. Source: @maaiz cmpjv56b 0isfrzht / cmpjv6lh3 twjor71u.",
    },
    {
        'id': 'progress-consistency-hint-gating',
        'title': "'Work on consistency' hint hidden until user has had enough days on app",
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Create a new account. Wait less than the minimum days the tier requires.",
            "Open Progress. Verify the 'work on consistency' hint does NOT show — too early to judge.",
            "After accountAgeDays > tier-minimum, verify the hint can show.",
        ],
        'notes': f"{TAG} Slice 1: tipsForUser() gates consistency hint on accountAgeDays >= 14 || daysLogged >= 7. Source: @maaiz cmpjvbseb 6ctwbtcv.",
    },
    {
        'id': 'progress-habits-subrank-target-aware',
        'title': 'Habits subrank rewards hitting the daily wellness TARGET (not just logging)',
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Log hydration well below user target — verify habits subrank credit is partial (~25%).",
            "Log hydration AT target — verify full credit + consistency bonus when streak ≥3 days.",
        ],
        'notes': f"{TAG} Slice 1: habitsSubrankScore() now multiplies by target-hit ratio (clamped 0.25..1.0) with a +5% streak bonus per consecutive on-target day (cap +25%). Source: @maaiz cmpjvd9cc 6x5lznld.",
    },
    {
        'id': 'progress-technique-subrank-copy',
        'title': 'Technique subrank copy explains it credits RPE-per-set AND supersets/drop-sets',
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open tier card → TECHNIQUE subrank tooltip.",
            "Verify body reads: 'Credit from: ① RPE tagged per set · ② Supersets · ③ Drop-sets'.",
        ],
        'notes': f"{TAG} Slice 1: copy edit in lib/tiers.ts subrankCopy.technique. Source: @maaiz cmpjvemcu mnhxt14z.",
    },
    {
        'id': 'progress-mastery-subrank-audit',
        'title': 'Mastery subrank calc audit (suspicious 80 from one routine)',
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Inspect masterySubrankScore(user) for the @maaiz account.",
            "Verify the score takes into account distinct exercises seen (not just total sets); cap at ~60 if only 1 routine has been performed.",
        ],
        'notes': f"{TAG} Slice 1: audit started — masterySubrankScore now divides by distinctExercisesLogged (was using total sets directly). Cap multiplier introduced. Source: @maaiz cmpjvfz4c cfkifz3d.",
    },
    {
        'id': 'progress-progression-subrank-copy',
        'title': "Progression subrank: clearer 'no weekly volume yet' copy",
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open tier card → PROGRESSION subrank. When weekly volume metric isn't computed yet, copy reads: 'Log at least one full week (7 days) of workouts to start tracking week-over-week volume.'",
        ],
        'notes': f"{TAG} Slice 1: lib/tiers.ts subrankCopy.progression placeholder updated. Source: @maaiz cmpjvgq0c 4013fovd.",
    },
    {
        'id': 'progress-strength-subrank-copy',
        'title': "Strength subrank: clearer 'log >4 sets' unlock copy",
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open tier card → STRENGTH subrank when unmet. Copy reads: 'Log 4+ sets of at least one big-lift exercise (squat / bench / DL / OHP) to start scoring strength.'",
        ],
        'notes': f"{TAG} Slice 1: copy clarified — names the actual gate (compound lifts, not any exercise). Source: @maaiz cmpjvi363 q16s5uv9.",
    },
    {
        'id': 'progress-tip-hide-when-session-logged',
        'title': "Tip 'Log a session today' hides if user has already logged a session today",
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "After completing a workout today, open Progress.",
            "Verify the 'how to get more points → log a session today' tip is hidden / replaced.",
        ],
        'notes': f"{TAG} Slice 1: tipsForUser() filters out 'log a session today' when sessionLoggedToday(user) is true. Source: @maaiz cmpjvjrkr 165g640t.",
    },
    {
        'id': 'progress-pb-list-collapsed-and-complete',
        'title': 'Progress PB list collapses by default + lists every exercise PB',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Progress dashboard. Verify the PB list section is COLLAPSED by default (header + count, body hidden).",
            "Tap to expand. Verify every exercise the user has lifted at least once shows its current PB (not just compounds).",
        ],
        'notes': f"{TAG} Slice 1: defaultCollapsed=true; PB query no longer filtered to top-3 lifts. Source: @maaiz cmpjvl9am o9x2t4p5.",
    },
    {
        'id': 'progress-leaderboards-section-rework',
        'title': 'Progress dashboard leaderboards section: rework or fold to /ranks',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Progress dashboard. Verify either (a) the leaderboards card is gone (with a 'view in /ranks' link in its place), or (b) the card shows weight-change / bf-change deltas + GROUP-scoped leaderboards (not global).",
        ],
        'notes': f"{TAG} Slice 1: card retained, content swap — now shows weight Δ + bf Δ + group-scoped top-5 (group with most members the user is in); global leaderboards link points to /ranks. Source: @maaiz cmpjvjrk n3bxofzy + cmpjvotyx 8ik7cvlq ATTEND CONTEXT.",
    },
    {
        'id': 'trainer-rank-page',
        'title': 'Trainer has a YOUR RANK page mirroring the athlete YOUR RANK page',
        'area': 'Trainer', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'passing',
        'steps': [
            "Open Profile as a trainer. Verify a YOUR RANK tile/route exists with trainer-specific subranks (clients-volume, clients-progress, retention).",
        ],
        'notes': f"{TAG} Slice 1: confirmed existing. @maaiz initially reported missing then ATTEND ALSO PASSES 'sorry looks like it is there'. Source: @maaiz cmpjvpk2 t6l0oran + cmpjwc49 7dhrsswl.",
    },
    {
        'id': 'trainer-badge-everywhere',
        'title': "Trainer badge renders wherever an athlete badge / profile avatar appears",
        'area': 'Trainer', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Confirm trainer-rolled accounts surface a TRAINER badge in: friend list rows, leaderboard rows, chat bubble avatars, group member lists.",
        ],
        'notes': f"{TAG} Slice 1: <AvatarWithBadges/> wrapper introduced that renders both tier + trainer (if user.role contains 'trainer'). Wired into friend list + leaderboard rows. Next slice: chat bubbles + group member lists. Source: @maaiz cmpjwblxk iv1u1m85.",
    },
    {
        'id': 'progress-watermark-animation',
        'title': 'Animated motivational watermark phrases actually animate on Progress page',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open Progress. Verify the background motivational watermark cross-fades / cycles every ~6s (same as Home).",
        ],
        'notes': f"{TAG} Slice 1: animation class missing on the progress-tab watermark <div>. Applied .ironlog-watermark-animated. Source: @maaiz cmpjw2ek1 w9z3m2jv.",
    },
    {
        'id': 'progress-body-photos-storage',
        'title': 'Body photo storage confirmation (currently unconfirmed)',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Upload a body photo from Progress → BODY page.",
            "Log out, log back in. Verify the photo is still there.",
            "Inspect the storage path — does it live in DB blob, S3, or Vercel blob? Document.",
        ],
        'notes': f"{TAG} Slice 1: audit started — bodyPhotoUpload route writes to Vercel blob but URL isn't being persisted in BodyMeasurement.photoUrl on save. Stub fix landed. Source: @maaiz cmpjw6pok xxrp92bh.",
    },
    {
        'id': 'groups-public-vs-open-rework',
        'title': 'Reconsider Public vs Open groups; default to open browsable list',
        'area': 'Groups', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Browse Groups → DISCOVER. Verify groups marked 'public' are visible & joinable in one tap (no extra request flow).",
            "Verify the visibility chip wording is consistent ('OPEN' for join-on-tap, 'INVITE-ONLY' for closed) — no separate 'public' value confusion.",
        ],
        'notes': f"{TAG} Slice 1: visibility enum collapsed to OPEN | INVITE_ONLY in lib/groups.ts; UI chip + filter labels updated. Migration: groups with visibility='public' rewritten to 'open' on read. Source: @maaiz cmpjwdxfn vkmus07p.",
    },
    {
        'id': 'conversation-bubble-rich',
        'title': 'Chat bubbles + message log rows show avatar + tier badge + online status + last-active',
        'area': 'Messaging', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Open a DM. Verify each peer-bubble has a 28px avatar with tier badge overlay (small).",
            "Verify the chat header shows username + tier badge + ONLINE / LAST SEEN Xm ago.",
            "Verify the messages inbox row shows online dot on the avatar.",
        ],
        'notes': f"{TAG} Slice 1: <ChatBubbleAvatar/> + chat header presence chip stub. Source: @maaiz cmpjwi7uk pwn4xs03.",
    },
    {
        'id': 'friend-request-push-notif',
        'title': 'Push notification fires on friend request received',
        'area': 'Social', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "User A sends friend request to User B (subscribed to push).",
            "Verify User B's device receives a push: '@A wants to be friends'.",
            "Tap the push — opens app at /messages with friend-requests tab focused.",
        ],
        'notes': f"{TAG} Slice 1: /api/friends/request POST handler now calls notifyPush(recipientId, 'friend-request', payload). Service-worker handler already routes the type. Source: @maaiz cmpjwj8x2 75g6edvl.",
    },
    {
        'id': 'workout-active-edit-set-tap',
        'title': 'Tapping a done set box in active session opens edit (weight + reps + RPE)',
        'area': 'Workout', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "In active session, complete at least 2 sets of an exercise.",
            "Tap one of the done set boxes (the W/R/E summary).",
            "Verify the edit overlay opens with that set's values pre-filled, editable, with SAVE.",
        ],
        'notes': f"{TAG} Slice 1: handleSetBoxTap restored — was removed during the EDIT button rework. Source: @maaiz cmpkj0efi 7d947um4.",
    },
    {
        'id': 'workout-active-drag-reorder-bonus',
        'title': 'Drag-to-reorder lets bonus / session-only exercises be placed where the user drops',
        'area': 'Workout', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "In active session, add a one-off bonus exercise (the + button at bottom).",
            "Hold + drag the bonus exercise upward.",
            "Verify it drops where the user releases (not snapped to bottom).",
        ],
        'notes': f"{TAG} Slice 1: reorder handler currently filters out sessionOnly=true rows from the orderable set. Removed the filter. Source: @maaiz cmpkj5cj4 tgv0sw74.",
    },
    {
        'id': 'workout-active-header-pinned',
        'title': 'Active session top header (exercise name + set chip) stays pinned on scroll',
        'area': 'Workout', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Start a session. Scroll the page down past the input row.",
            "Verify a compact header (exercise name + 'Set N · 3 done · NEXT REST 70s') sticks to the top of viewport.",
        ],
        'notes': f"{TAG} Slice 1: <StickyActiveSessionHeader/> introduced with position:sticky; appears when scrollY > input-row offsetTop. Source: @maaiz cmpkj9eax izlqa6ml.",
    },
    {
        'id': 'messaging-online-status-live',
        'title': 'Online status updates live in chat log (not only on chat reopen)',
        'area': 'Messaging', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open a DM. Peer is offline.",
            "Peer comes online on another device.",
            "Verify the chat header's status indicator flips to ONLINE within ~10s without reopening the chat.",
        ],
        'notes': f"{TAG} Slice 1: 15s presence poll on the open DM view (GET /api/presence/[peerId]); proper push/socket sub deferred. Source: @maaiz cmpkom4vj 56hfoxly.",
    },
    {
        'id': 'groups-add-challenges-fix',
        'title': 'Adding group challenges (was broken)',
        'area': 'Groups', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open a group as owner. Open CHALLENGES tab. Tap + ADD CHALLENGE.",
            "Pick a template + duration. Verify the challenge persists + appears for all members.",
        ],
        'notes': f"{TAG} Slice 1: audit started — investigating /api/groups/[id]/challenges POST. Source: @maaiz cmpkta0k7 e4l3632j.",
    },
    {
        'id': 'chat-link-preview-and-hyperlink',
        'title': 'Links in DMs / group chats are clickable + show preview card',
        'area': 'Messaging', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Send a URL in a DM or group chat (e.g. https://example.com/foo).",
            "Verify the URL is rendered as a tappable link.",
            "Verify a preview card (title + favicon) renders beneath the bubble.",
        ],
        'notes': f"{TAG} Slice 1: linkify() helper turns URLs into <a target=_blank rel=noopener>. Preview card via /api/og-preview (server-side OG fetch). Source: @maaiz cmpkw0qbw 5cnpebgr.",
    },
    {
        'id': 'home-next-up-smart',
        'title': "'Next up' tile suggests the lagging split (legs/cardio) not just next-in-order",
        'area': 'Home', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'regression-retest',
        'steps': [
            "Skip a leg day. Open Home. Verify the NEXT UP card suggests legs (not the next split-order item) and labels it 'OVERDUE'.",
            "Verify cardio days are suggested when the user has a cardio split + has skipped ≥7 days of cardio.",
        ],
        'notes': f"{TAG} Slice 1: nextUpSuggestion(user) scans daysSinceMuscleGroup() across primary groups + cardio; picks max-gap. Source: @maaiz cmpkw2jzk ran6on2r.",
    },
    {
        'id': 'pro-tip-overlay-zindex-investigate',
        'title': 'Re-investigate pro-tip-overlay-zindex — bumped fixed it for some scenarios but user reports another',
        'area': 'UI', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'failing',
        'steps': [
            "Open Home with a pro tip modal active. Try to reproduce the floating-button overlay regression after the z-index bump.",
            "Verify which element is still above z-9600 (feedback-fab is 9500 — confirm; check hub icons).",
        ],
        'notes': f"{TAG} Slice 1: 19:38Z attend 'I HAVE THIS TOO' on this issue. Existing fix bumped z-index 9000→9600; needs another sweep — possibly home-hub-floating buttons still above when pro tip stays open. Source: @maaiz cmpk6jlnd f9zc2vln.",
    },
    # Ideas — track only, no code:
    {
        'id': 'idea-qa-deep-link-to-test-screen',
        'title': 'Idea: Each /qa item has a TEST THIS button deep-linking to the relevant UI screen',
        'area': 'QA', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'untested',
        'steps': [
            "Open /qa. Click TEST THIS on a Workout-area item.",
            "Verify the app navigates to the active-session screen + scroll-anchors to the relevant control.",
        ],
        'notes': f"{TAG} Tracked. Needs qa-state.json schema extension (item.testHref / item.testView). Source: @maaiz cmpjuzyl r7v4e23w.",
    },
    {
        'id': 'idea-tier-name-labels',
        'title': 'Idea: Replace numeric tier-N with named labels (NEWBIE / QUICK LEARNER / BIG DAWG / ABSOLUTE UNIT / APEX BEAST) for athletes + trainer ranks',
        'area': 'Tiers', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'untested',
        'steps': [
            "Open tier card. Verify each tier shows its name in addition to the number.",
            "Verify the labels apply on profile, leaderboards, ranks page consistently for both athlete + trainer.",
        ],
        'notes': f"{TAG} Tracked. Catalogue: kitten=NEWBIE, fox=QUICK LEARNER, big-dawg=BIG DAWG / ESTABLISHED, gorilla=ABSOLUTE UNIT, bear=APEX BEAST. Source: @maaiz cmpjv9inu sptouga8 + cmpjvzcfn cnjwhw0p.",
    },
    {
        'id': 'idea-daily-quest-one-swap',
        'title': 'Idea: One daily-quest SWAP per user per day (no take-backs)',
        'area': 'Home', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'untested',
        'steps': [
            "Open Home → DAILY QUEST. Tap SWAP.",
            "Verify quest is replaced + SWAP button is greyed out for the remainder of the day.",
            "Refresh next day — verify SWAP is re-enabled.",
        ],
        'notes': f"{TAG} Tracked. Source: @maaiz cmpjw0ltu fg8d93ay.",
    },
    {
        'id': 'idea-progress-cards-rearrangeable',
        'title': 'Idea: Progress dashboard cards drag-to-reorder, persisted per-account',
        'area': 'Progress', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'untested',
        'steps': [
            "Open Progress. Long-press 3-line handle on a card. Drag to a new position. Release.",
            "Verify card stays in new position after reload and across sessions.",
        ],
        'notes': f"{TAG} Tracked. Source: @maaiz cmpjw47iz rxawxcmi.",
    },
    {
        'id': 'idea-admin-signup-push',
        'title': 'Idea: Admin accounts receive push + system-notif on new user signup',
        'area': 'Admin', 'introduced': TODAY, 'introducedBy': 'QA pass 2026-05-26',
        'lastTested': TODAY, 'status': 'untested',
        'steps': [
            "As a non-admin user, register a new account.",
            "Verify each ADMIN account receives a push '🧍 New signup: @username (email)' and a SYSTEM NOTIF row.",
        ],
        'notes': f"{TAG} Tracked. Source: @maaiz cmpkt63ce ropxtnoh.",
    },
]

for it in NEW_ITEMS:
    add_item(it)

# Now process RETEST_CONTEXT — items it references are all created above or pre-existing.
for entry in RETEST_CONTEXT:
    cid, iid, status, note, summary = entry
    if status == 'passing':
        flip(iid, 'passing', f"Passing: {note}")
    else:
        flip(iid, 'regression-retest', note)
    mark_processed(cid, summary)

# ---------------------------------------------------------------------------
# D. NEW BUG COMMENTS — mark processed with reference to the new items above
# ---------------------------------------------------------------------------
NEW_BUG_PROCESSED = [
    ('cmpjp92za0004pa6p510srodo',
     "@maaiz: 'Links in message go to as full and highlight the random notes section, just doesn't let me action the previous feedback to passed or add comments or failure'. New item system-notifs-action-prev-feedback tracks the one-tap PASS/CONTEXT/FAIL action row beneath the linked comment in /qa. (qa: system-notifs-action-prev-feedback)"),
    ('cmpjp92za0004pa6p510srodo',
     "(skip — already listed above)"),  # placeholder, will dedupe
    ('cmpjv3chl000410f3v8gh26f3',
     "@maaiz: 'Not seeing any reminders in home to update wellness info like hydration and sleep daily'. New item progress-wellness-reminders-on-home. (qa: progress-wellness-reminders-on-home)"),
    ('cmpjv56br000b10f30isfrzht',
     "@maaiz: 'I don't think deadlift reps count is working for daily mission'. New item progress-daily-mission-counters — slice fixes deadlift keyword match. (qa: progress-daily-mission-counters)"),
    ('cmpjv6lh3000ai09atwjor71u',
     "@maaiz: 'Pull-ups count for daily mission unclear, assisted pull-ups should contribute as half/etc.; let user know when assisted'. Same item progress-daily-mission-counters — slice adds 0.5x for ASSISTED + on-card hint. (qa: progress-daily-mission-counters)"),
    ('cmpjvbseb00041qhx6ctwbtcv',
     "@maaiz: 'Hint to work on consistency not appropriate when user hasn't been on app long enough'. New item progress-consistency-hint-gating — slice gates on accountAgeDays>=14 OR daysLogged>=7. (qa: progress-consistency-hint-gating)"),
    ('cmpjvd9cc0005jyd46x5lznld',
     "@maaiz: 'Habits subrank should be hit-the-target focused, with consistency bonus'. New item progress-habits-subrank-target-aware — slice multiplies by target-hit ratio + streak bonus. (qa: progress-habits-subrank-target-aware)"),
    ('cmpjvemcu0006wsi1mnhxt14z',
     "@maaiz: 'Technique subrank copy says supersets/drop-sets for IP but RPE per set too — make it make sense'. New item progress-technique-subrank-copy — slice updates copy. (qa: progress-technique-subrank-copy)"),
    ('cmpjvfz4c0000vm9scfkifz3d',
     "@maaiz: 'Mastery subrank 80 from one routine seems wrong, working right?'. New item progress-mastery-subrank-audit — slice divides by distinct exercises + caps at 60 when ≤1 routine. (qa: progress-mastery-subrank-audit)"),
    ('cmpjvgq0c0001vm9s4013fovd',
     "@maaiz: 'Progression subrank says no weekly volume yet - working right?'. New item progress-progression-subrank-copy — slice clarifies copy. (qa: progress-progression-subrank-copy)"),
    ('cmpjvi3630000ej12q16s5uv9',
     "@maaiz: 'Strength subrank says log >4 sets of an exercise to unlock - unclear, user has done more'. New item progress-strength-subrank-copy — slice names compounds explicitly. (qa: progress-strength-subrank-copy)"),
    ('cmpjvjrkr0001ej12165g640t',
     "@maaiz: 'Don't show log a session today if they've already done a session for how to get more points tips'. New item progress-tip-hide-when-session-logged — slice filters in tipsForUser(). (qa: progress-tip-hide-when-session-logged)"),
    ('cmpjvl9am0000wgoco9x2t4p5',
     "@maaiz: 'PB list in progression is not closed by default, and does not show every PB for every exercise done'. New item progress-pb-list-collapsed-and-complete — slice collapses + removes top-3 filter. (qa: progress-pb-list-collapsed-and-complete)"),
    ('cmpjvlt3p0001wgocn3bxofzy',
     "@maaiz: 'Don't need my leaderboards in progression if we have the ranks page right?'. New item progress-leaderboards-section-rework — slice swaps content to weight/bf deltas + group-scoped top-5 + 'view in /ranks' link. (qa: progress-leaderboards-section-rework)"),
    ('cmpjvpk2l0000zjpjt6l0oran',
     "@maaiz: 'There should be a trainer your rank page like the athlete your rank page'. New item trainer-rank-page. Subsequent ATTEND from same user 'sorry looks like it is there' — flipped to passing. (qa: trainer-rank-page)"),
    ('cmpjw2ek10000i77pw9z3m2jv',
     "@maaiz: 'Watermark animated motivational phrases not animated on progress page'. New item progress-watermark-animation — slice applies missing animation class. (qa: progress-watermark-animation)"),
    ('cmpjw6pok0005i77pxxrp92bh',
     "@maaiz: 'Photo storage isn't confirmed for body photos'. New item progress-body-photos-storage — slice persists Vercel blob URL into BodyMeasurement.photoUrl on save. (qa: progress-body-photos-storage)"),
    ('cmpjwdxfn0007d7phvkmus07p',
     "@maaiz: 'What's the point of public groups? Groups can be open list by default'. New item groups-public-vs-open-rework — slice collapses visibility enum to OPEN | INVITE_ONLY + migrates 'public' → 'open'. (qa: groups-public-vs-open-rework)"),
    ('cmpjwi7uk00061414pwn4xs03',
     "@maaiz: 'Profile avatar + tier badges + online status + last active in chat bubbles and message logs'. New item conversation-bubble-rich — slice introduces <ChatBubbleAvatar/> + presence chip. (qa: conversation-bubble-rich)"),
    ('cmpjwj8x20000o22d75g6edvl',
     "@maaiz: 'Push notification working for friend requests received?'. New item friend-request-push-notif — slice wires notifyPush() in /api/friends/request POST. (qa: friend-request-push-notif)"),
    ('cmpkj0efi000013e77d947um4',
     "@maaiz: 'Edit button on exercises in active session is vague and can't click into done set boxes to edit them now'. New item workout-active-edit-set-tap — slice restores handleSetBoxTap. (qa: workout-active-edit-set-tap)"),
    ('cmpkj5cj40000uz5stgv0sw74',
     "@maaiz: 'Drag to reorder starts dragging but can't place it where I want. Bonus exercise issue?'. New item workout-active-drag-reorder-bonus — slice removes sessionOnly filter from reorder. (qa: workout-active-drag-reorder-bonus)"),
    ('cmpkj9eax000e35vwizlqa6ml',
     "@maaiz: 'Want top part of active session to stay floating instead of scrolling away'. New item workout-active-header-pinned — slice adds sticky compact header. (qa: workout-active-header-pinned)"),
    ('cmpkom4vj0000bamk56hfoxly',
     "@maaiz: 'Online and last seen functions exist and work, but the online status needs to be updated live on the chat log, not on chat log reopen'. New item messaging-online-status-live — slice adds 15s poll in open DM view. (qa: messaging-online-status-live)"),
    ('cmpkta0k70000jpw8e4l3632j',
     "@maaiz: 'Adding group challenges doesn't seem to be working'. New item groups-add-challenges-fix — slice audits POST /api/groups/[id]/challenges. (qa: groups-add-challenges-fix)"),
    ('cmpkw0qbw0002pdvn5cnpebgr',
     "@maaiz: 'Links sent in both group chats and normal chats must be clickable with a preview and hyperlink both'. New item chat-link-preview-and-hyperlink — slice 1: linkify + OG preview endpoint. (qa: chat-link-preview-and-hyperlink)"),
    ('cmpkw2jzk0002mnizran6on2r',
     "@maaiz: 'Is next up checking just my split order or actually checking if I'm due for a leg day or other too? Can also suggest cardio days where applicable'. New item home-next-up-smart — slice scans days-since-muscle-group + cardio. (qa: home-next-up-smart)"),
    # Ideas
    ('cmpjuzylx0000nm1wr7v4e23w',
     "@maaiz idea: 'Too much to add a link to UI screen where test needs be performed on every full qa entry to respond to?'. Tracked as idea-qa-deep-link-to-test-screen. (qa: idea-qa-deep-link-to-test-screen)"),
    ('cmpjv9inu0004jyd4sptouga8',
     "@maaiz idea: 'Use names like absolute unit for gorilla, apex athlete for bear etc instead of intermediate in tier card'. Tracked as idea-tier-name-labels. (qa: idea-tier-name-labels)"),
    ('cmpjvzcfn0004uy4hcnjwhw0p',
     "@maaiz idea: 'Tier numbers can change to tier labels like newbie for kitten, quick learner for fox, etc. Same for trainer rank tier numbers'. Same idea-tier-name-labels item — duplicate consolidated. (qa: idea-tier-name-labels)"),
    ('cmpjw0ltu0002d7phfg8d93ay',
     "@maaiz idea: 'Get one swap daily quest function every day, one completion per user and no going back after trying the swap for the day'. Tracked as idea-daily-quest-one-swap. (qa: idea-daily-quest-one-swap)"),
    ('cmpjw47iz0000ae0srxawxcmi',
     "@maaiz idea: 'Rearrangeable cards in progress dashboard, hold 3 line bit on each card to drag and reorder. Account remembers order'. Tracked as idea-progress-cards-rearrangeable. (qa: idea-progress-cards-rearrangeable)"),
    ('cmpkt63ce0000l0p5ropxtnoh',
     "@maaiz idea: 'Push Notification of new user sign ups to admin accounts and into system notifications with their username and email'. Tracked as idea-admin-signup-push. (qa: idea-admin-signup-push)"),
]

for entry in NEW_BUG_PROCESSED:
    cid, summary = entry
    if summary.startswith('(skip'):
        continue
    if cid in processed:
        continue
    mark_processed(cid, summary)

# Write back
state['items'] = [items_by_id[it['id']] if it['id'] in items_by_id else it for it in state['items']]
# Ensure newly added items appear
existing_ids = {it['id'] for it in state['items']}
for it_id, it in items_by_id.items():
    if it_id not in existing_ids:
        state['items'].append(it)

with open('qa-state.json', 'w') as f:
    json.dump(state, f, indent=2)
with open('qa-processed.json', 'w') as f:
    json.dump(processed_doc, f, indent=2)

print(f"qa-state.json: {len(state['items'])} items")
print(f"qa-processed.json: {len(processed)} entries")
