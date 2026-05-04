# PixelVerse — 2D Metaverse
Initializing monorepo with pnpm workspaces.
## Database
PostgreSQL schema via Prisma: User, Space, Element, Map models.
## Auth
JWT-based signup and signin with role support (user/admin).
## Spaces API
CRUD REST endpoints for managing virtual spaces.
## Admin Routes
Admin-only endpoints for maps, avatars, and global elements.
## WebSocket Server
Real-time WS server with User class and RoomManager singleton.
## Movement
Real-time avatar movement with server-side validation and rejection.
## Redis Pub/Sub
Redis integration for horizontal WebSocket scaling across instances.
## Docker
Full Docker Compose setup: PostgreSQL, Redis, HTTP, WS services with healthchecks.
## Frontend
React + Vite frontend with auth page, dashboard, space management UI.
## 2D Arena
Canvas-based 2D arena with avatar rendering, furniture, WASD movement.
## Chat Features
Global chat + proximity chat (within 3 tiles). Display names from DB.
## CORS
Added cors middleware to Express API to allow frontend dev server requests.
## Multiplayer UX
Online users sidebar, join-by-space-ID modal, copy space ID to clipboard.
## Bug Fixes
Fixed WS protocol: userId in movement broadcasts, positions in space-joined payload. Fixed chat input focus steal.
## CORS
Added cors middleware to Express API to allow frontend dev server requests.
## Multiplayer UX
Online users sidebar, join-by-space-ID modal, copy space ID to clipboard.
## Bug Fixes
Fixed WS protocol: userId in movement broadcasts, positions in space-joined payload. Fixed chat input focus steal.
