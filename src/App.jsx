
import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
function App() {
  const [openFeedback, setOpenFeedback] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState({});
  
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
useEffect(() => {
  const timer = setTimeout(() => {
    setMessages([
      {
        role: "ai",
        text: "Thinking...",
        run_id: "welcome-message",
      },
    ]);

    setTimeout(() => {
      setMessages([
        {
          role: "ai",
          text: "How can I help you today?",
          run_id: "welcome-message",
        },
      ]);
    }, 800);
  }, 500);

  return () => clearTimeout(timer);
}, []);

  const submitFeedback = async (runId) => {
  try {
    const data = feedback[runId];

    const res = await fetch("http://localhost:8000/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        run_id: runId,
        score: data?.score ?? 0,
        comment: data?.comment ?? "",
      }),
    });

    console.log("Feedback submitted");
  } catch (err) {
    console.error("Feedback error:", err);
  }
};

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const question = input.trim();

    const userMessage = {
      role: "user",
      text: question,
    };

    setInput("");
    setLoading(true);
    setStatus("thinking");

    // Add user message and temporary AI message
    setMessages((prev) => [
      ...prev,
      userMessage,
      {
      role: "ai",
      text: "",
      },
    ]);
    
    

    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: question,

        }),
      });

      const runId = res.headers.get("X-Run-ID");
      console.log("Run ID:", runId);

      if (!res.ok) {
        const err = await res.text();
        console.log("Backend error:", err);
        throw new Error(err);
      } 
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (status !== "typing") {
        setStatus("typing");
     }

        const chunk = decoder.decode(value);
        answer += chunk;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "ai",
            text: answer,
            run_id: runId,
          };
          return updated;
        });
        }
    } catch (error) {
      console.error(error);

      setMessages((prev) => {
        const updated = [...prev];

        updated[updated.length - 1] = {
          role: "ai",
          text: "Error connecting to backend.",
        };

        return updated;
      });
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  return (
    <div 
      className={`flex h-screen flex-col ${
    darkMode ? "bg-black text-white" : "bg-white text-black"
  }`}
>
      {/* Header */}
      <header className=" px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold"
  style={{ color: darkMode ? "white" : "black" }}
>
  Chatbot
</h1>
        <button
        variant="outline"
        onClick={() => setDarkMode(prev => !prev)}
        >
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
{messages.map((msg, index) => (
  <div
    key={index}
    className={`flex ${
      msg.role === "user"
        ? "justify-end"
        : "justify-start"
    }`}
  >
    <div
      className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm text-left ${
        msg.role === "user"
          ? darkMode
            ? "bg-blue-900 text-white rounded-br-md"
            : "bg-blue-500 text-white rounded-br-md"
          : darkMode
          ? "bg-zinc-800 text-white rounded-bl-md"
          : "bg-gray-200 text-black rounded-bl-md"
      }`}
    >
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code({ inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");

      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  }}
>
  {msg.text}
</ReactMarkdown>

{msg.role === "ai" && msg.run_id && (
  <div className="mt-3 flex flex-col gap-2">

  
    <button
      className="text-sm opacity-70 hover:opacity-100 transition"
      onClick={() =>
        setOpenFeedback((prev) => ({
          ...prev,
          [msg.run_id]: !prev[msg.run_id],
        }))
      }
    >
      Feedback
    </button>

    {openFeedback[msg.run_id] && (
      <div className="flex flex-col gap-2">

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            className={`text-lg hover:scale-110 transition ${
              feedback[msg.run_id]?.score === 1 ? "text-green-500" : ""
            }`}
            disabled={feedback[msg.run_id]?.score !== undefined}
            onClick={() =>
              setFeedback((prev) => {
                if (prev[msg.run_id]?.score !== undefined) return prev;

                return {
                  ...prev,
                  [msg.run_id]: {
                    ...prev[msg.run_id],
                    score: 1,
                  },
                };
              })
            }
          >
            👍
            {feedback[msg.run_id]?.score === 1 && (
              <span className="text-xs">✓</span>
            )}
          </button>

          <button
            className={`text-lg hover:scale-110 transition ${
              feedback[msg.run_id]?.score === 0 ? "text-red-500" : ""
            }`}
            disabled={feedback[msg.run_id]?.score !== undefined}
            onClick={() =>
              setFeedback((prev) => {
                if (prev[msg.run_id]?.score !== undefined) return prev;

                return {
                  ...prev,
                  [msg.run_id]: {
                    ...prev[msg.run_id],
                    score: 0,
                  },
                };
              })
            }
          >
            👎
            {feedback[msg.run_id]?.score === 0 && (
              <span className="text-xs">✓</span>
            )}
          </button>
        </div>

        {/* Comment box */}
        <textarea
          className="w-full p-2 text-sm border rounded bg-transparent"
          placeholder="Optional feedback..."
          value={feedback[msg.run_id]?.comment || ""}
          onChange={(e) =>
            setFeedback((prev) => ({
              ...prev,
              [msg.run_id]: {
                ...prev[msg.run_id],
                comment: e.target.value,
              },
            }))
          }
        />

        {/* Submit button */}
        <button
          className="px-3 py-1 mt-1 rounded bg-blue-600 text-white hover:opacity-80"
          onClick={() => submitFeedback(msg.run_id)}
        >
          Submit Feedback
        </button>

      </div>
    )}
  </div>
)}
    </div>
  </div>
))}
          {loading && (
            <div className="flex justify-start">
               <div
               className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm ${
                  darkMode
                  ? "bg-zinc-800 text-gray-400"
                  : "bg-gray-200 text-gray-600"
               } animate-pulse`}
               >
                {status === "thinking" ? "Thinking..." : "Typing..."}
              </div>
              
            </div>
          )}       
        </div>
      </main>

      {/* Input Bar */}
<footer className="p-4">
  <div className="mx-auto flex max-w-4xl items-center gap-2 rounded-full bg-zinc-900/70 px-4 py-2 backdrop-blur-md">
    
    <Input
      placeholder="Ask something..."
      value={input}
      disabled={loading}
      onChange={(e) => setInput(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          sendMessage();
        }
      }}
      className="border-0 focus-visible:ring-0 shadow-none bg-transparent text-white"
    />

    <button
      onClick={sendMessage}
      disabled={loading}
      className="p-2 rounded-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition"
    >
      <Send size={18} color="white" />
    </button>

  </div>
</footer>
    </div>
  );
}

export default App;