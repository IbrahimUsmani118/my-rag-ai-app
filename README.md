# My AI RAG App

RAG (Retrieval-Augmented Generation) chat: ask questions over your documents with citations and a glassmorphic UI.

## Run locally

### One-command start (venv + backend + build + frontend)

From the project root:

```bash
npm install   # first time only
npm run start
```

This script will:

1. Create `backend/.venv` if missing and install Python dependencies
2. Start the FastAPI backend in the background (http://localhost:8000)
3. Run `npm run build`
4. Run `npm run dev` (frontend at http://localhost:5173)

Press `Ctrl+C` to stop the frontend; the script will also stop the backend.

---

### Run backend and frontend separately

#### 1. Backend (FastAPI + Pinecone + Groq)

```bash
# From project root
npm run dev:backend
```

Or manually:

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend: **http://localhost:8000**

#### 2. Frontend (Vite + React)

```bash
# From project root
npm install   # first time only
npm run dev
```

Frontend: **http://localhost:5173**

#### 3. Use the app

1. Open **http://localhost:5173** in your browser.
2. Ask a question; the app proxies `/api/*` to the backend.
3. Click citation links like **[1]** in the AI response to open the **Sources** side-panel (filename, page, confidence score).

## Environment

- **Frontend** (root `.env`): `VITE_GROQ_API_KEY`, `VITE_PINECONE_API_KEY`, `VITE_PINECONE_INDEX_NAME` (for any client-side usage).
- **Backend** (`backend/.env`): same keys plus `OPENAI_API_KEY` for embeddings. Copy values from the root `.env` and add your OpenAI key.
