from fastapi import FastAPI
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse
from langsmith import Client
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from pathlib import Path
import json
import weaviate
import uuid
import requests
from pymongo import MongoClient
from queue import Queue
from langchain_huggingface import HuggingFaceEmbeddings
from sentence_transformers import CrossEncoder
from fastapi.middleware.cors import CORSMiddleware
import os

class RegenerateRequest(BaseModel):
    run_id: str


class FeedbackRequest(BaseModel):
    run_id: str
    score: float
    comment: str | None = ""

app = FastAPI()

mongo_client = MongoClient("mongodb://localhost:27017")
try:
    mongo_client.admin.command("ping")
    print("MongoDB connected successfully")
except Exception as e:
    print("MongoDB connection failed:", e)

db = mongo_client["rag_chatbot"]

chat_collection = db["chat_history"]
feedback_collection = db["feedback"]

@app.delete("/thread/{thread_id}")
def delete_thread(thread_id: str):
    chat_collection.delete_many({"thread_id": thread_id})
    return {"status": "deleted"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Run-ID",
        "X-toggle",
        "X-Citations"
    ],
)
# load env properly
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(env_path)

langsmith_client = Client()

emb = HuggingFaceEmbeddings(
    model_name="BAAI/bge-small-en-v1.5"
)

reranker = CrossEncoder(
    "cross-encoder/ms-marco-MiniLM-L-6-v2"
)

weaviate_client = weaviate.connect_to_local()
collection = weaviate_client.collections.get("Document")


def web_search(query: str):
    with DDGS() as ddgs:
        results = ddgs.text(query, max_results=5)
        return list(results)
def needs_web_search(query: str, passages=None) -> bool:
    keywords = [
        "where is", "what is", "who is", "when is",
        "latest", "price", "news", "capital", "weather", "season", "time", "temperature"
    ]
    if passages is not None and any(p.strip() for p in passages):
        # Check if RAG has high relevance score
        return False
    return any(k in query.lower() for k in keywords)

def run_rag(query: str):
    # 1. embed query
    query_vector = emb.embed_query(query)

    # 2. retrieve
    results = collection.query.near_vector(
        near_vector=query_vector,
        limit=20,
        return_properties=["text", "source", "page"]  # include extra metadata
    )

    docs = []
    for r in results.objects:
        docs.append(type("Doc", (), {
    "page_content": r.properties.get("text", ""),
    "source": r.properties.get("source", "Unknown Source"),
    "page": r.properties.get("page", "?")
}))


    # 3. rerank
    pairs = [(query, d.page_content[:1000]) for d in docs]
    scores = reranker.predict(pairs)

    reranked = sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)
    top_docs = reranked[:5]

    passages = [d.page_content for d, _ in top_docs]
    sources = [d.source for d, _ in top_docs]
    pages = [d.page for d, _ in top_docs]

    # pad if less than 5
    while len(passages) < 5:
        passages.append("")
        sources.append("Unknown Source")
        pages.append("Unknown Page")
    passages_text = "\n".join(
    f"[{i+1}] {p}"
    for i, p in enumerate(passages)
    if p.strip()
)

    prompt = f"""
You are a helpful assistant.

Use the provided information to answer the question.
RULES:
- Answer the question naturally like ChatGPT.
- Do NOT mention "passages", "context", or "documents".
- Do NOT say "based on the passages".
- Do NOT refer to yourself analyzing text.
- Use citations like [1], [2] only when needed.
- If multiple sources support a claim, combine them like [1][3].
- If information is missing, I could not find relevant information

Passages:

{passages_text}

Question:
{query}

Answer:
"""
    best_score = reranked[0][1] if reranked else -999

    return prompt, passages, best_score, sources, pages


class AskRequest(BaseModel):
    query: str
    mode: str = "chat"
    thread_id: str | None = None


