# DevCollab - Software Requirements Specification (SRS)
# ============================================
# Version: 1.0
# Date: 2026-07-27
# Purpose: Cursor AI Coding Rules & Project Specification
# Architecture: Backend-First (100% backend before frontend)
# ============================================

# ============================================
# 1. PROJECT OVERVIEW
# ============================================

## 1.1 Project Name
DevCollab - Real-time Collaborative Code Editor

## 1.2 Description
A real-time collaborative code editor where multiple developers can write,
view, and execute code together live. Features include live cursors, in-browser
code execution, AI-powered code assistance, and video/voice chat.

## 1.3 Architecture Philosophy
- BACKEND-FIRST: Complete 100% backend before ANY frontend work
- ZERO-COST: All services use free tiers
- CURSOR-OPTIMIZED: Modular, well-documented, AI-friendly code
- TYPE-SAFE: Strict TypeScript everywhere

## 1.4 Target Users
- Software developers collaborating on code
- Coding bootcamp students
- Technical interview practice pairs
- Open-source contributors

# ============================================
# 2. TECH STACK
# ============================================

## 2.1 Frontend (Phase 2 - DO NOT START YET)
- Framework: Next.js 15 (App Router)
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS v4
- UI Components: shadcn/ui
- State: Zustand
- Editor: Monaco Editor (@monaco-editor/react)
- Real-time Client: yjs, y-websocket

## 2.2 Backend (Phase 1 - START HERE)
- Runtime: Node.js 20+
- Framework: Express.js 4.x
- Language: TypeScript (strict mode)
- Database: PostgreSQL (Neon - free tier)
- ORM: Prisma 5.x
- Cache: Redis (Upstash - free tier)
- Real-time: Custom WebSocket server + Yjs
- Auth: Auth.js (NextAuth v5) - GitHub OAuth
- AI: Ollama (local) / Groq API (free tier)
- Execution: Judge0 API (free tier)

## 2.3 Infrastructure
- Frontend Hosting: Vercel (Hobby - free)
- Backend Hosting: Render / Railway (free tier)
- Domain: *.vercel.app, *.onrender.com (free subdomains)
- CDN: Cloudflare (free)

# ============================================
# 3. PROJECT STRUCTURE
# ============================================

```
devcollab/
├── .cursor/
│   └── rules.md                    # THIS FILE
│
├── apps/
│   ├── ws-server/                  # BACKEND - Phase 1
│   │   ├── src/
│   │   │   ├── config/
│   │   │   │   ├── database.ts     # Prisma client singleton
│   │   │   │   ├── redis.ts        # Redis client
│   │   │   │   ├── env.ts          # Environment validation (Zod)
│   │   │   │   └── logger.ts       # Pino logger setup
│   │   │   │
│   │   │   ├── prisma/
│   │   │   │   └── schema.prisma   # Database schema
│   │   │   │
│   │   │   ├── types/
│   │   │   │   └── index.ts        # Global TypeScript types
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   ├── validators.ts   # Zod schemas
│   │   │   │   ├── errors.ts       # Custom error classes
│   │   │   │   └── helpers.ts      # Utility functions
│   │   │   │
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts         # JWT/session verification
│   │   │   │   ├── error-handler.ts # Centralized error handling
│   │   │   │   ├── rate-limit.ts   # Rate limiting middleware
│   │   │   │   └── validate.ts     # Request validation wrapper
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── room.service.ts      # Room business logic
│   │   │   │   ├── user.service.ts      # User business logic
│   │   │   │   ├── execution.service.ts   # Code execution logic
│   │   │   │   ├── ai.service.ts        # AI completion logic
│   │   │   │   └── document.service.ts  # Yjs document persistence
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── index.ts        # Route aggregator
│   │   │   │   ├── auth.routes.ts  # Authentication routes
│   │   │   │   ├── room.routes.ts  # Room CRUD routes
│   │   │   │   ├── execute.routes.ts # Code execution routes
│   │   │   │   └── ai.routes.ts    # AI assistant routes
│   │   │   │
│   │   │   ├── websocket/
│   │   │   │   ├── server.ts       # WebSocket server setup
│   │   │   │   ├── connection.ts   # Connection manager
│   │   │   │   ├── handlers/
│   │   │   │   │   ├── room.handler.ts      # Room join/leave
│   │   │   │   │   ├── document.handler.ts  # Yjs document sync
│   │   │   │   │   ├── awareness.handler.ts # Cursor/typing
│   │   │   │   │   └── chat.handler.ts      # Room chat messages
│   │   │   │   └── managers/
│   │   │   │       ├── document-manager.ts  # Yjs doc lifecycle
│   │   │   │       ├── awareness-manager.ts # User presence
│   │   │   │       └── room-manager.ts      # Room state management
│   │   │   │
│   │   │   └── app.ts              # Express app entry point
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   │   ├── services/
│   │   │   │   └── utils/
│   │   │   ├── integration/
│   │   │   │   ├── auth.test.ts
│   │   │   │   ├── room.test.ts
│   │   │   │   └── websocket.test.ts
│   │   │   └── setup.ts
│   │   │
│   │   ├── .env.example
│   │   ├── .env.local
│   │   ├── docker-compose.yml      # Local dev: Postgres + Redis
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── web/                        # FRONTEND - Phase 2 (DO NOT START)
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   └── types/
│       ├── package.json
│       └── next.config.ts
│
├── packages/
│   └── shared-types/               # Shared between backend & frontend
│       ├── src/
│       │   ├── api.ts              # API response types
│       │   ├── websocket.ts        # WS message types
│       │   ├── models.ts           # Database model types
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml              # Root: Full stack local dev
├── turbo.json                      # Turborepo config
├── package.json                    # Root package.json (workspaces)
└── README.md
```

