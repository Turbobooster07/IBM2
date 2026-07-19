# AeroScan – AI PDF Analyzer
## Change Log & Codebase Documentation

---

## 📋 CHANGE LOG

### Session: 2026-07-19

| # | Time | File | Change | Reason |
|---|------|------|--------|--------|
| 1 | 10:52 | — | Ran `npm start` from root directory | Project was failing because commands were run from `frontend/` subdirectory instead of root |
| 2 | 10:55 | `backend/server.js` | Changed model from `gemini-1.5-flash` → `gemini-2.0-flash` | `gemini-1.5-flash` returned HTTP 404 — model no longer available in API v1beta |
| 3 | 10:56 | `backend/server.js` | Changed model from `gemini-2.0-flash` → `gemini-2.0-flash-lite` | Persistent HTTP 429 rate limit errors; flash-lite has higher free tier RPM (30 vs 15) |
| 4 | 10:56 | `backend/server.js` | Added explicit 429 error handling in both `/api/upload` and `/api/chat` | Generic 500 error was shown for rate limit issues; now returns a descriptive message |
| 5 | 11:07 | `backend/server.js` | Fully migrated from `@google/generative-ai` → `groq-sdk` using `llama-3.3-70b-versatile` | Gemini free tier daily quota was exhausted (both API keys belonged to same GCP project) |
| 6 | 11:07 | `frontend/src/App.jsx` | Updated all "Gemini" UI text → "Groq"; changed localStorage key `gemini_api_key` → `groq_api_key` | Consistency with new AI provider |
| 7 | 11:14 | `backend/server.js` | Backend now reads key only from `process.env.GROQ_API_KEY` | Centralised key management — no per-user API key needed |
| 8 | 11:14 | `frontend/src/App.jsx` | Removed API key modal, settings button, and all related state | API key is now shared via `.env`; users don't need to provide their own key |
| 9 | 11:14 | `frontend/src/App.jsx` | Removed `x-api-key` header from all `fetch()` calls | Key is no longer sent from frontend |
| 10 | 11:14 | `backend/.env` | **Created new file** with `GROQ_API_KEY` and `PORT` | Secure way to store the shared API key outside of source code |
| 11 | 11:18 | — | Killed and restarted server (`npm start`) | `dotenv` reads `.env` only at startup; `--watch` mode does not reload env variables when `.env` changes |

---

## 🗂️ PROJECT STRUCTURE

```
IBM2/
├── package.json          ← Root workspace — runs both servers together
├── backend/
│   ├── server.js         ← Express API server (Node.js)
│   ├── package.json      ← Backend dependencies
│   └── .env              ← Secret config (API key, port) — NOT committed to git
└── frontend/
    ├── index.html        ← HTML entry point
    ├── vite.config.js    ← Vite dev server config (proxies /api to backend)
    ├── package.json      ← Frontend dependencies
    └── src/
        ├── main.jsx      ← React app bootstrap
        ├── App.jsx       ← Entire frontend application
        └── index.css     ← All styles (dark theme, components)
```

---

## 📁 FILE-BY-FILE BREAKDOWN

---

### `/package.json` (Root)

The **workspace orchestrator**. Not a real app — just a coordinator.

```json
"scripts": {
  "setup"        → installs npm packages in root + backend + frontend
  "dev:backend"  → runs backend dev server
  "dev:frontend" → runs frontend dev server
  "start"        → runs BOTH servers simultaneously using concurrently
}
```

**Key dependency:** `concurrently` — allows running multiple terminal commands at the same time with one `npm start`.

---

### `/backend/server.js`

The **Express API server** — the brain of the application. Handles file ingestion, AI analysis, and chat.

#### Section 1 — Imports & Setup (Lines 1–11)
```js
import express   // Web server framework
import cors      // Allows frontend (port 3000) to talk to backend (port 5000)
import multer    // Handles multipart/form-data file uploads
import pdfParse  // Extracts raw text from PDF binary data
import dotenv    // Loads variables from .env file into process.env
import Groq      // Groq AI SDK for LLM inference
```

