<div align="center">

# 🌐 PixelVerse

**Real-time 2D multiplayer metaverse — walk, chat, and vibe in virtual spaces.**

Move your avatar around a virtual office, meet teammates, and chat — globally or only with people standing next to you.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)

</div>

---

## 💡 The Idea

Most remote teams are stuck on Slack, Zoom, or Discord — communication is async, disconnected, and lacks the feeling of *being somewhere together*.

PixelVerse brings back the feeling of a physical office in a browser. You walk your avatar to a colleague's desk to have a private conversation (proximity chat), or shout something to the whole room (global chat). The visual, spatial nature changes how people communicate — it feels more natural, more human.

Think **Gather.town** — but open source, self-hostable, and built with a modern TypeScript stack from scratch.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  React + Vite App (Port 5173)                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │  Auth Page  │  │  Dashboard  │  │  2D Canvas Arena      │   │
│  │  signup /   │  │  Spaces     │  │  avatar movement      │   │
│  │  signin     │  │  CRUD UI    │  │  chat panel           │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│         │                │                     │               │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │  HTTP/REST      │  HTTP/REST           │  WebSocket
          ▼                ▼                      ▼
┌──────────────────┐              ┌───────────────────────────────┐
│  Express API     │              │  WebSocket Server             │
│  (Port 3000)     │              │  (Port 3001)                  │
│                  │              │                               │
│  /signup         │              │  on connect → new User()      │
│  /signin         │              │  on 'join'  → RoomManager     │
│  /space CRUD     │              │  on 'move'  → validate+bcast  │
│  /admin routes   │              │  on 'chat'  → broadcast all   │
│  JWT middleware  │              │  on 'prox-chat' → nearby only │
└────────┬─────────┘              └──────────────┬────────────────┘
         │                                       │
         │           ┌───────────────┐           │
         └──────────►│  PostgreSQL   │◄──────────┘
                     │  (Port 5432)  │
                     │               │
                     │  Users        │
                     │  Spaces       │
                     │  Elements     │
                     │  Maps         │
                     │  Avatars      │
                     └───────────────┘
                             │
                     ┌───────────────┐
                     │  Redis        │
                     │  (Port 6379)  │
                     │               │
                     │  Pub/Sub for  │
                     │  WS scaling   │
                     └───────────────┘
```

### Service Breakdown

| Service | Tech | Port | Responsibility |
|---------|------|------|----------------|
| **Frontend** | React 18, Vite, Canvas API, Vanilla CSS | `5173` | UI, avatar rendering, WebSocket client |
| **HTTP API** | Express.js, TypeScript, Prisma | `3000` | Auth, space management, REST endpoints |
| **WS Server** | `ws` library, TypeScript | `3001` | Real-time movement, chat broadcasting |
| **PostgreSQL** | PostgreSQL 16 (Alpine) | `5432→5433` | Persistent data storage |
| **Redis** | Redis 7 (Alpine) | `6379` | Pub/Sub for horizontal WS scaling |

---

## 📂 Monorepo Structure

```
metaverse/
├── apps/
│   ├── http/                  # Express REST API
│   │   └── src/
│   │       ├── index.ts       # App entry, CORS, middleware mount
│   │       ├── config.ts      # JWT secret
│   │       ├── middleware/
│   │       │   ├── user.ts    # JWT verify → req.userId
│   │       │   └── admin.ts   # Role check → admin only
│   │       └── routes/v1/
│   │           ├── user.ts    # /signup, /signin
│   │           ├── space.ts   # Space CRUD + element placement
│   │           └── admin.ts   # Map, avatar, element admin routes
│   │
│   ├── ws/                    # WebSocket real-time server
│   │   └── src/
│   │       ├── index.ts       # WS server bootstrap
│   │       ├── User.ts        # Per-connection state machine
│   │       ├── RoomManager.ts # Space → Users map (singleton)
│   │       ├── RedisManager.ts# Redis pub/sub wrapper
│   │       └── types.ts       # Shared message types
│   │
│   └── frontend/              # React + Vite client
│       └── src/
│           ├── App.tsx        # View router (auth/dashboard/arena)
│           ├── AuthPage.tsx   # Signup/signin form
│           ├── Dashboard.tsx  # Space list, create, join by ID
│           ├── Game.tsx       # 2D canvas arena + chat panel
│           ├── api.ts         # All HTTP fetch calls
│           └── components.tsx # Modal, Toast, Logo, Input, etc.
│
├── packages/
│   ├── db/                    # Prisma client (shared across services)
│   │   └── prisma/schema.prisma
│   ├── typescript-config/     # Shared tsconfig bases
│   ├── eslint-config/         # Shared ESLint rules
│   └── ui/                    # Shared React component library
│
├── docker-compose.yml         # Orchestrates all 5 services
└── turbo.json                 # Turborepo build pipeline
```

---

## 🔑 Core Concepts Explained

### 1. Authentication Flow

```
User → POST /signup { username, password, type }
     ← { userId }