# ============================================
# 4. DATABASE SCHEMA (Prisma)
# ============================================

## 4.1 Complete Schema Definition

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MODEL
// ============================================
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String
  avatar        String?  // GitHub avatar URL
  githubId      String   @unique

  // Relations
  ownedRooms    Room[]        @relation("RoomOwner")
  memberships   RoomMember[]
  executions    Execution[]
  messages      ChatMessage[]

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([email])
  @@index([githubId])
  @@map("users")
}

// ============================================
// ROOM MODEL
// ============================================
model Room {
  id            String    @id @default(uuid())
  name          String
  slug          String    @unique // URL-friendly: "my-awesome-room"
  description   String?
  language      String    @default("javascript") // javascript, python, typescript, etc.

  // Visibility
  isPublic      Boolean   @default(true)

  // Relations
  ownerId       String
  owner         User      @relation("RoomOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members       RoomMember[]
  documents     Document[]
  executions    Execution[]
  messages      ChatMessage[]

  // Yjs document state (latest version)
  yjsState      Bytes?    // Binary Yjs document state

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([slug])
  @@index([ownerId])
  @@index([isPublic])
  @@map("rooms")
}

// ============================================
// ROOM MEMBER MODEL (Junction Table)
// ============================================
model RoomMember {
  id        String      @id @default(uuid())
  roomId    String
  userId    String
  role      MemberRole  @default(EDITOR)

  // Relations
  room      Room        @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  joinedAt  DateTime    @default(now())

  @@unique([roomId, userId])
  @@index([roomId])
  @@index([userId])
  @@map("room_members")
}

enum MemberRole {
  OWNER   // Full control
  EDITOR  // Can edit code
  VIEWER  // Read-only
}

// ============================================
// DOCUMENT MODEL (Version History)
// ============================================
model Document {
  id        String   @id @default(uuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)

  // Yjs document state at this version
  yjsState  Bytes

  // Version info
  version   Int
  snapshot  String?  // Human-readable snapshot for debugging

  createdAt DateTime @default(now())

  @@unique([roomId, version])
  @@index([roomId])
  @@index([createdAt])
  @@map("documents")
}

// ============================================
// EXECUTION MODEL (Code Run History)
// ============================================
model Execution {
  id          String   @id @default(uuid())
  roomId      String
  room        Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)

  // Code that was executed
  code        String   @db.Text
  language    String

  // Results
  output      String?  @db.Text
  error       String?  @db.Text
  status      ExecutionStatus @default(PENDING)

  // Metadata
  executedById String
  executedBy  User     @relation(fields: [executedById], references: [id])
  executionTime Int?   // milliseconds

  createdAt   DateTime @default(now())

  @@index([roomId])
  @@index([executedById])
  @@index([createdAt])
  @@map("executions")
}

enum ExecutionStatus {
  PENDING
  RUNNING
  SUCCESS
  ERROR
  TIMEOUT
}