#### Section 2 — Middleware (Lines 13–23)
```js
app.use(cors())          // Allow cross-origin requests from frontend
app.use(express.json())  // Parse JSON request bodies automatically
multer({ memoryStorage }) // Store uploaded files in RAM (not disk), 10MB limit
```

#### Section 3 — Document Cache (Line 26)
```js
const documentCache = new Map()
```
An **in-memory key-value store** holding parsed PDF text after upload.
- **Key:** a random `fileId` string (e.g. `"k7x2m9abc1f"`)
- **Value:** `{ filename, text, analysis, timestamp }`
- **Purpose:** the chat endpoint needs the original PDF text to answer questions, so it's kept here instead of re-parsing on every chat message
- **Limit:** capped at 50 documents to prevent memory bloat

#### Section 4 — Groq Client Helper (Lines 28–35)
```js
const getGroqClient = (req) => { ... }
```
Reads `GROQ_API_KEY` from `process.env` (loaded from `.env`) and returns a ready-to-use Groq client. Throws `API_KEY_MISSING` if no key is found.

#### Section 5 — Health Check (Lines 37–40)
```
GET /api/health → { status: 'ok', time: '...' }
```
Used to verify the backend is alive.

#### Section 6 — Upload & Analysis Endpoint (Lines 42–151)
```
POST /api/upload   (multipart/form-data, field name = "file")
```
**Full flow:**
1. Validates a PDF file was attached
2. `pdfParse` extracts text from the PDF binary buffer
3. If text is empty → returns error (scanned/image PDF — OCR not supported)
4. Sends text to Groq's `llama-3.3-70b-versatile` with a structured JSON prompt
5. Groq returns `{ documentType, summary, entities[], confidence }`
6. Generates a unique `fileId`, stores everything in `documentCache`
7. Returns `{ fileId, filename, analysis }` to the frontend

**AI Prompt instructs the model to return:**
| Field | Description |
|-------|-------------|
| `documentType` | What kind of document (Invoice, Resume, Contract, etc.) |
| `summary` | Bulleted markdown summary of the content |
| `entities` | Array of `{ key, value }` pairs — dates, names, amounts, reference numbers |
| `confidence` | 0–100% confidence score |

#### Section 7 — Chat Endpoint (Lines 153–210)
```
POST /api/chat   (JSON body: { fileId, message })
```
**Full flow:**
1. Looks up `fileId` in `documentCache` to retrieve original document text
2. Builds a **system prompt** embedding the full document text as context
3. Sends `[system: doc context] + [user: question]` to Groq
4. Returns Groq's answer as `{ reply: "..." }`

This is how the AI "knows" what's in the document — the PDF text is injected into every chat request.

#### Section 8 — Server Start (Lines 212–214)
```js
app.listen(port) // Starts on PORT from .env (default: 5000)
```

---

### `/backend/.env`

**Secret configuration file.** Never commit this to Git.

```env
GROQ_API_KEY=gsk_...   ← Shared Groq API key. All users of the app use this.
PORT=5000               ← Port the backend listens on
```

> ⚠️ If you change this file, you MUST restart the server. `--watch` mode only reloads on code file changes, not `.env` changes.

---

### `/frontend/src/App.jsx`

The **entire frontend application** in one React component file.

#### State Variables
| State | Purpose |
|-------|---------|
| `file` | The selected PDF File object |
| `fileUrl` | Temporary `blob:` URL for PDF preview in the iframe |
| `fileId` | ID from backend after upload — used as session key for chat |
| `analysis` | AI result object `{ documentType, summary, entities, confidence }` |
| `activeTab` | Active tab: `'summary'`, `'entities'`, or `'chat'` |
| `messages` | Chat history array `[{ sender: 'user'|'bot', text }]` |
| `chatInput` | Controlled input value for the chat box |
| `isChatting` | True while awaiting AI chat response |
| `isUploading` | True while PDF is being analyzed |
| `uploadError` | Error text shown below the upload area |
| `dragActive` | True when a file is being dragged over the drop zone |

