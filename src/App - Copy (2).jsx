import { useState } from "react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "How can I help you today?",

    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

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
      <header className="border-b px-6 py-4 flex justify-between items-center">
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
              className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm  text-left ${
                 msg.role === "user"
                 ? darkMode
                  ? "bg-blue-900 text-white rounded-br-md"
                  : "bg-blue-500 text-white rounded-br-md"
                : darkMode
                ? "bg-zinc-800 text-white rounded-bl-md"
                : "bg-gray-200 text-black rounded-bl-md"
              }`}
            >
              {msg.text}
            </div>
          </div>
          ))
          }
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
      <footer className="border-t p-4">
        <div className="mx-auto flex max-w-4xl gap-2">
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
          />

          <Button onClick={sendMessage} disabled={loading}>
            {loading ? "Sending..." : "Send"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default App;