import { useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

function App() {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! How can I help you today?",
    },
    {
      role: "user",
      text: "What is RAG?",
    },
    {
      role: "ai",
      text: "RAG stands for Retrieval-Augmented Generation.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      text: input,
    };

    setMessages((prev) => [...prev, userMessage]);

    const question = input;
    setInput("");
    setLoading(true);

    // Temporary AI message
    setMessages((prev) => [
      ...prev,
      userMessage,
      { role: "ai", text: "Thinking..." },
    ]);

    try {
      const res = await fetch("http://localhost:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
        }),
      });

      const data = await res.json();

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          text: data.answer,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "ai",
          text: "Error connecting to backend.",
        };
        return updated;
      });
    }

    setLoading(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b px-6 py-4">
        <h1 className="text-xl font-bold">AI Chatbot</h1>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`max-w-[70%] rounded-xl px-4 py-3 ${
                msg.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.text}
            </div>
          ))}

          {loading && (
            <div className="text-sm text-muted-foreground">
              AI is typing...
            </div>
          )}
        </div>
      </main>

      {/* Input Bar */}
      <footer className="border-t p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
          <Input
            placeholder="Ask something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                sendMessage();
              }
            }}
          />

          <Button onClick={sendMessage}>Send</Button>
        </div>
      </footer>
    </div>
  );
}

export default App;