// ============================================
// CHAT MESSAGE MODEL (Room Chat)
// ============================================
model ChatMessage {
  id        String   @id @default(uuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  content   String

  createdAt DateTime @default(now())

  @@index([roomId])
  @@index([createdAt])
  @@map("chat_messages")
}
```

# ============================================
# 5. API SPECIFICATION
# ============================================

## 5.1 Base URL
- Development: `http://localhost:3001`
- Production: `https://api-devcollab.onrender.com`

## 5.2 Authentication
All routes except `/api/auth/*` require Bearer token or session cookie.

## 5.3 Response Format
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}
```

## 5.4 Route Definitions

### AUTH ROUTES
```
POST   /api/auth/signin
  Body: { provider: "github" }
  Response: { url: "https://github.com/oauth/..." }

POST   /api/auth/callback/github
  Query: { code: string, state: string }
  Response: { user: User, token: string }

POST   /api/auth/signout
  Response: { success: true }

GET    /api/auth/session
  Response: { user: User | null }
```

### ROOM ROUTES
```
POST   /api/rooms
  Body: { name: string, description?: string, language?: string, isPublic?: boolean }
  Response: { room: Room }
  Auth: Required

GET    /api/rooms
  Query: { page?: number, limit?: number, search?: string }
  Response: { rooms: Room[], meta: PaginationMeta }
  Auth: Required

GET    /api/rooms/:slug
  Response: { room: RoomWithMembers }
  Auth: Required (public rooms viewable by anyone)

PUT    /api/rooms/:slug
  Body: { name?: string, description?: string, language?: string, isPublic?: boolean }
  Response: { room: Room }
  Auth: Required (OWNER only)

DELETE /api/rooms/:slug
  Response: { success: true }
  Auth: Required (OWNER only)

POST   /api/rooms/:slug/join
  Response: { membership: RoomMember }
  Auth: Required

POST   /api/rooms/:slug/leave
  Response: { success: true }
  Auth: Required

POST   /api/rooms/:slug/members/:userId/role
  Body: { role: MemberRole }
  Response: { membership: RoomMember }
  Auth: Required (OWNER only)

DELETE /api/rooms/:slug/members/:userId
  Response: { success: true }
  Auth: Required (OWNER only)
```

### EXECUTION ROUTES
```
POST   /api/execute
  Body: { roomId: string, code: string, language: string }
  Response: { execution: Execution }
  Auth: Required
  Rate Limit: 10/minute per user

GET    /api/execute/history/:roomId
  Query: { page?: number, limit?: number }
  Response: { executions: Execution[], meta: PaginationMeta }
  Auth: Required (room member)
```

### AI ROUTES
```
POST   /api/ai/complete
  Body: { code: string, language: string, cursorPosition: { line: number, ch: number } }
  Response: Stream SSE { completion: string }
  Auth: Required
  Rate Limit: 30/minute per user

POST   /api/ai/explain
  Body: { code: string, language: string }
  Response: { explanation: string }
  Auth: Required
  Rate Limit: 20/minute per user
```

# ============================================
# 6. WEBSOCKET PROTOCOL
# ============================================

## 6.1 Connection URL
```
ws://localhost:3001/ws?token=<jwt_token>&roomId=<room_id>
```

## 6.2 Message Types

### Client → Server
```typescript
// JOIN_ROOM
interface JoinRoomMessage {
  type: "JOIN_ROOM";
  payload: {
    roomId: string;
  };
}

// LEAVE_ROOM
interface LeaveRoomMessage {
  type: "LEAVE_ROOM";
  payload: {
    roomId: string;
  };
}

// DOC_UPDATE (Yjs update)
interface DocUpdateMessage {
  type: "DOC_UPDATE";
  payload: {
    roomId: string;
    update: number[]; // Uint8Array as array
  };
}

// CURSOR_MOVE
interface CursorMoveMessage {
  type: "CURSOR_MOVE";
  payload: {
    roomId: string;
    position: {
      line: number;
      ch: number;
    };
    selection?: {
      anchor: { line: number; ch: number };
      head: { line: number; ch: number };
    };
  };
}

// USER_TYPING
interface UserTypingMessage {
  type: "USER_TYPING";
  payload: {
    roomId: string;
    isTyping: boolean;
  };
}

