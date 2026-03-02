"""
Ingest PDFs into ChromaDB using LangChain RecursiveCharacterTextSplitter.
Chunks: 800 tokens, 15% overlap. Embeds with OpenAI and stores in Chroma.
"""
import os
import sys
import uuid

import fitz  # PyMuPDF
from chromadb import PersistentClient
from chromadb.utils import embedding_functions
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter

load_dotenv()

CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "chroma_data"))
COLLECTION_NAME = "docs"
OPENAI_EMBED_MODEL = "text-embedding-3-small"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120  # 15% of 800


def get_text_splitter() -> RecursiveCharacterTextSplitter:
    """800 tokens per chunk, 15% overlap (120 tokens)."""
    return RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        model_name="gpt-4",
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )


def extract_text_from_pdf(path: str) -> list[tuple[str, int]]:
    """Extract text per page. Returns [(text, page_number), ...]."""
    doc = fitz.open(path)
    out = []
    for i in range(len(doc)):
        page = doc.load_page(i)
        out.append((page.get_text(), i + 1))
    doc.close()
    return out


def ingest_pdf(file_path: str, filename: str | None = None) -> int:
    """
    Load a PDF, split with RecursiveCharacterTextSplitter (800 tokens, 15% overlap),
    embed with OpenAI, and add to ChromaDB. Returns number of chunks added.
    """
    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"PDF not found: {file_path}")
    name = filename or os.path.basename(file_path)

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY is required for ingestion")

    ef = embedding_functions.OpenAIEmbeddingFunction(
        api_key=api_key,
        model_name=OPENAI_EMBED_MODEL,
    )
    client = PersistentClient(path=CHROMA_PATH)
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )

    text_splitter = get_text_splitter()
    pages = extract_text_from_pdf(file_path)
    all_docs: list[str] = []
    all_metadatas: list[dict] = []
    all_ids: list[str] = []

    for page_text, page_no in pages:
        if not page_text.strip():
            continue
        chunks = text_splitter.split_text(page_text)
        for chunk in chunks:
            if not chunk.strip():
                continue
            all_docs.append(chunk)
            all_metadatas.append({"filename": name, "page": page_no})
            all_ids.append(str(uuid.uuid4()))

    if not all_docs:
        return 0

    collection.add(documents=all_docs, metadatas=all_metadatas, ids=all_ids)
    return len(all_docs)


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m ingest <path_to.pdf> [path_to.pdf ...]")
        sys.exit(1)
    total = 0
    for path in sys.argv[1:]:
        n = ingest_pdf(path)
        total += n
        print(f"  {path}: {n} chunks")
    print(f"Total chunks added: {total}")


if __name__ == "__main__":
    main()
