// Form cues keyed by exercise ID — 2-3 short action points per exercise.
// Focus: what to DO to activate the right muscle, not just what to avoid.

export const FORM_CUES: Record<string, string[]> = {

  // ── CHEST ──────────────────────────────────────────────────────────────
  "barbell-bench-press": [
    "Retract your shoulder blades and press them into the bench — this protects your shoulders and puts the chest in a stronger position.",
    "Lower the bar to your lower chest (nipple line) with elbows at ~75°, not flared to 90°.",
    "Drive the bar up as if trying to bend it apart — this cue activates the pecs through the full range.",
  ],
  "incline-barbell-press": [
    "Set the bench to 30–45° — any steeper shifts the load to shoulders over upper chest.",
    "Touch the bar to the top of your chest, not your collarbone, and keep your chest up throughout.",
    "Think 'push the ceiling away' rather than 'push the bar up' to keep the upper pec under load.",
  ],
  "decline-barbell-press": [
    "Keep your butt and upper back in contact with the bench — any arch removes tension from the lower chest.",
    "Lower the bar to your lower sternum with a controlled 2-second descent.",
    "Press in a slight arc back toward the rack — this follows the natural push line of the lower pec.",
  ],
  "dumbbell-bench-press": [
    "At the bottom, let the dumbbells go slightly wider than a barbell would — this increases chest stretch.",
    "Press and slightly squeeze the dumbbells toward each other at the top for maximum inner-chest contraction.",
    "Keep your wrists stacked directly above your elbows throughout the movement.",
  ],
  "incline-dumbbell-press": [
    "Set bench to 30–45°. Keep your chest lifted — don't let your upper back round as you lower.",
    "Lower dumbbells until you feel a deep stretch in the upper chest before pressing back up.",
    "Squeeze the dumbbells slightly inward at the top to fully contract the upper pec.",
  ],
  "dumbbell-flyes": [
    "Maintain a slight, fixed bend in your elbows throughout — never straighten them; this is an arc, not a press.",
    "Think of hugging a large barrel — the movement is all in the shoulder joint, not the elbow.",
    "Stop when your elbows are at chest level; going lower puts excessive stress on the shoulder capsule.",
  ],
  "incline-dumbbell-flyes": [
    "The incline angle targets the upper chest — ensure your chest stays proud (up and forward) throughout.",
    "Lower with control until you feel a strong stretch, then drive the dumbbells together in a wide arc.",
    "Don't let the dumbbells touch at the top — maintain tension on the upper chest by stopping just before contact.",
  ],
  "cable-crossover": [
    "Choose a cable height that matches your target zone: high cables hit lower chest, low cables hit upper chest.",
    "Step slightly forward so the cables pull slightly behind you — this pre-stretches the chest.",
    "Cross your hands at the end of the rep and hold for 1 second to squeeze the inner chest fibers.",
  ],
  "chest-press-machine": [
    "Adjust the seat so the handles align with your mid-chest — too high shifts load to shoulders.",
    "Press until your arms are nearly extended but don't lock out — keep constant tension on the pec.",
    "Return slowly (2–3 seconds) to feel the full eccentric stretch in the chest.",
  ],
  "pec-deck": [
    "Set the seat so your elbows are at chest height — this is the key to keeping the movement in the pec.",
    "Keep your forearms vertical on the pads throughout; don't let them drift forward.",
    "Pause and squeeze for 1 second at the point where the pads meet — this is peak contraction.",
  ],
  "chest-dips": [
    "Lean your torso forward 30–45° during the dip — a vertical torso shifts load to triceps.",
    "Let your elbows flare slightly out to the sides as you lower; this opens the chest.",
    "Descend until you feel a good stretch in the chest, then push back up through the palms.",
  ],
  "pushups": [
    "Set hands slightly wider than shoulder-width and keep your body in a rigid plank — no sagging hips.",
    "Lower until your chest nearly touches the floor, elbows at ~45° from your sides.",
    "Push the floor away and think about squeezing your chest together at the top of each rep.",
  ],
  "wide-pushups": [
    "Place hands wider than standard push-ups to increase pec stretch at the bottom.",
    "Keep core tight and lower slowly — the wide position makes it easier to lose form.",
    "Focus on pressing through the pecs rather than using triceps to lock out.",
  ],
  "decline-pushups": [
    "Elevate your feet on a surface 30–60cm high — higher elevation shifts more work to the upper chest.",
    "Keep your body in a straight line from ankles to head throughout.",
    "Lower with a 2-second count, pause briefly, then press up — control is key at this angle.",
  ],
  "diamond-pushups": [
    "Form a diamond shape with your thumbs and index fingers — hands directly under your sternum.",
    "Elbows track back along your sides, not flaring out — this is the key to loading the triceps.",
    "Keep your body rigid; resist the urge to flare elbows as fatigue sets in.",
  ],
  "resistance-band-chest-press": [
    "Anchor the band at chest height behind you — tension should be present even at full extension.",
    "Press forward and slightly downward to follow the natural pec fiber direction.",
    "Squeeze at full extension and control the return slowly to maximise time under tension.",
  ],

  // ── BACK ───────────────────────────────────────────────────────────────
  "barbell-deadlift": [
    "Set the bar over your mid-foot, hinge at the hips until your shins touch the bar, then grip.",
    "Take a big breath, brace your core hard (360° of pressure), and push the floor away — don't think 'lift'.",
    "Keep the bar in contact with your legs the whole way up; the moment it drifts forward, your lower back takes over.",
  ],
  "romanian-deadlift": [
    "Hold the bar at hip height and hinge your hips back as far as possible while keeping a flat back.",
    "Feel a deep stretch in your hamstrings before driving your hips forward to return — squeeze glutes at the top.",
    "Bar stays close to your legs the entire way down; it should almost skim your shins.",
  ],
  "barbell-row": [
    "Hinge forward to ~45° and keep your back flat — rounding transfers load away from the lats.",
    "Pull the bar to your lower stomach (not your chest) and lead with your elbows.",
    "Hold the contraction at the top for 1 second and think about squeezing your shoulder blades together.",
  ],
  "t-bar-row": [
    "Keep your chest on the pad at all times to isolate the back and remove lower back from the equation.",
    "Pull the handles to your lower chest and drive your elbows as far back as possible.",
    "Lower slowly — the eccentric stretch on the lats is where a lot of growth stimulus comes from.",
  ],
  "seated-cable-row": [
    "Sit upright with a slight lean back — don't use body swing to move the weight.",
    "Pull the handle to your lower stomach and drive your elbows past your torso to fully retract the scapula.",
    "Let your arms extend fully on each rep for a full lat stretch before the next pull.",
  ],
  "lat-pulldown": [
    "Lean back slightly (10–15°) and pull the bar to your upper chest — not behind your neck.",
    "Lead with your elbows driving down toward your hips, not with your biceps pulling.",
    "At the bottom, hold for a second and think of squeezing your armpits shut to feel the lat contraction.",
  ],
  "wide-grip-lat-pulldown": [
    "A wider grip reduces bicep involvement and targets the outer lat for a wider back.",
    "Keep your chest tall and pull the bar to your collarbone level with elbows pointing down and back.",
    "Extend to a full stretch at the top — let your shoulder blades rise slightly before each rep.",
  ],
  "single-arm-dumbbell-row": [
    "Plant one hand and same-side knee on the bench; keep your back parallel to the floor.",
    "Pull the dumbbell to your hip (not your shoulder) and let your elbow drive as far back as possible.",
    "Don't rotate your torso — keep your hips and shoulders square throughout the pull.",
  ],
  "face-pull": [
    "Set the cable at or slightly above eye level and pull the rope to your face, hands beside your ears.",
    "Think 'hands to ears' not 'elbows back' — this cue opens the shoulder and hits the rear delt.",
    "Externally rotate at the top so your thumbs point behind you — this targets the rotator cuff and rear delt.",
  ],
  "straight-arm-pulldown": [
    "Keep your arms straight with just a slight elbow bend — any more and your biceps take over.",
    "Hinge slightly at the hips and pull the bar down to your thighs in a sweeping arc.",
    "Squeeze your lats hard at the bottom and let the bar rise slowly for a full stretch at the top.",
  ],
  "barbell-shrugs": [
    "Hold the bar in front of your thighs with a firm grip and keep your arms completely straight.",
    "Shrug straight up — no rolling of the shoulders, which shifts load to the rotator cuff.",
    "Hold at the top for 1–2 seconds to fully contract the upper traps before lowering.",
  ],
  "dumbbell-shrugs": [
    "Let the dumbbells hang naturally at your sides, then shrug your shoulders straight toward your ears.",
    "Don't roll forward or backward — the traps fire straight up.",
    "Hold the peak contraction for 2 seconds; this brief pause eliminates momentum and maximizes trap stimulus.",
  ],
  "hyperextension": [
    "Set the pad just below your hip bones so you can fully hinge at the hip.",
    "Lower your torso until you feel a stretch in your lower back, then drive up by squeezing your glutes and hamstrings.",
    "Stop when your back is flat — hyperextending past neutral puts undue stress on the lumbar spine.",
  ],
  "pullups": [
    "Start from a dead hang with a full arm extension to load the lats through the full range.",
    "Pull your chest toward the bar by driving your elbows toward your hips — not just bending your arms.",
    "Cross your feet, engage your core, and avoid kipping — controlled reps build more lat mass.",
  ],
  "chinups": [
    "Use a supinated (palms toward you) grip, which keeps the biceps more engaged throughout.",
    "Pull until your chin clears the bar, leading with the chest rather than the chin.",
    "Lower slowly over 3 seconds — the eccentric portion on chin-ups is highly effective for both lats and biceps.",
  ],
  "inverted-row": [
    "Set the bar so you can hang with arms fully extended — the lower the bar, the harder the row.",
    "Keep your body in a rigid plank; don't let your hips sag as you pull.",
    "Pull your chest to the bar and squeeze your shoulder blades together at the top before lowering.",
  ],
  "superman": [
    "Lie face down with arms extended overhead and lift arms, chest, and legs simultaneously.",
    "Hold the top position for 2–3 seconds to maximize erector and glute activation.",
    "Avoid jerking — use a slow, controlled lift to keep tension in the lower back throughout.",
  ],
  "resistance-band-row": [
    "Anchor the band at waist height and hold both ends with a firm grip.",
    "Step back until there is constant tension, then pull your elbows past your torso.",
    "Control the return slowly — the eccentric stretch is where band training is most effective.",
  ],
  "resistance-band-pulldown": [
    "Anchor the band overhead and kneel or sit to mimic a lat pulldown angle.",
    "Pull your elbows toward your hips in a sweeping arc, not just bending your arms.",
    "Pause at the bottom and squeeze your lats before letting the band pull your arms back up slowly.",
  ],

  // ── SHOULDERS ──────────────────────────────────────────────────────────
  "overhead-press": [
    "Start with the bar at collarbone level, elbows slightly in front of the bar (not directly under).",
    "Press the bar in a straight line — move your head back as the bar passes your face, then forward again.",
    "Lock out fully at the top to train the entire shoulder; don't stop short of full extension.",
  ],
  "dumbbell-shoulder-press": [
    "Start with dumbbells at ear level and elbows bent 90° — this is the bottom position.",
    "Press up and slightly in (not straight up) to keep tension on the deltoid at the top.",
    "Lower slowly to feel the full eccentric stretch in the shoulder before each rep.",
  ],
  "arnold-press": [
    "Start with dumbbells at chin height, palms facing you — then rotate and press in one fluid motion.",
    "The rotation engages all three delt heads across the range — don't skip the rotation.",
    "At the top, palms should face away; reverse the motion on the way down with the same rotation.",
  ],
  "lateral-raise": [
    "Hinge slightly at the elbows (5–10° bend) and maintain this bend throughout — don't straighten.",
    "Lead with your pinkies slightly higher than your thumbs — this internally rotates and targets the lateral delt.",
    "Raise only to shoulder height; going above it transfers load to the traps.",
  ],
  "cable-lateral-raise": [
    "Set the cable at the lowest position and stand side-on to the machine.",
    "Keep the movement arm at a consistent bend and raise to shoulder height with a slight forward lean.",
    "Cable keeps constant tension across the entire range — move slowly to take advantage of this.",
  ],
  "front-raise": [
    "Keep a slight bend in the elbow and raise your arm to shoulder height only — not above.",
    "Tilt your pinkies slightly up (thumbs down) to better target the anterior deltoid.",
    "Alternate arms to allow better control and a longer time under tension per side.",
  ],
  "rear-delt-fly": [
    "Lean forward at the hips ~45° and let the dumbbells hang — feel a stretch in the rear delts.",
    "Raise your arms out to the sides with a slight bend in the elbows — lead with your elbows, not your hands.",
    "Stop at shoulder height and squeeze your shoulder blades together briefly at the top.",
  ],
  "machine-shoulder-press": [
    "Adjust the seat so the handles are at ear height — too low or high shifts the load.",
    "Press upward without locking your elbows fully — maintain tension on the deltoid throughout.",
    "Lower slowly to feel the full stretch; don't bounce off the bottom.",
  ],
  "upright-row": [
    "Use a shoulder-width or narrower grip and pull the bar up along your body to upper chest height.",
    "Drive your elbows high above your hands — the elbows lead the movement.",
    "Stop when elbows reach shoulder height; going higher risks shoulder impingement.",
  ],
  "pike-pushup": [
    "Form an inverted V with your hips high and hands shoulder-width — torso nearly vertical.",
    "Lower your head toward the floor between your hands, then press back up through the shoulders.",
    "The more vertical your torso, the more you load the deltoid and less you use the chest.",
  ],
  "resistance-band-lateral-raise": [
    "Stand on the band and hold the ends at your sides with a slight elbow bend.",
    "Raise your arms to shoulder height against the band resistance, leading with pinkies up.",
    "The resistance increases as you raise — control the eccentric (lowering) phase carefully.",
  ],
  "resistance-band-shoulder-press": [
    "Stand on the band and hold ends at shoulder height, then press overhead until arms are extended.",
    "Keep your core braced to avoid arching your lower back as the band pulls you forward.",
    "Lower slowly back to shoulder height — don't let the band snap your arms down.",
  ],

  // ── BICEPS ─────────────────────────────────────────────────────────────
  "barbell-curl": [
    "Keep your elbows pinned to your sides throughout — any forward elbow movement shifts load to front delts.",
    "Curl to the top and squeeze the bicep hard before lowering slowly over 3 seconds.",
    "Don't swing your torso — momentum defeats the purpose; use a weight you can control.",
  ],
  "dumbbell-curl": [
    "Supinate your wrist (rotate palm up) as you curl — this maximizes bicep contraction.",
    "Alternate arms or do both — either way, squeeze at the top and lower slowly.",
    "Keep the upper arm completely still; only the forearm should move.",
  ],
  "hammer-curl": [
    "Keep a neutral grip (thumbs up) throughout — this targets the brachialis and brachioradialis.",
    "Don't rotate your wrist — the 'hammer' position must be maintained for the entire rep.",
    "These are often stronger than supinated curls, so use an appropriate weight and control the lowering.",
  ],
  "incline-dumbbell-curl": [
    "Set the bench to 60°, sit back, and let your arms hang fully extended — this pre-stretches the long head.",
    "Curl without letting your elbows drift forward — they should stay behind your torso.",
    "This position isolates the long head of the bicep; the peak contraction is intense — don't rush it.",
  ],
  "concentration-curl": [
    "Rest your elbow on the inside of your thigh to brace it, eliminating any swing.",
    "Fully extend at the bottom, curl up squeezing the bicep hard, then lower slowly.",
    "This is a pure isolation move — light weight with full range and slow tempo beats heavy weight with poor form.",
  ],
  "cable-curl": [
    "Set the cable low and curl upward while keeping your elbow completely stationary.",
    "The cable provides consistent tension at the top — hold and squeeze where a dumbbell would lose tension.",
    "You can angle your body to apply more tension at a specific point in the range.",
  ],
  "preacher-curl": [
    "Rest your upper arms flat on the pad, grip the bar just outside shoulder-width.",
    "Lower until your arms are almost fully extended — the stretch at the bottom builds the lower bicep.",
    "Curl up until your biceps are contracted, but don't let momentum carry the bar up.",
  ],
  "ez-bar-curl": [
    "The angled grip reduces wrist strain — ensure you grip the inner angled section for more bicep focus.",
    "Keep elbows fixed at your sides and curl with full range of motion.",
    "The EZ bar allows heavier loading than dumbbells — control the eccentric phase to build strength.",
  ],
  "resistance-band-curl": [
    "Stand on the band and hold the ends at your sides — there should be tension at the bottom.",
    "Curl up as you would with a dumbbell; the resistance increases through the range.",
    "Control the lowering phase — the band resists in both directions, so use this for both phases.",
  ],

  // ── TRICEPS ────────────────────────────────────────────────────────────
  "close-grip-bench": [
    "Grip the bar shoulder-width (not super narrow — that stresses the wrists) and keep elbows tucked.",
    "Lower to your lower chest and feel the stretch in the triceps before pressing back up.",
    "Think 'elbows in, push up' — keeping elbows close maximizes tricep involvement.",
  ],
  "skull-crushers": [
    "Set elbows directly above your shoulders and lower the bar toward your forehead — elbows stay fixed.",
    "Lower slowly until you feel a deep stretch in the tricep, then press back up without flaring elbows.",
    "If your elbows drift back as you lower, the long head gets more stretch — both variations are valid.",
  ],
  "tricep-pushdown": [
    "Keep your elbows locked at your sides — they must not move during the rep.",
    "Push down until your arms are fully extended, then hold for 1 second to squeeze the tricep.",
    "Don't lean into the weight; the push should come from the tricep alone.",
  ],
  "overhead-tricep-extension": [
    "Hold the dumbbell or cable overhead, elbows pointing forward beside your head — not flaring out.",
    "Lower behind your head until you feel a deep stretch in the long head of the tricep.",
    "Press back up by straightening your arms — the long head is best trained with the arm overhead.",
  ],
  "tricep-dips": [
    "Keep your body vertical (don't lean forward) — leaning shifts load to the chest instead of triceps.",
    "Lower until your elbows are at 90° — going deeper with poor shoulder mobility risks injury.",
    "Press straight back up by pushing through your palms and extending your triceps.",
  ],
  "tricep-kickback": [
    "Hinge forward at the hips so your upper arm is parallel to the floor — this is the start position.",
    "Extend your forearm back and hold at full extension for 1–2 seconds to squeeze the lateral head.",
    "Only your forearm moves — upper arm stays completely still and parallel to the floor.",
  ],
  "bench-dips": [
    "Keep your body close to the bench and lower until your elbows reach 90°.",
    "Press through your palms to straighten your arms — focus on the triceps pushing you up.",
    "Keep your feet further out to increase difficulty; bend knees to make it easier.",
  ],
  "resistance-band-pushdown": [
    "Anchor the band overhead and hold the end with both hands at chest height.",
    "Push down while keeping your elbows fixed — don't swing the band.",
    "Hold at full extension for a second before letting the band pull you back up slowly.",
  ],

  // ── LEGS — QUADS ───────────────────────────────────────────────────────
  "barbell-squat": [
    "Bar rests on your upper traps (not your neck). Feet shoulder-width, toes slightly out.",
    "Brace your core (360° breath), drive your knees out over your toes as you descend.",
    "Break parallel to fully recruit the glutes. Drive through your heels and squeeze your glutes at lockout.",
  ],
  "front-squat": [
    "Keep the bar on your front delts with elbows high — dropping your elbows causes the bar to fall forward.",
    "Maintain a very upright torso; this is the key difference from back squat and why it hits the quads harder.",
    "Drive your knees out and use a slightly narrower stance than back squat for optimal torso position.",
  ],
  "leg-press": [
    "Place feet shoulder-width in the middle of the platform — too high hits glutes more, too low stresses knees.",
    "Lower until your knees are at 90° (don't round your lower back off the pad at the bottom).",
    "Press through your heels and don't lock your knees out at the top — keep constant tension on the quads.",
  ],
  "hack-squat": [
    "Set your feet mid-low on the platform, shoulder-width apart, with a slight toe-out.",
    "Lower slowly to 90° or below, keeping your lower back flat against the pad.",
    "Drive through the heels and think about pushing the machine away from you — this keeps quad engagement high.",
  ],
  "leg-extension": [
    "Adjust the pad to sit on the lower shin (just above the ankle), not the foot.",
    "Extend fully and hold for 1–2 seconds at the top — the peak contraction here matters greatly.",
    "Lower slowly with a 3-second eccentric — this produces more quad hypertrophy than a fast return.",
  ],
  "lunges": [
    "Step far enough forward so your front shin is vertical when your back knee nears the floor.",
    "Keep your torso upright and drive through the front heel to return — this loads the glute.",
    "For more quad work, take a shorter step; for more glute work, take a longer step.",
  ],
  "bulgarian-split-squat": [
    "Place your back foot on the bench, and position your front foot far enough out so your front shin stays vertical.",
    "Lower straight down — not forward — so the knee tracks over the toes without shooting past the foot.",
    "Drive through the front heel to stand; squeeze the glute at the top for peak activation.",
  ],
  "goblet-squat": [
    "Hold the weight close to your chest and use it as a counterbalance to sit deep and upright.",
    "Push your elbows between your knees at the bottom to open your hips and maintain an upright torso.",
    "A great teaching squat — if you can't maintain this position with bodyweight, build mobility first.",
  ],
  "bodyweight-squat": [
    "Stand shoulder-width, toes slightly out, and sit back into the squat as if lowering onto a low seat.",
    "Keep your chest up and drive your knees over your toes throughout.",
    "Go to at least parallel — stopping short removes the glute from the movement.",
  ],
  "jump-squat": [
    "Squat to parallel then explode upward, fully extending your hips, knees, and ankles at take-off.",
    "Land softly by absorbing through your ankles, then knees, then hips — immediately drop into the next rep.",
    "These train power; rest fully between sets to maintain explosion quality.",
  ],
  "step-ups": [
    "Use a step height where your thigh is at least parallel to the floor when your foot is on it.",
    "Drive through the heel of the elevated foot to stand — don't push off the trailing foot.",
    "Keep your torso upright and control the lowering phase to load the quad eccentrically.",
  ],
  "wall-sit": [
    "Set your back flat against the wall with thighs parallel to the floor and shins vertical.",
    "Drive your back into the wall and push your feet into the floor — this engages the quad isometrically.",
    "Keep breathing steadily throughout — holding your breath cuts hold time and stresses your heart unnecessarily.",
  ],
  "sumo-squat": [
    "Take a wide stance (1.5–2× shoulder-width) with toes pointed out 45°.",
    "Push your knees out hard in line with your toes as you lower — this is how the inner thigh stays engaged.",
    "Drive through your heels and squeeze your glutes and inner thighs together at the top.",
  ],
  "resistance-band-squat": [
    "Stand on the band and hold the ends at shoulder height — the band adds upward resistance.",
    "Perform a standard squat with the band providing resistance through the entire range.",
    "The band also trains core stability; brace extra hard to resist being pulled forward.",
  ],

  // ── LEGS — HAMSTRINGS / GLUTES ─────────────────────────────────────────
  "leg-curl": [
    "Adjust the pad to rest just above your heels, not mid-calf.",
    "Curl your heels toward your glutes and hold at full flexion for 1 second — squeeze the hamstrings.",
    "Lower slowly over 3 seconds — hamstrings respond very well to slow, loaded eccentrics.",
  ],
  "romanian-deadlift-db": [
    "Hold dumbbells in front of your thighs and hinge your hips back, keeping the dumbbells close to your legs.",
    "Feel the stretch build in the hamstrings before driving your hips forward and squeezing your glutes to stand.",
    "Keep a flat back throughout — any rounding transfers load to the lower back.",
  ],
  "glute-bridge": [
    "Lie on your back with feet flat, hip-width apart, and drive your hips up by squeezing your glutes.",
    "At the top, your knees, hips, and shoulders should form a straight line — avoid overextending.",
    "Hold at the top for 2 seconds and squeeze your glutes as hard as possible before lowering.",
  ],
  "hip-thrust-barbell": [
    "Roll the bar over your hips and rest your upper back on the bench edge, just below your shoulder blades.",
    "Drive through your heels, push your hips up, and squeeze your glutes hard at the top — don't hyperextend.",
    "Use a hip pad to cushion the bar. Keep your chin slightly tucked so your spine stays neutral at the top.",
  ],
  "hip-thrust-db": [
    "Hold the dumbbell across your hips, upper back on the bench, feet flat and hip-width apart.",
    "Drive your hips up explosively, hold for 1–2 seconds at the top, then lower with control.",
    "Focus on glute contraction at the top — if you feel it in your lower back, your hips are going too high.",
  ],
  "glute-kickback": [
    "Keep your hips square to the floor — any rotation means the glute is not doing the work.",
    "Drive your heel toward the ceiling by contracting the glute, not by swinging the leg.",
    "Hold at peak extension for 1 second; lower slowly back to the start.",
  ],
  "sumo-deadlift": [
    "Take a wide stance with toes pointing out 45–60° and grip the bar narrow (inside your legs).",
    "Push your knees out hard over your toes throughout the lift — this is what makes sumo work.",
    "Drive the floor away with your legs, then lock out with your glutes at the top.",
  ],
  "nordic-curl": [
    "Anchor your feet and start kneeling upright — this is a hamstring-dominant movement.",
    "Lower your body toward the floor as slowly as possible, braking with your hamstrings.",
    "Use your hands to push off the floor and return — build toward doing the eccentric without assistance.",
  ],
  "donkey-kick": [
    "Start on all fours with a neutral spine — don't arch your lower back to get your leg higher.",
    "Drive your heel toward the ceiling by contracting the glute; your knee stays bent at 90°.",
    "Hold at the top for 2 seconds, then lower with control — avoid hip rotation.",
  ],
  "good-morning": [
    "Hold the bar on your traps and hinge at the hips with a soft knee bend — keep your back flat.",
    "Lower until you feel a strong hamstring stretch, then drive your hips forward to return.",
    "The good morning is a hinge, not a squat — keep the knee angle constant throughout.",
  ],

  // ── CALVES ─────────────────────────────────────────────────────────────
  "standing-calf-raise": [
    "Lower your heel below the platform for a full stretch before raising as high as possible onto the toes.",
    "Hold at the top for 2 seconds — the gastrocnemius responds well to peak contraction holds.",
    "Calves have a high percentage of slow-twitch fibers; use higher reps (15–20+) and slow tempo.",
  ],
  "seated-calf-raise": [
    "The seated position (knees bent at 90°) isolates the soleus — a deeper calf muscle under the gastroc.",
    "Lower the weight fully for a full stretch, then press through the balls of your feet as high as possible.",
    "The soleus responds best to slow, controlled reps with a pause and squeeze at the top.",
  ],
  "dumbbell-calf-raise": [
    "Stand with balls of feet on an elevated surface and lower heels below the step for maximum stretch.",
    "Press up as high as you can, hold for 2 seconds, then lower slowly for a full stretch.",
    "Single-leg variation increases the load significantly — use a wall for balance if needed.",
  ],

  // ── CORE ───────────────────────────────────────────────────────────────
  "plank": [
    "Keep your body in a rigid straight line from head to heels — no sagging or piking at the hips.",
    "Brace your core as if taking a punch: squeeze abs, glutes, and quads simultaneously.",
    "Breathe steadily; holding your breath causes premature fatigue. Aim for full-body tension.",
  ],
  "side-plank": [
    "Stack your feet or stagger them for stability, elbow directly under your shoulder.",
    "Drive your hips up so your body forms a straight diagonal line — don't let them sag.",
    "Squeeze your obliques by trying to pull your hip toward your armpit.",
  ],
  "crunches": [
    "Keep your lower back flat on the floor — only curl your upper back off the ground.",
    "Exhale forcefully as you crunch up — this activates the transverse abdominis and deepens the contraction.",
    "Don't pull on your neck; use your hands only to lightly support your head.",
  ],
  "bicycle-crunch": [
    "Keep your lower back pressed into the floor throughout — don't let it arch.",
    "Move slowly and deliberately — the rotation meets the opposite elbow; don't rush.",
    "Extend the non-working leg fully to increase the oblique demand and difficulty.",
  ],
  "leg-raises": [
    "Keep your lower back pressed into the floor — the moment it arches, the hip flexors are doing the work.",
    "Lower your legs slowly (3–4 seconds) without letting them touch the floor between reps.",
    "For more lower ab focus, tilt your pelvis slightly upward at the top of the movement.",
  ],
  "hanging-leg-raise": [
    "Start from a dead hang with your core pre-braced before the first rep.",
    "Curl your pelvis upward as you raise your legs — this hits the lower abs rather than just hip flexors.",
    "Lower your legs slowly rather than letting them drop — the eccentric matters here.",
  ],
  "russian-twist": [
    "Lean back to about 45°, keep your chest tall, and rotate from your torso — not your arms.",
    "Pause at the end of each rotation before reversing — this prevents momentum from taking over.",
    "For progression, elevate your feet or add a weight plate; for easier, keep feet on the floor.",
  ],
  "ab-rollout": [
    "Start kneeling with the wheel under your shoulders and roll out only as far as you can keep a flat back.",
    "Brace your core maximally before starting; your abs must resist your lower back from arching.",
    "Pulling back in is the hard part — engage your lats and abs to return, not your lower back.",
  ],
  "cable-crunch": [
    "Kneel below the cable stack and hold the rope at your temples — the cable must stay taut.",
    "Crunch by rounding your upper spine toward your knees, not by pulling your head down.",
    "The weight resists your crunch; exhale and squeeze your abs hard at the bottom of each rep.",
  ],
  "mountain-climbers": [
    "Start in a high plank with rigid form — hips level, core braced.",
    "Drive your knees toward your chest alternately while keeping your hips flat and stable.",
    "Speed is the point here; move as fast as you can while maintaining plank alignment.",
  ],
  "dead-bug": [
    "Press your lower back into the floor and keep it there the entire set — this is non-negotiable.",
    "Extend opposite arm and leg slowly, pause just above the floor, then return before switching.",
    "Breathe out as you extend and in as you return — the breath assists in keeping your back flat.",
  ],
  "v-ups": [
    "Start flat and simultaneously raise your upper body and straight legs to meet in the middle.",
    "Keep your legs straight and aim to touch your toes at the top of each rep.",
    "Lower slowly and avoid letting your legs or shoulders touch the floor between reps.",
  ],
  "toe-touches": [
    "Keep your legs vertical above your hips and reach your hands toward your feet.",
    "Exhale and crunch your upper back off the floor — only the upper body moves.",
    "Hold briefly at the top before lowering with control.",
  ],
  "bird-dog": [
    "Start on all fours with a neutral spine — no rotation or arching in your lower back.",
    "Extend opposite arm and leg until they are horizontal, hold for 2 seconds, then return.",
    "The slower you move, the harder your core works to maintain stability — resist swaying.",
  ],

  // ── CARDIO / CONDITIONING ──────────────────────────────────────────────
  "jump-rope": [
    "Jump only high enough to clear the rope (2–3 cm) — excessive height wastes energy.",
    "Land on the balls of your feet with soft knees to absorb impact; keep arms close to your sides.",
    "Use your wrists to turn the rope, not your shoulders.",
  ],
  "burpees": [
    "Place your hands shoulder-width and step or jump your feet back into a plank — keep your core tight.",
    "Perform a full push-up if adding intensity; then jump your feet forward and explode upward.",
    "Control the landing — absorb through the ankles and knees rather than landing stiff.",
  ],
  "high-knees": [
    "Drive your knees up to hip height alternately while pumping your arms in opposition.",
    "Stay on the balls of your feet throughout — landing on your heels kills momentum.",
    "Keep your core braced so your torso stays stable; only your legs should move.",
  ],
  "box-jumps": [
    "Stand shoulder-width, dip quickly, then explode upward by fully extending hips, knees, and ankles.",
    "Land softly on the box with both feet simultaneously, absorbing through bent knees.",
    "Step down rather than jumping down to protect your Achilles tendon over high volumes.",
  ],
  "treadmill": [
    "Keep your posture upright — lean slightly forward from the ankles, not the waist.",
    "Land with your foot under your centre of mass, not out in front — this reduces impact.",
    "Swing your arms forward and back, not across your body, to maintain efficiency.",
  ],
  "cycling": [
    "Adjust the seat so your knee has a slight bend (5–10°) at the bottom of the pedal stroke.",
    "Push through the ball of your foot, not your heel, and try to apply force through the entire stroke.",
    "Keep your upper body relaxed — grip the handlebars lightly and avoid hunching.",
  ],
  "rowing-machine": [
    "Drive sequence: legs first, then lean back, then pull the handle to your lower chest.",
    "Don't pull with your arms while your legs are still pushing — sequence matters for power.",
    "Return in reverse: arms out, lean forward, then bend knees — maintain a smooth rhythm.",
  ],
  "jumping-jacks": [
    "Jump your feet out slightly wider than shoulder-width while raising your arms overhead simultaneously.",
    "Land softly on the balls of your feet, absorbing the impact through bent knees.",
    "Maintain a steady rhythm and keep your core lightly engaged throughout.",
  ],

  // ── REHAB / MOBILITY ───────────────────────────────────────────────────
  "clamshell": [
    "Lie on your side with knees stacked and bent at 90°, hips stacked — don't let your top hip roll back.",
    "Rotate your top knee toward the ceiling while keeping your feet together — like a clamshell opening.",
    "Hold at peak rotation for 2 seconds before lowering; this is a slow, controlled activation exercise.",
  ],
  "resistance-band-hip-abduction": [
    "Anchor the band above your ankle and stand side-on to the anchor point.",
    "Raise the working leg out to the side (abduction) without tilting your trunk.",
    "Control the return slowly — the band pulls hardest at the end range where the glute med is most active.",
  ],
  "shoulder-external-rotation": [
    "Keep your elbow pinned at 90° against your side and rotate your forearm outward.",
    "The movement is small but deliberate — focus on the muscle behind your shoulder doing the work.",
    "This strengthens the rotator cuff; use very light resistance and high reps (15–20).",
  ],
  "wall-slide": [
    "Stand with your back flat against the wall and arms in a W position, elbows at 90°.",
    "Slowly slide your arms upward into a Y position while keeping your lower back, elbows, and wrists in contact.",
    "If any of those contact points break, you've gone too far — this exposes shoulder mobility limits.",
  ],
  "straight-leg-raise": [
    "Lie flat and keep the working leg straight as you raise it to 45–90°.",
    "Keep your lower back pressed into the floor throughout — brace your core before lifting.",
    "Lower slowly and stop just above the floor before the next rep to keep tension on the quad.",
  ],
  "terminal-knee-extension": [
    "Anchor the band behind your knee and stand with a slight bend — resist the band pulling your knee back.",
    "Straighten your knee fully against the band while keeping your foot flat.",
    "This targets the VMO (inner quad teardrop) and is key for knee stability — use light resistance only.",
  ],

  // ── New HIIT exercises ─────────────────────────────────────────────────
  "tuck-jumps": [
    "Drive your knees up to hip height or higher at the peak — the higher the tuck, the harder hip flexors and quads work.",
    "Swing your arms down forcefully as you jump to generate upward momentum, then absorb the landing softly through bent knees.",
    "Land on the balls of your feet, not your heels — immediately rebound into the next rep without pausing.",
  ],
  "split-jumps": [
    "Start in a lunge, explode upward and switch legs in mid-air, landing in a lunge with the opposite leg forward.",
    "Keep your torso upright on landing — leaning forward shifts load off the glutes and stresses the knee.",
    "Land softly through the front heel and immediately spring into the next rep — the faster the switch, the greater the cardio demand.",
  ],
  "speed-skaters": [
    "Bound laterally as far as possible and land on one foot with a slight knee bend — back leg swings behind the planted leg.",
    "Reach your opposite hand toward the landing foot to maximise the lateral stretch and balance challenge.",
    "Drive off the planted foot explosively to initiate each bound — think 'push', not 'hop'.",
  ],
  "plyo-pushup": [
    "Lower to the bottom of a push-up, then explosively press the floor away so your hands leave the ground at the top.",
    "Keep your core braced throughout — sagging hips during the explosive phase increase injury risk.",
    "Land with soft elbows immediately in the next rep's setup position, absorbing impact before re-pressing.",
  ],
  "bear-crawl": [
    "Start on hands and knees with knees hovering 2–3 cm off the ground — maintain this hover throughout.",
    "Move contralaterally: right hand and left foot together, then left hand and right foot.",
    "Keep your hips level and low — avoid bobbing up and down, which removes the core stability demand.",
  ],
  "inchworm": [
    "From standing, hinge at the hips and walk your hands out until you're in a plank — pause for one breath.",
    "Keep your legs as straight as possible during the walkout to maximise hamstring stretch.",
    "Walk your feet up to your hands with small controlled steps — this is the eccentric part; don't rush it.",
  ],
  "lateral-bounds": [
    "Push off one foot and bound sideways, landing on the opposite foot with a slight knee bend — immediately rebound.",
    "Reach the opposite arm across your body as you land to help balance and coordinate the lateral motion.",
    "Focus on distance over height — wider bounds recruit more glute medius for hip stability.",
  ],
  "broad-jump": [
    "Hinge slightly at the hips, swing your arms back, then drive them forward and explode horizontally off both feet.",
    "Aim for maximum distance — not height. Keep your trajectory low and long.",
    "Land softly on both feet with bent knees and hips, absorbing the impact before standing tall for the next rep.",
  ],
  "squat-thrust": [
    "From standing, drop into a squat, place your hands on the floor, jump your feet back to a plank, then jump them forward and stand.",
    "Keep your core braced in the plank position — avoid letting your hips pike up or sag down.",
    "Move quickly between squat and plank phases — the transition is where the cardio demand peaks.",
  ],
  "star-jump": [
    "From a slight squat, jump and simultaneously spread your arms and legs wide in an 'X' shape at the peak.",
    "Fully extend arms above your head and spread legs at least shoulder-width apart — the full range is what makes it demanding.",
    "Land with feet together and immediately compress into the next rep — the rebound builds cardiovascular output.",
  ],
  "lateral-shuffle": [
    "Stay low in an athletic stance with knees bent — shuffling from this position engages quads and glutes far more than shuffling upright.",
    "Push off the trailing foot to initiate each shuffle — the push is what activates the glutes, not just stepping.",
    "Keep your weight centred and avoid crossing your feet — maintain the athletic stance through each direction change.",
  ],
  "elliptical": [
    "Stand tall through the hips and avoid leaning on the handlebars — the legs should be powering the motion, not your arms.",
    "Push DOWN through each footplate at the bottom of the stride rather than just pulling back — that's where the glute / hamstring engagement comes from.",
    "Match arm drive to leg drive — opposite hand and foot move together, just like a natural running cadence.",
  ],
};