// CHAT_MESSAGE
interface ChatMessage {
  type: "CHAT_MESSAGE";
  payload: {
    roomId: string;
    content: string;
  };
}

// REQUEST_DOC_SYNC
interface RequestDocSyncMessage {
  type: "REQUEST_DOC_SYNC";
  payload: {
    roomId: string;
  };
}
```

### Server → Client
```typescript
// USER_JOINED
interface UserJoinedMessage {
  type: "USER_JOINED";
  payload: {
    user: {
      id: string;
      name: string;
      avatar?: string;
      color: string; // Assigned cursor color
    };
    timestamp: string;
  };
}

// USER_LEFT
interface UserLeftMessage {
  type: "USER_LEFT";
  payload: {
    userId: string;
    timestamp: string;
  };
}

// DOC_SYNC (Yjs state vector)
interface DocSyncMessage {
  type: "DOC_SYNC";
  payload: {
    roomId: string;
    update: number[]; // Uint8Array as array
  };
}

// CURSOR_UPDATE
interface CursorUpdateMessage {
  type: "CURSOR_UPDATE";
  payload: {
    userId: string;
    userName: string;
    color: string;
    position: {
      line: number;
      ch: number;
    };
    selection?: {
      anchor: { line: number; ch: number };
      head: { line: number; ch: number };
    };
  };
}

// AWARENESS_UPDATE
interface AwarenessUpdateMessage {
  type: "AWARENESS_UPDATE";
  payload: {
    roomId: string;
    users: Array<{
      userId: string;
      name: string;
      color: string;
      cursor?: { line: number; ch: number };
      isTyping: boolean;
      lastSeen: string;
    }>;
  };
}

// CHAT_MESSAGE_BROADCAST
interface ChatMessageBroadcast {
  type: "CHAT_MESSAGE_BROADCAST";
  payload: {
    id: string;
    userId: string;
    userName: string;
    avatar?: string;
    content: string;
    createdAt: string;
  };
}

// ERROR
interface ErrorMessage {
  type: "ERROR";
  payload: {
    code: string;
    message: string;
  };
}
```

## 6.3 Connection Lifecycle
```
1. Client connects with JWT token
2. Server validates token → identifies user
3. Client sends JOIN_ROOM with roomId
4. Server:
   a. Validates room access
   b. Adds user to room
   c. Broadcasts USER_JOINED to all room members
   d. Sends current DOC_SYNC (Yjs state)
   e. Sends AWARENESS_UPDATE with all active users
5. Client receives DOC_SYNC → initializes Yjs document
6. Normal operation: DOC_UPDATE, CURSOR_MOVE, CHAT_MESSAGE
7. Client disconnects → Server broadcasts USER_LEFT
```

# ============================================
# 7. AI INTEGRATION SPEC
# ============================================

## 7.1 Ollama (Primary - Local)
```
Endpoint: POST http://localhost:11434/api/generate
Model: llama3.1:8b (or codellama:7b)
```

### Request Format
```json
{
  "model": "llama3.1:8b",
  "prompt": "Complete this code:

function fibonacci(n) {
  // Your completion here
}",
  "stream": false,
  "options": {
    "temperature": 0.2,
    "num_predict": 100
  }
}
```

### Response Format
```json
{
  "response": "  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);",
  "done": true
}
```

## 7.2 Groq API (Fallback - Cloud)
```
Endpoint: POST https://api.groq.com/openai/v1/chat/completions
Model: llama-3.1-8b-instant
```

### Request Format
```json
{
  "model": "llama-3.1-8b-instant",
  "messages": [
    {
      "role": "system",
      "content": "You are a code completion assistant. Complete the code concisely."
    },
    {
      "role": "user",
      "content": "Complete this JavaScript function:

function factorial(n) {
  // complete
}"
    }
  ],
  "stream": true,
  "max_tokens": 150,
  "temperature": 0.2
}
```

## 7.3 Streaming Response (SSE)
```
Content-Type: text/event-stream

Data format:
data: {"completion": "if (n <= 1)"}


data: {"completion": " return 1;"}


data: {"completion": " return n * factorial(n - 1);"}


data: [DONE]


