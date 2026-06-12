Setup Instructions

Backend Setup
1. Download Backend Files

Download the provided backend files:

app.py
ingest.py

2. Create a Virtual Environment
python -m venv .venv
Windows
.venv\Scripts\activate
Linux
source .venv/bin/activate
3. Install Backend Dependencies

pip install langchain langchain-community langchain-openai \
pypdf unstructured[pdf] beautifulsoup4 \
weaviate-client langchain-weaviate \
sentence-transformers huggingface-hub

Install FastAPI:

pip install "fastapi[standard]" 

Install LangSmith:

pip install -U langsmith

Install additional dependencies used by the application:

pip install pymongo python-dotenv requests duckduckgo-search

Create a .env file in the backend directory and add your credentials:
LANGCHAIN_API_KEY=your_langsmith_api_key
LANGCHAIN_TRACING_V2=true

Start Required Services

5.Install Docker Desktop and start the required services:

MongoDB
Weaviate

Verify both containers are running before proceeding.

6. Ingest Documents into Weaviate

Run: python ingest.py

Wait until document ingestion completes successfully.

7. Start the Backend Server
uvicorn app:app --reload
Backend will be available at: http://localhost:8000

Frontend Setup
1. Install the following:
npm install
npm install -D tailwindcss postcss autoprefixer
npx shadcn@latest init --force
npm install clsx tailwind-merge
npm install react-markdown remark-gfm
npm install react-syntax-highlighter
npm install lucide-react
2. Start the Frontend
run: npm run dev
Frontend will be available at: http://localhost:5173