prompt = ""
passages = []
@app.post("/ask")
def ask(data: AskRequest):

    print("THREAD RECEIVED:", data.thread_id)

    run_id = str(uuid.uuid4())
    
    thread_id = data.thread_id or str(uuid.uuid4())
    query = data.query.strip()
    mode = data.mode
    langsmith_client.create_run(
    id=run_id,
    name="Chat Answer",
    run_type="chain",
    inputs={"query": query, "mode": mode},
)
    chat_collection.insert_one({
        "thread_id": thread_id,
        "run_id": run_id,
        "role": "user",
        "content": query,
    })

    citations = []
    toggle = "chat"
    prompt = ""

    # ---------------- RAG ----------------
    if mode == "rag":
        prompt, passages, best_score, sources, pages = run_rag(query)

        citations = [
            {
                "id": i + 1,
                "type": "rag",
                "source": src,
                "page": pg,
                "content": p[:150]
            }
            for i, (p, src, pg) in enumerate(zip(passages, sources, pages))
            if p.strip()
        ]

        toggle = "rag"

    # ---------------- CHAT ----------------
    elif mode == "chat":
        if needs_web_search(query):
            results = web_search(query)

            context = "\n\n".join(
                f"{r.get('title','')}\n{r.get('body','')}\n{r.get('href','')}"
                for r in results
            )

            prompt = f"""
You are a helpful assistant.

RULES:
- Answer naturally like ChatGPT.
- Do NOT mention passages or documents.
- Keep answers short.
- Only English.

WEB RESULTS:
{context}

QUESTION:
{query}
"""
        else:
            prompt = query

    # ---------------- HYBRID ----------------
    elif mode == "hybrid":
        rag_prompt, passages, best_score, sources, pages = run_rag(query)

        RAG_THRESHOLD = 2.0

        if best_score >= RAG_THRESHOLD:
            prompt = rag_prompt
            toggle = "rag"

            citations = [
                {
                    "id": i + 1,
                    "type": "rag",
                    "content": p[:150],
                    "source": s,
                    "page": pg
                }
                for i, (p, s, pg) in enumerate(zip(passages, sources, pages))
                if p.strip()
            ]

        else:
            results = web_search(query)

            web_context = "\n\n".join(
                f"{r.get('title','')}\n{r.get('body','')}\n{r.get('href','')}"
                for r in results
            )

            prompt = f"""
Use web results.

RULES:
- Answer naturally like ChatGPT
- No mentioning documents
- Use citations [1][2] if needed

WEB:
{web_context}

QUESTION:
{query}
"""

            toggle = "web"

            citations = [
                {
                    "type": "web",
                    "title": r.get("title"),
                    "url": r.get("href"),
                    "snippet": r.get("body")
                }
                for r in results
            ]

    # ---------------- OLLAMA STREAM ----------------
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3.2:1b",
            "prompt": prompt,
            "stream": True
        },
        stream=True
    )

    def event_stream():
        full_answer = ""

        # 1. send metadata first
        yield f"data: {json.dumps({
    "type": "meta",
    "run_id": run_id,
    "toggle": toggle,
    "citations": citations
})}\n\n"

        # 2. stream tokens
        for line in response.iter_lines():
            if not line:
                continue

            try:
                chunk = json.loads(line.decode())
            except json.JSONDecodeError:
                continue

            token = chunk.get("response", "")
            full_answer += token

            yield f"data: {json.dumps({
                'type': 'token',
                'token': token
            })}\n\n"
            

        # 3. save to MongoDB AFTER stream finishes
        chat_collection.insert_one({
            "thread_id": thread_id,
            "run_id": run_id,
            "role": "ai",
            "query": query,
            "prompt": prompt,
            "mode": mode,
            "content": full_answer,
            "toggle": toggle,
            "citations": citations,
            "current_version": 1,
            "versions": [
                {
                    "version": 1,
                    "content": full_answer
                }
            ],
        })

        langsmith_client.update_run(
    run_id=run_id,
    outputs={"answer": full_answer}
)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

@app.get("/history")
def history():
    
    try:
        chats = list(chat_collection.find({}, {"_id": 0}))

        # safety cleanup
        cleaned = []
        for c in chats:
            if "thread_id" not in c:
                continue
            cleaned.append(c)

        return cleaned

    except Exception as e:
        print("HISTORY ERROR:", e)
        return []
@app.post("/regenerate")
def regenerate(data: RegenerateRequest):

    msg = chat_collection.find_one(
        {"run_id": data.run_id, "role": "ai"}
    )

    stored_prompt = msg["prompt"]

    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3.2:1b",
            "prompt": stored_prompt,
            "stream": True
        },
        stream=True
    )

    versions = msg.get("versions", [])

    next_version = max(
        [v.get("version", 0) for v in versions],
        default=0
    ) + 1

    def generate():
        full_answer = ""

        for line in response.iter_lines():
            if not line:
                continue

            chunk = json.loads(line.decode())
            token = chunk.get("response", "")

            full_answer += token

            yield token

        chat_collection.update_one(
            {
                "run_id": data.run_id,
                "role": "ai"
            },
            {
                "$push": {
                    "versions": {
                        "version": next_version,
                        "content": full_answer
                    }
                },
                "$set": {
                    "content": full_answer,
                    "current_version": next_version
                }
            }
        )

    return StreamingResponse(
        generate(),
        media_type="text/plain"
    )
@app.post("/api/feedback")
def feedback(data: FeedbackRequest):

    try:
        langsmith_client.create_feedback(
            run_id=data.run_id,
            key="human-feedback",
            score=data.score,
            value="good" if data.score > 0 else "bad",
            comment=data.comment
        )
        feedback_collection.insert_one({
        "run_id": data.run_id,
        "score": data.score,
        "comment": data.comment
    })
        chat_collection.update_one(
    {
        "run_id": data.run_id,
        "role": "ai"
    },
    {
        "$set": {
            "feedback_score": data.score,
            "feedback_comment": data.comment
        }
    }
)


    except Exception as e:
        print("LangSmith error:", e)

    return {"status": "ok"}
@app.get("/message/{run_id}")
def get_message(run_id: str):
    msg = chat_collection.find_one(
        {"run_id": run_id, "role": "ai"},
        {"_id": 0}
    )
    return msg