```

# ============================================
# 8. CODE EXECUTION SPEC (Judge0)
# ============================================

## 8.1 Supported Languages
| Language | Judge0 ID | File Extension |
|----------|-----------|----------------|
| JavaScript | 63 | .js |
| TypeScript | 74 | .ts |
| Python 3 | 71 | .py |
| Java | 62 | .java |
| C++ | 54 | .cpp |
| Go | 60 | .go |
| Rust | 73 | .rs |

## 8.2 API Flow
```
1. POST /submissions (create submission)
   Body: { source_code, language_id, stdin }
   Response: { token }

2. GET /submissions/{token} (poll for result)
   Response: { stdout, stderr, status, time, memory }
```

## 8.3 Status Codes
```
1: In Queue
2: Processing
3: Accepted
4: Wrong Answer
5: Time Limit Exceeded
6: Compilation Error
7: Runtime Error (SIGSEGV)
8: Runtime Error (SIGXFSZ)
9: Runtime Error (SIGFPE)
10: Runtime Error (SIGABRT)
11: Runtime Error (NZEC)
12: Runtime Error (Other)
13: Internal Error
14: Exec Format Error
```

## 8.4 Free Tier Limits
- 50 submissions/day
- 5 second execution time
- 128MB memory limit

# ============================================
# 9. ENVIRONMENT VARIABLES
# ============================================

## 9.1 Required Variables
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/devcollab?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
GITHUB_CLIENT_ID="your_github_client_id"
GITHUB_CLIENT_SECRET="your_github_client_secret"
NEXTAUTH_SECRET="your_random_secret_key"
NEXTAUTH_URL="http://localhost:3001"

# Server
PORT=3001
NODE_ENV=development

# AI
OLLAMA_URL="http://localhost:11434"
GROQ_API_KEY="your_groq_api_key"  # Fallback

# Execution
JUDGE0_API_URL="https://judge0-ce.p.rapidapi.com"
JUDGE0_API_KEY="your_judge0_api_key"

# Logging
LOG_LEVEL=debug
```

## 9.2 Environment Validation (Zod)
```typescript
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  PORT: z.string().default("3001"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OLLAMA_URL: z.string().url().default("http://localhost:11434"),
  GROQ_API_KEY: z.string().optional(),
  JUDGE0_API_URL: z.string().url(),
  JUDGE0_API_KEY: z.string().min(1),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});
```

# ============================================
# 10. CODING STANDARDS
# ============================================

## 10.1 TypeScript Rules
```typescript
// STRICT MODE - Always enabled
"strict": true
"noImplicitAny": true
"strictNullChecks": true
"noImplicitReturns": true
"noFallthroughCasesInSwitch": true
```

## 10.2 Naming Conventions
```typescript
// Files: kebab-case
// user.service.ts, room-manager.ts

// Classes: PascalCase
class RoomManager {}
class DocumentService {}

// Interfaces: PascalCase with I prefix (optional)
interface IRoomConfig {}

// Types: PascalCase
type RoomResponse = { ... }

// Functions: camelCase
function createRoom() {}
function handleWebSocketMessage() {}

// Constants: UPPER_SNAKE_CASE (for true constants)
const MAX_ROOM_SIZE = 50;
const WS_HEARTBEAT_INTERVAL = 30000;

// Variables: camelCase
const roomManager = new RoomManager();
const isUserConnected = true;

// Private methods: _prefix
class RoomManager {
  private _cleanupInterval: NodeJS.Timeout;
  private _broadcastToRoom() {}
}
```

## 10.3 Function Rules
```typescript
// ALWAYS explicit return types
function calculateRoomSize(roomId: string): Promise<number> {
  return prisma.roomMember.count({ where: { roomId } });
}

// Async functions must handle errors
async function getRoomBySlug(slug: string): Promise<Room | null> {
  try {
    return await prisma.room.findUnique({ where: { slug } });
  } catch (error) {
    logger.error({ error, slug }, "Failed to get room");
    throw new DatabaseError("Failed to retrieve room");
  }
}

// Never use `any`
// ❌ Bad
function processData(data: any): any { ... }

// ✅ Good
function processData(data: RoomInput): RoomOutput { ... }
```

## 10.4 Error Handling Pattern
```typescript
// Custom Error Classes
class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, string[]>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, string[]>) {
    super("VALIDATION_ERROR", message, 400, details);
  }
}

class NotFoundError extends AppError {
  constructor(resource: string) {
    super("NOT_FOUND", `${resource} not found`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super("UNAUTHORIZED", message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super("FORBIDDEN", message, 403);
  }
}

// Usage in services
async function updateRoom(slug: string, userId: string, data: UpdateRoomInput) {
  const room = await prisma.room.findUnique({ where: { slug } });
  if (!room) throw new NotFoundError("Room");
  if (room.ownerId !== userId) throw new ForbiddenError("Only owner can update");

  return await prisma.room.update({ where: { slug }, data });
}
```

