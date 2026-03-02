# My AI RAG App

RAG (Retrieval-Augmented Generation) chat: ask questions over your documents with citations and a glassmorphic UI.

## Run locally

**Python:** The backend uses ChromaDB, which does not support Python 3.14+. Use **Python 3.12 or 3.11**. On macOS: `brew install python@3.12`. If you already have a venv on 3.14, remove it and re-run: `rm -rf backend/.venv && npm run start`.

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

#### 1. Backend (FastAPI + ChromaDB + OpenAI)

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

## Ingesting PDFs (ChromaDB)

Before querying, ingest PDFs so they are chunked and stored in ChromaDB:

```bash
cd backend
source .venv/bin/activate   # or: .venv\Scripts\activate on Windows
python -m ingest path/to/file1.pdf path/to/file2.pdf
```

- Uses **LangChain RecursiveCharacterTextSplitter**: 800 tokens per chunk, 15% overlap.
- Text is embedded with OpenAI `text-embedding-3-small` and stored in `backend/chroma_data/`.
- Requires `OPENAI_API_KEY` in `backend/.env`.

## Environment

- **Backend** (`backend/.env`): `OPENAI_API_KEY` (for embeddings and GPT-4o-mini).
- **Frontend** (root `.env`): optional; the app talks to the backend via the dev proxy.
