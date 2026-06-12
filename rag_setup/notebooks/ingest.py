# 2.1 Parsing

# Import the Unstructured loader from LangChain.
# This loader uses the Unstructured library to extract content from PDFs
# while preserving document structure (titles, paragraphs, lists, tables, etc.).
from langchain_unstructured import UnstructuredLoader
# Utility function that removes metadata fields that cannot be serialized
# or stored easily in vector databases.
from langchain_community.vectorstores.utils import filter_complex_metadata
# Path provides operating-system-independent file paths.
# Using Path is more robust than hardcoding strings.
from pathlib import Path

pdf_files = list(Path("data").glob("*.pdf"))

for pdf_path in pdf_files:

    print(f"Reading {pdf_path.name}")

    loader = UnstructuredLoader(
        file_path=str(pdf_path),
        strategy="hi_res"
    )

    documents = loader.load()

    documents = filter_complex_metadata(documents)

    documents = [
        d for d in documents
        if d.page_content and d.page_content.strip()
    ]

    print(f"Parsed {len(documents)} elements")


#2.2 chunking
from langchain_text_splitters import RecursiveCharacterTextSplitter

text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=500,
    chunk_overlap=50
)

chunks = text_splitter.split_documents(documents)

print(f"\nChunks before cleaning: {len(chunks)}")

# Remove duplicates + tiny chunks
seen = set()
clean_chunks = []

for chunk in chunks:

    text = chunk.page_content.strip()

    if len(text) < 100:
        continue

    if text in seen:
        continue

    seen.add(text)
    clean_chunks.append(chunk)

chunks = clean_chunks

print(f"Chunks after cleaning: {len(chunks)}")

# Chunk statistics
sizes = [len(c.page_content) for c in chunks]

print("\nChunk Statistics")
print("----------------")
print("Min:", min(sizes))
print("Max:", max(sizes))
print("Avg:", round(sum(sizes)/len(sizes), 2))

#2.3 Embedding
from langchain_huggingface import HuggingFaceEmbeddings

emb = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)

print("\nEmbedding model loaded")

#2.4 Vector DB Setup

import weaviate

from weaviate.classes.config import (
    Property,
    DataType,
    Configure
)

client = weaviate.connect_to_local()

print("\nConnected:", client.is_ready())

collection_name = "Document"

if not client.collections.exists(collection_name):

    client.collections.create(
        name=collection_name,
        properties=[
            Property(
                name="text",
                data_type=DataType.TEXT
            ),
            Property(
                name="source",
                data_type=DataType.TEXT
            ),
            Property(
                name="page",
                data_type=DataType.INT
            ),
        ],
        vectorizer_config=Configure.Vectorizer.none()
    )

collection = client.collections.get(collection_name)

#2.5 Ingestion

texts = [chunk.page_content for chunk in chunks]

print("\nGenerating embeddings...")

vectors = emb.embed_documents(texts)

print("Embeddings generated")

with collection.batch.dynamic() as batch:

    for chunk, vector in zip(chunks, vectors):

        batch.add_object(
            properties={
                "text": chunk.page_content,
                "source": pdf_path.name,
                "page": chunk.metadata.get(
                    "page_number",
                    -1
                )
            },
            vector=vector
        )

print(f"\nInserted {len(chunks)} chunks")