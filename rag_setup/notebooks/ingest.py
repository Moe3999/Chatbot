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

# Construct the path to the PDF file.
# Path("..") moves one directory up from the current notebook/script location.
# This makes the code portable across different machines.
pdf_path = Path("data") / "CIS_Controls__v8__Critical_Security_Controls__2023_08.pdf"

# Create a loader for the PDF.
# strategy="hi_res" was chosen because:
# - It performs layout-aware parsing.
# - It attempts to preserve document structure.
# - It can better distinguish titles, headings, paragraphs, lists, and tables.
# - This often produces higher-quality chunks for Retrieval-Augmented Generation (RAG)
#   compared to simple text extraction.
loader = UnstructuredLoader(
    file_path=pdf_path,
    strategy="hi_res"
)

# Parse the PDF and extract document elements.
# Each element becomes a LangChain Document object containing:
# - page_content -> the extracted text
# - metadata -> information about the element
# Instead of returning one giant block of text, Unstructured splits the PDF
# into logical sections, which helps later chunking and retrieval.
documents = loader.load()

# Clean metadata.
# hi_res parsing generates a large amount of metadata such as:
# - coordinates
# - bounding boxes
# - layout information
# - page geometry
# Most vector databases do not need this information and some metadata
# structures cannot be serialized correctly.
# filter_complex_metadata removes these problematic fields while keeping
# useful metadata such as page numbers and source information.
documents = filter_complex_metadata(documents)

# Remove empty elements.
# Some PDFs produce blank elements during parsing.
# Examples:
# - empty lines
# - whitespace-only sections
# - parsing artifacts
# Keeping them would:
# - waste embedding computation
# - create useless vector entries
# - reduce retrieval quality
# Therefore we keep only elements that contain actual text.
documents = [
    d for d in documents
    if d.page_content and d.page_content.strip()
]

# Display how many usable document elements were extracted.
# This acts as a sanity check to verify parsing succeeded.
print(f"Parsed {len(documents)} elements")

# Preview a few parsed elements.
# Looking at the output helps verify:
# - the PDF was parsed correctly
# - headings are preserved
# - text is readable
# - no major extraction issues occurred
# This is an important debugging step before chunking and embedding.
print("\nFirst 3 elements preview:\n")

# Show the first three extracted elements.
# Only the first 300 characters are displayed so the output remains readable.
for i, doc in enumerate(documents[:3]):
    print(f"--- Element {i+1} ---")
    print(doc.page_content[:300])
    print()

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