User → POST /signin { username, password }
     ← { token }   ← JWT signed with JWT_PASSWORD

All protected routes:
User → GET /space/all  (Authorization: Bearer <token>)
     → middleware verifies JWT → extracts userId → req.userId
     ← spaces[]
```

Passwords are hashed using Node's built-in `scrypt` (no bcrypt dependency).
The JWT payload carries `{ userId, role }`.

---

### 2. Real-Time Movement — How It Works

Every browser tab that opens a space creates a **WebSocket connection** to port `3001`.

```
Browser                        WS Server
   │                               │
   │── { type: 'join',             │
   │    payload: {spaceId, token}} │
   │                               │── verify JWT
   │                               │── fetch space from DB
   │                               │── add User to RoomManager
   │◄─ { type: 'space-joined',    │
   │     payload: {                │
   │       spawn: {x, y},          │
   │       username,               │
   │       users: [{userId,x,y}]   │
   │     }}                        │
   │                               │
   │── { type: 'move',             │
   │    payload: {x: 5, y: 3}}     │
   │                               │── validate: |Δx|+|Δy| === 1?
   │                               │── YES: update position
   │                               │──── broadcast 'movement' to all others
   │                               │── NO: send 'movement-rejected'
   │◄─ { type: 'movement',        │
   │     payload: {userId,x,y}}    │
```

**Why validate on server?** Prevents cheating — a client can't teleport by sending `{x:99, y:99}`. The server only accepts moves of exactly 1 tile.

---

### 3. RoomManager — The Space Registry

`RoomManager` is a **singleton** that maps `spaceId → User[]`.

```typescript
class RoomManager {
  rooms: Map<string, User[]>  // spaceId → connected users

  addUser(spaceId, user)    // on join
  removeUser(user, spaceId) // on disconnect
  broadcast(msg, sender, spaceId)    // send to everyone except sender
  broadcastToRoom(msg, spaceId)      // send to literally everyone
}
```

When a user disconnects, `User.destroy()` broadcasts `user-left` to all remaining users so their avatars disappear from the canvas.

---

### 4. Redis Pub/Sub — Why It's There

If you run **multiple WS server instances** (horizontal scaling), users on instance A and users on instance B are in different processes — they can't talk to each other directly.

Redis bridges this:

```
User A (instance 1) moves
  → RoomManager.broadcast() publishes to Redis channel "room:spaceId"
    → All WS instances subscribed to that channel receive it
      → Each instance forwards it to their local users in that room
```

For a single instance (current setup), Redis is an overhead — but it makes the architecture **production-scalable** without code changes.

---

### 5. Proximity Chat — The Core Feature

When a user sends `{ type: 'proximity-chat' }`, the WS server **filters recipients server-side**:

```typescript
room.forEach(u => {
  const dist = Math.abs(u.x - this.x) + Math.abs(u.y - this.y);
  if (dist <= 3 || u.id === this.id) {  // Manhattan distance
    u.send({ type: 'proximity-chat', payload: { ... } });
  }
});
```

Only users within **3 tiles** (Manhattan distance) receive the message. Users further away never see it — true spatial communication.

---

### 6. Canvas Rendering

The arena is drawn on an HTML5 `<canvas>` element using the **2D Context API** — no game engine, no library.

Every state update (move, user joins, user leaves) triggers a full canvas redraw:

```
State changes (React)
  → useEffect runs drawScene()
    → ctx.fillRect()      // background + floor tiles
    → drawFurniture()     // emoji items at fixed positions
    → drawGrid()          // purple grid lines
    → drawProximityRing() // dashed circle around self
    → drawAvatar() × N    // for each user