// Universal fallback cues for any exercise we don't have a tailored set for —
// covers custom trainer-created exercises and any future library additions.
// These are intentionally generic but actionable, so the FORM modal and the
// in-session form tip never appear blank.
const GENERIC_CUES = [
  "Move through the full range of motion under control — don't shorten reps to keep weight up.",
  "Brace your core throughout the set so force transfers cleanly through your spine.",
  "Keep tension on the target muscle from start to finish — don't rest at lockout or the bottom.",
];

// Lookup by ID first, then by normalised name match, then a generic fallback.
export function getFormCues(exerciseId?: string, exerciseName?: string): string[] {
  if (exerciseId && FORM_CUES[exerciseId]) return FORM_CUES[exerciseId];
  // Stretches keep their cues inline in lib/stretching.ts (they're
  // structured differently from the main exercise library). Bridge
  // them in here so the FORM modal works on warmup/cooldown rows
  // too. (qa: maaiz — "Add form previews like exercise previews
  // and help text to cooldowns warmups stretches")
  if (exerciseId) {
    try {
      const { findStretchById } = require("./stretching") as typeof import("./stretching");
      const s = findStretchById(exerciseId);
      if (s && Array.isArray(s.cues) && s.cues.length > 0) return s.cues;
    } catch {}
  }
  if (exerciseName) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = norm(exerciseName);
    const match = Object.keys(FORM_CUES).find(k => norm(k) === key || key.includes(norm(k)) || norm(k).includes(key));
    if (match) return FORM_CUES[match];
    // Fallback: scan the stretch library by normalised name.
    try {
      const { ALL_WARMUPS, ALL_COOLDOWNS } = require("./stretching") as typeof import("./stretching");
      const all = [...ALL_WARMUPS, ...ALL_COOLDOWNS];
      const hit = all.find(x => norm(x.name) === key || key.includes(norm(x.name)) || norm(x.name).includes(key));
      if (hit && Array.isArray(hit.cues) && hit.cues.length > 0) return hit.cues;
    } catch {}
  }
  return GENERIC_CUES;
}