#### Key Functions
| Function | What it does |
|----------|-------------|
| `handleDrag()` | Updates `dragActive` state during drag events |
| `handleDrop()` | Validates dropped file is a PDF, calls `processFile()` |
| `handleFileChange()` | Called when user picks file via dialog |
| `processFile()` | Stores file, creates blob URL for preview, resets old data |
| `handleAnalyze()` | POSTs PDF to `/api/upload`, stores `fileId` + `analysis` |
| `handleSendMessage()` | POSTs message to `/api/chat`, appends reply to chat |
| `handleReset()` | Clears everything back to initial state |
| `formatText()` | Converts markdown (bullets, headers) to React JSX |
| `parseInlineStyles()` | Converts `**bold**`, `*italic*`, `` `code` `` to HTML |

#### UI Screens (conditional rendering)
| Condition | Screen shown |
|-----------|-------------|
| `!file` | Drop zone upload screen |
| `file && !analysis && !isUploading` | File staged — filename + "Analyze" button |
| `isUploading` | Full-screen loading spinner |
| `file && analysis` | Split workspace — PDF viewer (left) + AI panel (right) |

#### Right Panel Tabs
| Tab | Content |
|-----|---------|
| Summary | Document type badge + confidence badge + formatted AI summary |
| Key Entities | Grid of extracted key-value pairs |
| Document Chat | Scrolling chat interface with message bubbles |

---

### `/frontend/src/index.css`

All styles for the app. Uses **CSS custom properties** for theming.

**Design tokens (`:root` variables):**
| Variable | Purpose |
|----------|---------|
| `--color-bg-primary` | Main dark background |
| `--color-bg-secondary` | Card/panel backgrounds |
| `--color-primary` | Purple accent color |
| `--color-accent` | Cyan/teal highlight |
| `--text-primary` | Main text |
| `--text-secondary` | Dimmed text |

**Major component classes:**
| Class | What it styles |
|-------|---------------|
| `.upload-card` | Drop zone card with dashed animated border |
| `.drag-active` | Highlighted border when dragging file over |
| `.workspace` | Two-column split layout |
| `.viewer-pane` | Left panel (PDF iframe) |
| `.analysis-pane` | Right panel (AI results + chat) |
| `.tab-btn.active` | Highlighted active tab |
| `.chat-bubble` | Single chat message container |
| `.bubble-user` | Right-aligned purple user message |
| `.bubble-bot` | Left-aligned dark AI message |
| `.entity-item` | Key-value entity card in the grid |
| `.badge` | Inline label chip (document type, confidence %) |
| `.spinner` | CSS keyframe rotation animation |

---

### `/frontend/index.html`

The HTML shell Vite serves. React mounts into `<div id="root">`.

- Imports **Google Fonts** (Inter + Outfit) for typography
- Contains the SVG favicon (purple document icon)
- `<script type="module" src="/src/main.jsx">` is the Vite entry point

---

### `/frontend/vite.config.js`

Vite development server configuration.

**Most important setting — the API proxy:**
```js
proxy: { '/api': 'http://localhost:5000' }
```
Any request from the frontend to `/api/*` is automatically forwarded to `http://localhost:5000/api/*`. This is why the frontend uses relative URLs like `/api/upload` instead of the full backend URL — it works transparently in development.

---

## 🔄 END-TO-END DATA FLOW

```
User drops/selects PDF
        │
        ▼
App.jsx → handleAnalyze()
        │  POST /api/upload  (PDF binary as FormData)
        ▼
server.js → /api/upload
        │  pdfParse: PDF binary → raw text string
        │  Groq API (llama-3.3-70b): text → JSON analysis
        │  Generate fileId, store { text, analysis } in documentCache
        │  Return { fileId, analysis }
        ▼
App.jsx → setAnalysis(), setFileId()
        │  Renders Split Workspace + Summary tab + chat greeting
        ▼
User types a chat question
        │
        ▼
App.jsx → handleSendMessage()
        │  POST /api/chat  { fileId, message }
        ▼
server.js → /api/chat
        │  documentCache.get(fileId) → retrieves PDF text
        │  Groq API: [system: PDF text as context] + [user: question]
        │  Groq answers using the document as its knowledge source
        │  Return { reply }
        ▼
App.jsx → appends reply to messages[]
        │  New chat bubble renders in UI
```