## 10.5 Zod Validation Pattern
```typescript
// validators/room.validator.ts
import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.enum(["javascript", "typescript", "python", "java", "cpp", "go", "rust"]).default("javascript"),
  isPublic: z.boolean().default(true),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;

// Usage in route
import { validate } from "../middleware/validate";

router.post("/", validate(createRoomSchema), roomController.create);
```

## 10.6 Middleware Pattern
```typescript
// middleware/validate.ts
import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError } from "zod";
import { ValidationError } from "../utils/errors";

export function validate<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details: Record<string, string[]> = {};
        error.errors.forEach((err) => {
          const path = err.path.join(".");
          if (!details[path]) details[path] = [];
          details[path].push(err.message);
        });
        next(new ValidationError("Validation failed", details));
      } else {
        next(error);
      }
    }
  };
}
```

## 10.7 Logger Configuration (Pino)
```typescript
// config/logger.ts
import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "development" 
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
  base: { pid: process.pid, env: process.env.NODE_ENV },
});

// Usage
logger.info({ roomId, userId }, "User joined room");
logger.error({ error, roomId }, "Failed to save document");
logger.debug({ updateSize: update.length }, "Document update received");
```

# ============================================
# 11. WEBSOCKET IMPLEMENTATION DETAILS
# ============================================

## 11.1 Connection Manager
```typescript
// websocket/connection.ts
interface Connection {
  ws: WebSocket;
  userId: string;
  userName: string;
  userAvatar?: string;
  roomId?: string;
  color: string;
  isAlive: boolean;
  lastActivity: Date;
}

class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map();

  addConnection(connId: string, conn: Connection): void;
  removeConnection(connId: string): void;
  joinRoom(connId: string, roomId: string): void;
  leaveRoom(connId: string): void;
  broadcastToRoom(roomId: string, message: WebSocketMessage, exclude?: string): void;
  getRoomMembers(roomId: string): Connection[];
  getConnectionCount(): number;
}
```

## 11.2 Yjs Document Manager
```typescript
// websocket/managers/document-manager.ts
import * as Y from "yjs";

interface RoomDocument {
  doc: Y.Doc;
  yText: Y.Text;
  updateHandler: (update: Uint8Array, origin: any) => void;
  lastPersisted: Date;
}

class DocumentManager {
  private documents: Map<string, RoomDocument> = new Map();

  getOrCreateDocument(roomId: string): Y.Doc;
  applyUpdate(roomId: string, update: Uint8Array, origin?: string): void;
  getDocumentState(roomId: string): Uint8Array;
  getDocumentText(roomId: string): string;
  persistDocument(roomId: string): Promise<void>;
  cleanupInactiveDocuments(maxAgeMs: number): void;
}
```

## 11.3 Awareness Manager
```typescript
// websocket/managers/awareness-manager.ts
interface AwarenessState {
  userId: string;
  name: string;
  color: string;
  cursor?: { line: number; ch: number };
  selection?: { anchor: Position; head: Position };
  isTyping: boolean;
  lastSeen: Date;
}

class AwarenessManager {
  private states: Map<string, Map<string, AwarenessState>> = new Map();
  // roomId -> (userId -> AwarenessState)

  updateCursor(roomId: string, userId: string, position: Position): void;
  updateTyping(roomId: string, userId: string, isTyping: boolean): void;
  getRoomAwareness(roomId: string): AwarenessState[];
  removeUser(roomId: string, userId: string): void;
  broadcastAwareness(roomId: string): void;
}
```

## 11.4 Heartbeat / Ping-Pong
```typescript
// Server sends ping every 30 seconds
// Client must respond with pong within 10 seconds
// Otherwise, connection is terminated

const WS_HEARTBEAT_INTERVAL = 30000;
const WS_HEARTBEAT_TIMEOUT = 10000;

// Implementation
ws.on("pong", () => {
  conn.isAlive = true;
});

const interval = setInterval(() => {
  connections.forEach((conn, connId) => {
    if (!conn.isAlive) {
      ws.terminate();
      connectionManager.removeConnection(connId);
      return;
    }
    conn.isAlive = false;
    ws.ping();
  });
}, WS_HEARTBEAT_INTERVAL);
```

