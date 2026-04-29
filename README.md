# Airlink Manager

Self-hosted Linux server management dashboard built around a root daemon and per-session privilege-dropped bridge.

## Commands

- `airlink --daemon` starts the HTTPS web server and WebSocket bridge manager.
- `airlink --bridge --uid=N --gid=N` starts the per-user worker process.
- `airlink install` performs first-run setup: TLS, SQLite DB, owner role, app secret, addon signing key, and systemd unit.

## Development

```bash
bun install
cd frontend && bun install
cd ..
bun run dev:all
```

## Build

```bash
bun run build
```

The build script type-checks, builds the frontend, runs tests, then compiles Linux x64 and arm64 binaries.

## Security Model

The daemon authenticates OS users, owns sessions, serves HTTPS, and proxies browser WebSocket frames. The bridge runs as the logged-in user's UID/GID and performs terminal, file, metrics, systemd, Docker, and user operations under native OS permissions. All subprocess calls use argument arrays with no shell expansion.

Auth uses HttpOnly Strict SameSite cookies, CSRF double-submit tokens, short-lived in-memory WebSocket JWTs, session fingerprinting, role checks, and append-only audit logs.
