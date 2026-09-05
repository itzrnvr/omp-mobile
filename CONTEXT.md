# OMP Mobile — Context

Remote mobile client for the **OMP (Oh My Pi)** coding-agent CLI. React Native (Expo SDK 53 / RN 0.79) app + Bun bridge server on the PC + an omp TUI extension for token-level live sync. UI matches the `agent-mobile-ui` reference (ChatGPT-mobile style, dark `#171717`).

Repo: `https://github.com/itzrnvr/omp-mobile` (master)

## Layout

```
server/            Bun bridge (port 9090): WS + REST, spawns omp -p per message
  src/index.ts       WS/REST entry, ext-sync layer, session watcher, fs picker API
  src/omp.ts         spawnOmp (--mode=json -p --auto-approve --approval-mode=yolo)
  src/sessions.ts    JSONL session list/history/delete/rename/fork (~/.omp/agent/sessions)
  src/models.ts      catalog = `omp models ls --json` (async, 5min TTL) fallback models.yml
  src/tunnel.ts      cloudflared quick tunnel + gist bootstrap publish
mobile/            Expo app (Android)
  src/store/         Zustand store: WS events -> UI state (live buffering, steer queue)
  src/components/    chat/ (Trace, MessageList, ChatInput, ModelSheet, FolderPicker,
                     MarkdownView, ContextPopover), nav/Drawer, ui/ (Sheet, ContextRing…)
  src/screens/       ChatScreen (single root), SettingsScreen (sheet-embedded)
~/.omp/agent/extensions/omp-mobile-sync/   TUI-side observer extension (WS -> bridge /ext)
design-ref/        reference HTML (palette + interactions)
```

## Wire protocol (WS, token auth `?token=`)

Client→server: `send {content,sessionId,model,thinking,autoApprove,cwd}`, `get_history`, `get_status`, `refresh_models`, `list_sessions`, `delete_session`, `rename_session`, `fork_session`, `start_tunnel`.
Server→client: `event {event,sessionId}` (omp JSON-mode events verbatim), `complete`, `error`, `sessions`, `history {messages,title,externallyActive}`, `status`, `tunnel`, `forked/deleted/renamed`, `uploaded`, `ext_event {sessionId,event}`, `ext_session {sessionId,active}`.

Extension→bridge (`/ext` path): `ext_hello {sessionId}`, `ext_event {sessionId,event}`, `ext_bye`. Bridge rebroadcasts `ext_event`/`ext_session` to all mobile clients; clients ignore events for other sessions.

## Key decisions (why)

- **Live streaming**: server line-buffers omp stdout, forwards each event immediately. Client buffers assistant messages in `pendingMessages` + `liveSteps` and commits the whole turn on `complete`/`agent_end` → one smooth growing "Working" trace, no jumping groups.
- **MCP/tools in -p mode**: `--auto-approve` alone does NOT cover MCP tool calls; `--approval-mode=yolo` is required (else "requires approval but no interactive UI available").
- **Realtime TUI sync**: extension in the TUI mirrors streaming events over WS (token-level). Bridge ALSO polls the session JSONL (900ms) as a message-level fallback when no extension is attached.
- **Single-writer rule (KV-cache safety)**: if an extension connection owns a session, mobile `send` for it is REFUSED (fork instead). Prevents two omp processes diverging the prompt prefix and wrecking provider KV/prefix cache lineage.
- **Model catalog**: `omp models ls --json` = what the TUI shows (68 providers / ~2300 models). models.yml alone only had the pinned subset. Async refresh; never `spawnSync` (it wedged the event loop once).
- **Keyboard**: manual `keyboardDidShow/Hide` padding on the composer container. `KeyboardAvoidingView` is unreliable on RN 0.79 edge-to-edge (composer stuck up / behind IME).
- **Session restore**: last session id persisted on every bind; `restoreOrNew()` on mount replays it. Child effects run before App bootstrap, so the decision lives in the store, not in connect().
- **History tool rows**: omp JSONL uses block type `toolCall` (pi format), live stream uses `toolcall_*` sub-events with only `contentIndex` (name/id arrive at assistant `message_end` → reconciled by index).
- **Icons**: Ionicons via `useFonts(Ionicons.font)` at root — blank glyphs if `expo-file-system` missing (ExpoAsset download rejects).
- **Drawer**: always mounted, `pointerEvents` gated (unmount-on-hide cost a visible open delay; an always-mounted opacity-0 backdrop swallowed all touches once — never do that).

## Gotchas (bit us; keep respecting)

- `edit`-tool style string patches frequently duplicate lines here — verify with `npx tsc --noEmit` after every patch; prefer node one-shot patch scripts with exact anchors.
- Harness output garbles some identifiers into Unicode subscripts when DISPLAYING; files on disk are usually clean. Byte-scan (`[\u2090-\u209C\u1D62-\u1D6A\u2080-\u2089]`) before believing a "corruption".
- psmux `kill-session` does NOT kill bun/node children → stale bridge holds 9090 (EADDRINUSE) or wedges. Kill by PID (`powershell Stop-Process -Force`; `taskkill` failed on a wedged qemu).
- Wedged emulator adbd: `adb kill-server` won't fix; kill the qemu process (Stop-Process), delete `*.lock` in the AVD dir, relaunch.
- Emulator IME floats; measure tap targets from `uiautomator dump` content-desc bounds, never from screenshot pixels (letterbox scale varies per capture).
- omp `-p` needs EOF per turn → steering from mobile = client-side queue, auto-sent on commit.
- Session dir names encode cwd with `--` and may contain odd chars; match by `includes(sessionId)`.
- historySig dedupe: `loadSession`/`startNewSession` MUST reset `historySig`, else re-opening a session dedupe-skips its history push and renders an empty list (blank-load root cause, 2026-09-05).
- Never add scroll cascades or opacity reveal gates to MessageList's FlatList — they blanked rows on this RN version. HEAD's instant jump (delta>1 → `scrollToOffset(MAX, animated:false)`) is the stable anchoring.
- Completed turns: force tool-step status `done` when `!isStreaming`, else history rows show running dots.
- Optimistic user bubble: on a server guard error, pop it (match via `lastSendContent`) or a phantom turn lingers.
- Emulator IME floats and shifts the composer: re-dump content-desc bounds for Send before every tap.

## Build / test

```
server:  cd server && bun run src/index.ts          # port 9090, tunnel auto-start
mobile:  cd mobile/android && ./gradlew assembleRelease -PreactNativeArchitectures=x86_64|arm64-v8a
install: adb -s emulator-5554|192.168.1.108:5555 install -r app/build/outputs/apk/release/app-release.apk
typecheck: cd mobile && npx tsc --noEmit
```

Devices: emulator-5554 (x86_64, primary test target per user), tablet 192.168.1.108:5555 (arm64, user device — do not test there unprompted).

## Current state (2026-09-05)

Working end-to-end and verified on-device: live streaming trace (working/worked, reasoning + tool rows with ARGS/RESULT), full searchable model catalog + recents + reasoning levels, context ring + popover, drawer (virtualized, dir chips + per-row dir tags, search, long-press actions), session CRUD + fork, restore-on-relaunch, attachments, dictation, folder picker (navigate/create/use), steering queue with visible chip, TUI↔mobile token-level sync + single-writer guard, connecting/reconnecting indicator, flash-free session load (reveal gate + settle cascade + history dedupe).

Open/known: KaTeX block math via WebView (inline math = mono text); watcher fallback is message-level (~1s) when no TUI extension attached.