# ============================================
# 12. RATE LIMITING
# ============================================

## 12.1 Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| Auth routes | 5 requests | 1 minute |
| Room creation | 10 requests | 1 hour |
| Code execution | 10 requests | 1 minute |
| AI completion | 30 requests | 1 minute |
| AI explanation | 20 requests | 1 minute |
| WebSocket messages | 100 messages | 1 minute |

## 12.2 Implementation (Redis-based)
```typescript
// middleware/rate-limit.ts
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL);

const rateLimiters = {
  auth: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "ratelimit_auth",
    points: 5,
    duration: 60,
  }),
  execution: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "ratelimit_execution",
    points: 10,
    duration: 60,
  }),
  ai: new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: "ratelimit_ai",
    points: 30,
    duration: 60,
  }),
};
```

# ============================================
# 13. TESTING STRATEGY
# ============================================

## 13.1 Unit Tests
- Services: Jest + ts-jest
- Mock Prisma client
- Mock external APIs (Judge0, Ollama)

## 13.2 Integration Tests
- Supertest for HTTP routes
- ws library for WebSocket testing
- Test database (separate Neon project or SQLite)

## 13.3 Test File Naming
```
services/room.service.test.ts
routes/auth.routes.test.ts
websocket/handlers/room.handler.test.ts
```

## 13.4 Coverage Requirements
- Minimum 80% line coverage
- 100% coverage for critical paths (auth, room access)

# ============================================
# 14. DOCKER SETUP
# ============================================

## 14.1 docker-compose.yml (Local Dev)
```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: devcollab
      POSTGRES_PASSWORD: devcollab
      POSTGRES_DB: devcollab
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    # For GPU support (optional):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

volumes:
  postgres_data:
  redis_data:
  ollama_data:
```

## 14.2 Dockerfile (Production)
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3001
CMD ["node", "dist/app.js"]
```

# ============================================
# 15. DEPLOYMENT CHECKLIST
# ============================================

## 15.1 Pre-deployment
- [ ] All tests passing
- [ ] Prisma migrations applied
- [ ] Environment variables configured
- [ ] Rate limits configured
- [ ] CORS origins set
- [ ] SSL certificate ready

## 15.2 Render Deployment Steps
1. Create new Web Service
2. Connect GitHub repo
3. Set build command: `npm install && npx prisma generate && npm run build`
4. Set start command: `npm start`
5. Add environment variables
6. Deploy

## 15.3 Neon Database Setup
1. Create new project
2. Copy connection string
3. Run `npx prisma migrate deploy`
4. Verify connection

# ============================================
# 16. CURSOR AI CODING PROMPTS
# ============================================

## Prompt 1: Project Initialization
```
Create a Turborepo monorepo for "devcollab" with:
- apps/ws-server: Node.js + Express + TypeScript backend
- packages/shared-types: Common TypeScript types
- Root: package.json with workspaces, turbo.json for caching

Use TypeScript strict mode. Include ESLint, Prettier.
DO NOT create any frontend code.
```

## Prompt 2: Database Setup
```
In apps/ws-server, create:
1. Prisma schema with ALL models from .cursor/rules.md Section 4
2. Database config with singleton PrismaClient
3. Environment validation using Zod (Section 9)
4. Logger setup using Pino (Section 10.7)
5. docker-compose.yml with PostgreSQL and Redis

Generate initial migration. Add seed data for testing.
```

## Prompt 3: Error Handling & Middleware
```
In apps/ws-server, create:
1. Custom error classes (Section 10.4)
2. Centralized error handler middleware
3. Zod validation middleware (Section 10.6)
4. Rate limiting middleware (Section 12)
5. Auth middleware (JWT verification)

All middleware must follow the patterns in .cursor/rules.md.
```

## Prompt 4: Service Layer
```
In apps/ws-server/src/services, create:
1. room.service.ts - Room CRUD with access control
2. user.service.ts - User management
3. execution.service.ts - Judge0 integration
4. ai.service.ts - Ollama + Groq integration with fallback
5. document.service.ts - Yjs document persistence

