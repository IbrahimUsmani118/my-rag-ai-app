import json
import os
import tempfile
from typing import Any

from chromadb import PersistentClient
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from fastapi import FastAPI, File, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from openai import OpenAI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

from ingest import ingest_pdf

load_dotenv()

# Cross-Encoder for reranking: score (query, chunk) pairs and keep top-k
RERANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L6-v2"
RERANK_TOP_K = 3
VECTOR_STORE_TOP_K = 10

_cross_encoder: CrossEncoder | None = None


def get_reranker() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        _cross_encoder = CrossEncoder(RERANKER_MODEL)
    return _cross_encoder

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ChromaDB (same path and collection as ingest.py)
CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "chroma_data"))
COLLECTION_NAME = "docs"
OPENAI_EMBED_MODEL = "text-embedding-3-small"
OPENAI_CHAT_MODEL = "gpt-4o-mini"

openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
ef = embedding_functions.OpenAIEmbeddingFunction(
    api_key=os.getenv("OPENAI_API_KEY"),
    model_name=OPENAI_EMBED_MODEL,
)
chroma_client = PersistentClient(path=CHROMA_PATH)

# Prompt template for RAG: context + question -> answer
PROMPT_TEMPLATE = """Answer ONLY using the provided context below. If the answer is not in the context, say you don't know. Cite your sources using [1], [2], etc. for each claim.

Context:
{context}

---

Question: {question}"""


def get_collection():
    return chroma_client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )


def _parse_chunk(doc_id: str, text: str, meta: dict, dist: float) -> dict[str, Any]:
    """Build a chunk dict with metadata; confidence from vector distance (before rerank)."""
    filename = meta.get("filename") or "document.pdf"
    page = meta.get("page")
    if isinstance(page, str) and page.isdigit():
        page = int(page)
    confidence = max(0.0, min(100.0, 100.0 * (1.0 - (float(dist) / 2.0))))
    return {
        "chunk_id": doc_id,
        "text": text or "",
        "filename": filename,
        "page": page,
        "confidence": round(confidence, 1),
        "text_snippet": (text or "")[:500] + ("..." if len(text or "") > 500 else ""),
    }


def retrieve_and_rerank(collection, question: str) -> tuple[str, list[dict[str, Any]]]:
    """
    Fetch 10 chunks from the vector store, score with Cross-Encoder, return context and
    source metadata for the top 3 highest-scoring chunks.
    """
    results = collection.query(
        query_texts=[question],
        n_results=VECTOR_STORE_TOP_K,
        include=["documents", "metadatas", "distances"],
    )
    docs = results["documents"][0] if results["documents"] else []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    ids = results["ids"][0] if results["ids"] else []
    distances = results["distances"][0] if results["distances"] else [0.0] * len(docs)

    if not docs:
        return "", []

    # Build candidate chunks
    candidates = []
    for doc_id, text, meta, dist in zip(
        ids, docs, metadatas or [{}] * len(docs), distances or [0.0] * len(docs)
    ):
        meta = meta or {}
        candidates.append(_parse_chunk(doc_id, text or "", meta, float(dist or 0)))

    # Cross-Encoder rerank: score (query, passage) pairs
    pairs = [(question, c["text"]) for c in candidates]
    reranker = get_reranker()
    scores = reranker.predict(pairs)

    # Sort by score descending and take top RERANK_TOP_K
    indexed = list(zip(scores, candidates))
    indexed.sort(key=lambda x: x[0], reverse=True)
    top = [c for _, c in indexed[:RERANK_TOP_K]]

    # Normalize rerank scores (among top-k) to 0–100 for confidence display
    top_scores = [indexed[i][0] for i in range(len(top))]
    if len(top) > 1 and min(top_scores) != max(top_scores):
        lo, hi = min(top_scores), max(top_scores)
        for i, c in enumerate(top):
            c["confidence"] = round(100.0 * (top_scores[i] - lo) / (hi - lo), 1)
    elif top:
        top[0]["confidence"] = 100.0

    # Build context and sources (renumbered [1], [2], [3])
    context_parts = [f"[{i}]\n{c['text']}" for i, c in enumerate(top, 1)]
    context = "\n\n".join(context_parts)
    sources = [
        {
            "chunk_id": c["chunk_id"],
            "filename": c["filename"],
            "page": c["page"],
            "confidence": c["confidence"],
            "text_snippet": c["text_snippet"],
        }
        for c in top
    ]
    return context, sources


