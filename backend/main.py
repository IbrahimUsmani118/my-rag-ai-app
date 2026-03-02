import json
import os
import re

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from openai import OpenAI
from pinecone import Pinecone
from pydantic import BaseModel

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pinecone
pc = Pinecone(api_key=os.getenv("VITE_PINECONE_API_KEY"))
pinecone_index = pc.Index(os.getenv("VITE_PINECONE_INDEX_NAME"))

# Groq
groq_client = Groq(api_key=os.getenv("VITE_GROQ_API_KEY"))

# OpenAI (for embeddings; must match model used when indexing chunks)
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EMBEDDING_MODEL = "text-embedding-3-small"

# Chunk metadata as extracted from Pinecone (include_metadata=True)
ChunkMeta = dict  # chunk_id, text, filename, page, score


def get_embedding(text: str) -> list[float]:
    """Generate embedding for text using OpenAI (same model as indexed chunks)."""
    response = openai_client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text.strip(),
    )
    return response.data[0].embedding


def _parse_meta(match: object) -> ChunkMeta:
    mid = getattr(match, "id", None) or (match.get("id") if isinstance(match, dict) else None)
    score = getattr(match, "score", None) or (match.get("score") if isinstance(match, dict) else None)
    meta = getattr(match, "metadata", None) or (match.get("metadata") or {})
    if not isinstance(meta, dict):
        meta = {}
    text = meta.get("text", "").strip()
    filename = meta.get("filename") or meta.get("source") or "document.pdf"
    page = meta.get("page")
    if isinstance(page, str) and page.isdigit():
        page = int(page)
    confidence = min(100.0, max(0.0, (float(score) if score is not None else 0.85) * 100.0))
    return {
        "chunk_id": mid or "",
        "text": text,
        "filename": filename,
        "page": page,
        "confidence": round(confidence, 1),
    }


def rerank_chunks(question: str, chunks: list[ChunkMeta]) -> list[ChunkMeta]:
    """Use LLM to keep only chunks that are actually relevant to the question (re-ranker pattern)."""
    if len(chunks) <= 1:
        return chunks
    # Short preview per chunk (first 250 chars) so the re-ranker is fast
    previews = "\n\n".join(
        f"[{i}] {c['text'][:250]}{'...' if len(c['text']) > 250 else ''}"
        for i, c in enumerate(chunks, 1)
    )
    prompt = f"""Question: {question}

Chunks (numbered 1 to {len(chunks)}):
{previews}

Which chunk numbers are relevant to answering the question? Reply with ONLY a JSON array of relevant numbers, e.g. [1, 3, 5]. If none are relevant, reply []."""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            max_tokens=80,
        )
        raw = (completion.choices[0].message.content or "").strip()
        # Extract JSON array
        arr_match = re.search(r"\[[\d,\s]*\]", raw)
        if not arr_match:
            return chunks
        indices = json.loads(arr_match.group())
        if not isinstance(indices, list):
            return chunks
        # 1-based to 0-based; filter to valid indices
        keep = {int(i) for i in indices if isinstance(i, (int, float)) and 1 <= int(i) <= len(chunks)}
        if not keep:
            return chunks
        return [chunks[i - 1] for i in sorted(keep)]
    except (json.JSONDecodeError, ValueError, KeyError):
        return chunks


class QueryRequest(BaseModel):
    question: str


class SourceItem(BaseModel):
    """Source attribution metadata for one citation [1], [2], etc."""

    chunk_id: str
    filename: str
    page: int | None
    confidence: float  # 0-100
    text_snippet: str  # original text snippet for attribution


class QueryResponse(BaseModel):
    """JSON response: answer string and array of source objects per citation."""

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

    # 1. Embed query
    query_embedding = get_embedding(question)

    # 2. Query Pinecone with include_metadata=True (filename, page, text snippet)
    query_result = pinecone_index.query(
        vector=query_embedding,
        top_k=5,
        include_metadata=True,
    )
    matches = getattr(query_result, "matches", []) or query_result.get("matches", [])

    if not matches:
        return QueryResponse(
            response="No relevant documents were found to answer your question. Try uploading documents first or rephrasing.",
            chunk_ids=[],
            sources=[],
        )

    # 3. Extract metadata: filename, page, original text snippet
    chunks: list[ChunkMeta] = [_parse_meta(m) for m in matches if _parse_meta(m).get("chunk_id")]

    # 4. Re-ranker: keep only chunks the LLM deems relevant
    chunks = rerank_chunks(question, chunks)

    if not chunks:
        return QueryResponse(
            response="No relevant passages could be used to answer this question. Try rephrasing or uploading more documents.",
            chunk_ids=[],
            sources=[],
        )

    # 5. Build context for Groq (strict prompt + citation instruction)
    context_parts = [f"[{i}]\n{c['text']}" for i, c in enumerate(chunks, 1)]
    context = "\n\n".join(context_parts)

    system_prompt = """Answer ONLY using the provided context. If the answer isn't there, say you don't know. Cite your sources using [1], [2] notation for each claim."""

    user_prompt = f"""Context:

{context}

---

Question: {question}"""

    completion = groq_client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.2,
    )
    answer = completion.choices[0].message.content or ""

    # 6. Return JSON: answer + sources array (metadata for each citation [1], [2], ...)
    chunk_ids = [c["chunk_id"] for c in chunks]
    sources = [
        SourceItem(
            chunk_id=c["chunk_id"],
            filename=c["filename"],
            page=c.get("page"),
            confidence=c["confidence"],
            text_snippet=c["text"][:500] + ("..." if len(c["text"]) > 500 else ""),
        )
        for c in chunks
    ]

    return QueryResponse(response=answer, chunk_ids=chunk_ids, sources=sources)
