# OMP Mobile

Remote control app for OMP (Oh My Pi) — control your AI coding agent from your phone.

## Architecture

```
┌─────────────┐     WebSocket      ┌──────────────┐     stdin/stdout     ┌─────────┐
│  Mobile App  │ ←────────────────→ │ Bridge Server │ ←─────────────────→ │ OMP CLI  │
│ (React Native)│   (JSON events)   │  (Bun + WS)  │   (--mode=json -p)  │          │
└─────────────┘                    └──────────────┘                     └─────────┘
                                         ↕
                                   Cloudflare Tunnel → Internet
```

- **Bridge Server** (`server/`): Bun-based WebSocket + REST server that spawns OMP processes, streams JSON events, manages sessions, and optionally exposes a Cloudflare tunnel for remote access.
- **Mobile App** (`mobile/`): React Native (Expo) app with Mantine-inspired gray dark theme. Connects to the bridge server via WebSocket, streams OMP responses, browses session history.

## Quick Start

### 1. Start the Bridge Server

```bash
cd server
bun install
bun run src/index.ts
```

The server prints an auth token on startup. Copy it — you'll need it for the mobile app.

### 2. Start the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Press `a` to launch on the Android emulator, or scan the QR code with Expo Go.

### 3. Connect

1. Open the app → Settings tab
2. Enter the server URL (e.g., `ws://192.168.1.100:9090`)
3. Paste the auth token
4. Tap Connect

### 4. Remote Access (Cloudflare Tunnel)

On the Home tab, tap "Start Tunnel" to create a Cloudflare quick tunnel. The tunnel URL appears on screen. Use it in Settings → Remote Tunnel to connect from anywhere.

## Bridge Server API

| Endpoint | Method | Description |
|---|---|---|
| `/api/status` | GET | Server status (OMP version, uptime, tunnel) |
| `/api/sessions` | GET | List all OMP sessions |
| `/api/sessions/:id` | GET | Get session message history |
| `/api/tunnel/start` | POST | Start Cloudflare tunnel |
| `/api/tunnel/stop` | POST | Stop Cloudflare tunnel |
| `/api/auth/token` | GET | Get auth token (for dev convenience) |

WebSocket commands: `send`, `cancel`, `list_sessions`, `get_history`, `get_status`, `start_tunnel`, `stop_tunnel`

## Requirements

- Node.js 18+ or Bun 1.3+
- OMP CLI installed and in PATH
- Android Studio (for emulator) or Expo Go (for physical device)
- Cloudflare `cloudflared` (for remote tunnel, installed via `winget install Cloudflare.cloudflared`)

## Tech Stack

- **Server**: Bun, WebSocket, node:child_process
- **Mobile**: React Native, Expo SDK 53, Zustand, React Navigation 7
- **Theme**: Mantine-inspired gray dark mode (custom design system)
- **Tunnel**: Cloudflare quick tunnel (no account needed)
