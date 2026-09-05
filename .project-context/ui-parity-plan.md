# OMP Mobile — UI Parity Plan (reference: agent-mobile-ui)

Source of truth: `D:/omp-mobile/design-ref/index.html` (full source read) + 7 screenshots
+ live app at http://192.168.1.100:8742/. Every token/animation below is taken from that
source, not guessed.

## Reference inventory (widgets + interactions)

### Chrome
- Topbar: menu icon | session title (semibold) | plus (new chat). No back arrow, no tab bar.
- Left drawer: backdrop fade; slide-in; brand row (sparkle + "Agent") + X; "New chat"
  button (#2a2a2a, r12); "RECENTS" label; session rows (title + 52-char preview, active #2c2c2c).
- Overlays close on backdrop tap / hardware back.

### Messages
- User bubble: right-aligned, #242424, r18, padding 12/16, max-width 84%.
- Assistant plain text: #f2f2f2, 15-16px, lh 1.5.
- AgentTurn ("working group"):
  - Header button: pulsing live-dot + "Working · {live seconds}s" while running;
    "Worked for {dur}" when done; right chevron rotates 90° when open.
  - Auto-opens while working; auto-collapses when status flips to done.
  - Collapse animation .28s (RN: LayoutAnimation / Animated height).
  - Trace rail: entries padding-left 36; 2px rail #2c2c2c; last entry no rail;
    node 22px circle #242424 border #3a3a3a icon #8e8e8e; entry fade-in .3s translateY(4).
  - Reasoning entry: sparkle node; label "Reasoning · {dur}" 13/600 #8e8e8e; text 14.5 #b5b5b5
    (typewriter while live — free via streaming deltas).
  - Tool entry: wrench node; blue (#9ccafa) 14/600 tool name + [done: blue check | running:
    3 blinking dots] + chevron (rotates 180° open); expandable ARGUMENTS + RESULT:
    label 11/600 ls .09em #6f6f6f; box #1b1b1b border #2f2f2f r10 padding 10/12 mono 12.5 #a8a8a8.
  - After trace: full-bleed hairline sep (#2a2a2a), intro paragraph, bullet list,
    subtotal paragraph, then ActionRow.
- ActionRow: gap 14, icons ~21, #8e8e8e; copy morphs to blue check for 1.6s; fork second.

### Composer (images 1,2,4,6) + footer variant (image 7)
- Card #2d2d2d r28 padding 19/16/13; input 18px #f2f2f2, placeholder #606060, pad-bottom 26.
- Row gap 17, icons #a3a3a3: [+] attach popover; [shield+chev; blue #7cb6f0, orange in
  restricted mode] mode popover; [activity + count while working]; [context button] →
  context popover; spacer; [model 17/500 #ececec + chev #9a9a9a] → model sheet; [mic]
  listening = blue + pulsing ring; [send 38px circle #969696 → #f2f2f2 ready, arrow #171717].
- Attach popover: paperclip "Attach files", camera "Take a photo", link "Paste a link".
- Mode popover: "Auto-run tools", "Ask before running" (default, checked), "Read-only mode".
- Popover chrome: anchored bottom:100%+14px; min-width 232; #2d2d2d; border #3d3d3d; r14;
  padding 6; shadow 0 14px 36px rgba(0,0,0,.55); pop .16s (fade + translateY(7) + scale .97);
  items padding 10/12 r9 hover #3a3a3a; icon #8e8e8e; check blue opacity 0→1.
- Model sheet: backdrop rgba(0,0,0,.55) fade .24s; sheet #242424 r22 top; slide .3s
  cubic-bezier(.32,.72,.25,1); grabber 36x4 #454545; title 13/600 ls .07em #7c7c7c;
  item padding 13/12 r13; name 17/600; desc 13.5 #8a8a8a; check blue 20.
- Context popover (images 5,7): title "Context windows" + mono "{used}/{limit} ({pct}%)";
  blue progress bar on #3a3a3a track; rows: colored dot + label #9b9b9b + mono pct right;
  hairline; "Average cache hit rate" + mono pct.

### Session management (user requirement)
- Long-press a session row (drawer recents / sessions list) → BOTTOM SHEET with actions:
  Copy session ID (clipboard), Rename (inline input in sheet → server rewrites title line),
  Delete (destructive row, two-tap confirm inside sheet), and Cancel/backdrop dismiss.
  Sheet uses the same chrome as the model sheet (grabber, #242424, r22, slide .3s).

## Current-app gaps
1. Bottom tab bar + back arrow + ctx chip in header (reference has none).
2. No drawer; recents in a tab; long-press uses a plain Alert.
3. Composer row missing attach/mode/context popovers, activity indicator, mic.
4. Trace: no live seconds, no pulsing dot, no collapse animation, tool rows not expandable
   with ARGUMENTS/RESULT, no sep hairline, no copy morph.
5. Model sheet styling off.
6. No micro-animations; no auto-scroll-while-working; no streaming caret.

## Implementation plan (ordered)

P1 Navigation IA — remove tabs; root = Chat; Drawer (recents + search + long-press action
    sheet + new chat + Server status/Settings entries); topbar menu | title | plus.
    Server: renameSession (rewrite/insert title line in JSONL) + WS command.
P2 Composer + popovers + sheets — row per spec; PopoverMenu with pop animation; attach wired
    (expo-image-picker → cwd/.attachments + path note; paste link inserts clipboard);
    mode → store.approvalMode → server flags; context popover from store.lastUsage +
    model context window; model sheet restyle (+ REASONING + FOLDER sections below MODEL);
    mic via @react-native-voice/voice with listening ring.
P3 Turn/trace parity — worked header live timer + dot + chevron rotate + auto-collapse;
    collapse animation; tool rows expandable ARGUMENTS/RESULT; sep hairline; ActionRow copy
    morph + fork; streaming caret; auto-scroll 250ms while generating.
P4 Polish — entry fade-ins, press states, exact spacing/typography.
P5 Verify — emulator captures per state vs the 7 screenshots; tablet install; commit + push.

## Out of scope (documented, not faked)
- Category-level context breakdown (Messages/MCP tools/…): OMP usage events expose only
  input/output/cache totals; context popover shows those honestly in the same layout.
- User tool-request cards (Leaf): no user-tool-request concept in our protocol.