class QueryRequest(BaseModel):
    question: str


class SourceItem(BaseModel):
    """Metadata for one retrieved chunk: filename and page from ChromaDB, plus confidence and snippet."""

    chunk_id: str
    filename: str  # from ChromaDB metadata
    page: int | None  # from ChromaDB metadata
    confidence: float  # 0-100
    text_snippet: str


class QueryResponse(BaseModel):
    response: str
    chunk_ids: list[str]
    sources: list[SourceItem]


@app.get("/")
def health_check():
    return "Backend is live"


@app.post("/query", response_model=QueryResponse)
def query(request: QueryRequest):
    question = request.question.strip()
    if not question:
        return QueryResponse(response="Please provide a question.", chunk_ids=[], sources=[])

    collection = get_collection()
    context, sources_dicts = retrieve_and_rerank(collection, question)

    if not context:
        return QueryResponse(
            response="No relevant documents were found. Ingest PDFs first using the ingest script.",
            chunk_ids=[],
            sources=[],
        )

    prompt = PROMPT_TEMPLATE.format(context=context, question=question)
    completion = openai_client.chat.completions.create(
        model=OPENAI_CHAT_MODEL,
        messages=[
            {"role": "system", "content": "You answer questions based only on the provided context. Cite sources with [1], [2] notation."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )
    answer = completion.choices[0].message.content or ""

    sources = [SourceItem(**s) for s in sources_dicts]
    chunk_ids = [s["chunk_id"] for s in sources_dicts]
    return QueryResponse(response=answer, chunk_ids=chunk_ids, sources=sources)


@app.post("/query/stream")
def query_stream(request: QueryRequest):
    """Stream the assistant reply as newline-delimited JSON chunks: {"delta": "..."} then {"sources": [...]}."""
    question = request.question.strip()
    if not question:
        def empty():
            yield json.dumps({"delta": ""}) + "\n"
        return StreamingResponse(empty(), media_type="application/x-ndjson")

    collection = get_collection()
    context, sources = retrieve_and_rerank(collection, question)

    if not context:
        def no_docs():
            yield json.dumps({"delta": "No relevant documents were found. Ingest PDFs first using the ingest script."}) + "\n"
            yield json.dumps({"sources": []}) + "\n"
        return StreamingResponse(no_docs(), media_type="application/x-ndjson")

    prompt = PROMPT_TEMPLATE.format(context=context, question=question)

    def generate():
        stream = openai_client.chat.completions.create(
            model=OPENAI_CHAT_MODEL,
            messages=[
                {"role": "system", "content": "You answer questions based only on the provided context. Cite sources with [1], [2] notation."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            stream=True,
        )
        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield json.dumps({"delta": chunk.choices[0].delta.content}) + "\n"
        yield json.dumps({"sources": sources}) + "\n"

    return StreamingResponse(generate(), media_type="application/x-ndjson")


@app.get("/documents")
def list_documents():
    """Return unique document filenames stored in ChromaDB."""
    collection = get_collection()
    try:
        data = collection.get(include=["metadatas"], limit=100_000)
    except Exception:
        return {"documents": []}
    metadatas = data.get("metadatas") or []
    seen = set()
    names = []
    for m in metadatas:
        if not isinstance(m, dict):
            continue
        name = m.get("filename")
        if name and name not in seen:
            seen.add(name)
            names.append(name)
    return {"documents": sorted(names)}


@app.post("/documents/upload")
def upload_document(file: UploadFile = File(...)):
    """Upload a PDF: chunk it, embed, and add to ChromaDB. Returns chunk count and filename."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        return JSONResponse(
            content={"error": "Only PDF files are allowed", "chunks": 0},
            status_code=400,
        )
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = file.file.read()
            tmp.write(content)
            tmp_path = tmp.name
        try:
            n = ingest_pdf(tmp_path, filename=file.filename)
            return {"filename": file.filename, "chunks": n}
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
    except Exception as e:
        return JSONResponse(
            content={"error": str(e), "chunks": 0},
            status_code=500,
        )


@app.delete("/documents")
def delete_document(filename: str = Query(..., description="Filename to remove from the index")):
    """Delete all chunks for the given document filename."""
    collection = get_collection()
    try:
        data = collection.get(where={"filename": {"$eq": filename}}, include=[])
    except Exception:
        return {"deleted": 0}
    ids_to_delete = data.get("ids") or []
    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
    return {"deleted": len(ids_to_delete)}