```

Avatars are drawn with:
- Radial gradient fill (lighten center → base color)
- Drop shadow glow (`ctx.shadowBlur`)
- Emoji character for the face
- Name tag badge underneath

---

## 🚀 Running Locally

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ & pnpm

### 1. Start all backend services
```bash
docker compose up --build
```
This starts PostgreSQL, Redis, the Express API, and WS server. Prisma migrations run automatically.

### 2. Start the frontend
```bash
cd apps/frontend
pnpm install
pnpm run dev
```

Open **http://localhost:5173**

---

## 🧪 Testing Multiplayer

1. Open **http://localhost:5173** in a normal window → Sign up as `user1`
2. Create a space → Click 📋 to copy the Space ID
3. Open **http://localhost:5173** in an **Incognito window** → Sign up as `user2`
4. Click **🔗 Join by ID** → Paste the Space ID
5. Move both avatars close together (within 3 tiles)
6. Switch to the **👋 Nearby** chat tab → Send a proximity message
7. Only `user1` and `user2` receive it if they're within range

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Body | Response |
|--------|----------|------|----------|
| `POST` | `/api/v1/signup` | `{username, password, type}` | `{userId}` |
| `POST` | `/api/v1/signin` | `{username, password}` | `{token}` |

### Spaces (Auth required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/space` | Create a space `{name, dimensions}` |
| `GET` | `/api/v1/space/all` | List your spaces |
| `GET` | `/api/v1/space/:id` | Get space + elements |
| `DELETE` | `/api/v1/space/:id` | Delete a space |
| `POST` | `/api/v1/space/element` | Add element to space |
| `DELETE` | `/api/v1/space/element/:id` | Remove element from space |

### WebSocket Events
| Direction | Type | Payload |
|-----------|------|---------|
| Client → Server | `join` | `{spaceId, token}` |
| Client → Server | `move` | `{x, y}` |
| Client → Server | `chat` | `{message}` |
| Client → Server | `proximity-chat` | `{message}` |
| Server → Client | `space-joined` | `{spawn, username, users[]}` |
| Server → Client | `user-joined` | `{userId, username, x, y}` |
| Server → Client | `movement` | `{userId, username, x, y}` |
| Server → Client | `movement-rejected` | `{x, y}` |
| Server → Client | `user-left` | `{userId}` |
| Server → Client | `chat` | `{userId, username, message, timestamp}` |
| Server → Client | `proximity-chat` | `{userId, username, message, x, y, timestamp}` |

---

## 🗄️ Database Schema

```prisma
model User {
  id       String  @id @default(cuid())
  username String  @unique
  password String
  role     Role    @default(User)
  avatar   Avatar? @relation(fields: [avatarId], references: [id])
  spaces   Space[]
}

model Space {
  id        String         @id @default(cuid())
  name      String
  width     Int
  height    Int
  creator   User           @relation(fields: [creatorId], references: [id])
  elements  SpaceElements[]
  thumbnail String?
}

model Element {
  id       String @id @default(cuid())
  width    Int
  height   Int
  imageUrl String
  static   Boolean
}

model Map {
  id         String       @id @default(cuid())
  width      Int
  height     Int
  name       String
  mapElements MapElements[]
  thumbnail  String?
}
```

---

## 📦 Port Reference

| Service | Local Port | Docker Internal |
|---------|-----------|-----------------|
| Frontend (Vite) | `5173` | — |
| HTTP API | `3000` | `3000` |
| WebSocket | `3001` | `3001` |
| PostgreSQL | `5433` | `5432` |
| Redis | `6379` | `6379` |

---

## 🚧 What Can Be Added Next

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Floating emoji reactions | 🟢 Easy | Canvas animation, no server changes |
| Click-to-move | 🟢 Easy | Canvas click → calculate tile → send move |
| Mini-map | 🟢 Easy | Small corner canvas showing all user dots |
| Avatar picker | 🟡 Medium | Store in DB, send on join |
| Shareable space URL | 🟡 Medium | `/join/:spaceId` route in React |
| Interactive tiles (YouTube embed) | 🟡 Medium | Zone detection on canvas click |
| Proximity voice chat | 🔴 Hard | WebRTC + STUN/TURN server required |
| Horizontal WS scaling | 🔴 Hard | Redis already set up — just add load balancer |

---

<div align="center">
Built with TypeScript, React, Node.js, PostgreSQL, Redis & Docker
</div>