Use explicit return types. Handle all errors. Log all operations.
```

## Prompt 5: REST API Routes
```
In apps/ws-server/src/routes, create ALL routes from Section 5:
1. auth.routes.ts - GitHub OAuth with Auth.js
2. room.routes.ts - Full CRUD + membership
3. execute.routes.ts - Code execution endpoint
4. ai.routes.ts - AI completion (streaming SSE)

Apply validation, auth, and rate limit middleware.
Return standardized ApiResponse format.
```

## Prompt 6: WebSocket Server
```
In apps/ws-server/src/websocket, create:
1. server.ts - WebSocket server with Express upgrade
2. connection.ts - ConnectionManager class
3. managers/document-manager.ts - Yjs document lifecycle
4. managers/awareness-manager.ts - Cursor/typing/presence
5. handlers/room.handler.ts - JOIN_ROOM, LEAVE_ROOM
6. handlers/document.handler.ts - DOC_UPDATE, DOC_SYNC
7. handlers/awareness.handler.ts - CURSOR_MOVE, USER_TYPING
8. handlers/chat.handler.ts - CHAT_MESSAGE

Implement heartbeat (Section 11.4). Follow message types from Section 6.
```

## Prompt 7: Tests
```
In apps/ws-server/tests, create:
1. Unit tests for all services (mock Prisma, mock external APIs)
2. Integration tests for HTTP routes (Supertest)
3. Integration tests for WebSocket (ws library)
4. Test setup with separate test database

Target: 80%+ coverage. Use Jest + ts-jest.
```

## Prompt 8: Final Integration
```
Wire everything together in apps/ws-server/src/app.ts:
1. Express app setup
2. Middleware registration (order matters!)
3. Route registration
4. WebSocket upgrade handling
5. Global error handler
6. Graceful shutdown

Make sure the server starts successfully with `npm run dev`.
```

# ============================================
# 17. PHASE 2: FRONTEND (DO NOT START YET)
# ============================================

## 17.1 When to Start
ONLY after:
- [ ] All backend tests passing
- [ ] API documented (Postman collection or Swagger)
- [ ] WebSocket protocol tested
- [ ] Backend deployed and accessible

## 17.2 Frontend Tech Stack (Future)
- Next.js 15 App Router
- TypeScript strict
- Tailwind CSS v4
- shadcn/ui components
- Monaco Editor (@monaco-editor/react)
- Yjs client bindings
- Zustand for state
- React Query for server state
- Auth.js for authentication

## 17.3 Frontend Pages (Future)
```
/              - Landing page
/login         - GitHub OAuth
/dashboard     - User's rooms list
/room/[slug]   - Main editor (Monaco + Yjs + WebSocket)
/settings      - User settings
```

# ============================================
# 18. PERFORMANCE TARGETS
# ============================================

| Metric | Target | Measurement |
|--------|--------|-------------|
| WebSocket latency | <50ms | Round-trip time |
| Database query | <100ms | Prisma query time |
| AI first token | <2s | Time to first response |
| Code execution | <5s | Judge0 response time |
| API response | <200ms | HTTP response time |
| Page load (Phase 2) | <3s | Lighthouse |
| Concurrent users | 50+ | Load testing |

# ============================================
# 19. SECURITY CHECKLIST
# ============================================

- [ ] JWT tokens with short expiry (15 min) + refresh tokens
- [ ] HTTPS only in production
- [ ] CORS properly configured
- [ ] Rate limiting on all endpoints
- [ ] Input sanitization (Zod validation)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (output encoding)
- [ ] Room access control (OWNER/EDITOR/VIEWER)
- [ ] WebSocket authentication (token in query param)
- [ ] Code execution sandboxed (Judge0 handles this)
- [ ] AI prompt injection prevention
- [ ] Dependency scanning (npm audit)

# ============================================
# 20. MONITORING & LOGGING
# ============================================

## 20.1 Metrics to Track
- Active WebSocket connections
- Messages per second
- Room count
- Average room size
- AI response latency
- Code execution success rate
- Error rate by endpoint

## 20.2 Log Levels
- ERROR: Failed operations, exceptions
- WARN: Rate limit hits, auth failures
- INFO: User actions, room events
- DEBUG: WebSocket messages, Yjs updates

# ============================================
# END OF DOCUMENT
# ============================================
# Last Updated: 2026-07-27
# Version: 1.0
# ============================================
