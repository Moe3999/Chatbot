
import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Download } from "lucide-react";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
function Citation({ number, onClick }) {
  return (
    <sup
      onClick={() => onClick(number)}
      className="cursor-pointer text-blue-400 mx-1 hover:underline"
    >
      [{number}]
    </sup>
  );
}
function App() {
  const [exportOpen, setExportOpen] = useState(false);
  const [versionPanel, setVersionPanel] = useState({});
  const citationRefs = useRef({});
  const [openPanel, setOpenPanel] = useState(null);
  const [tourCompleted, setTourCompleted] = useState(false);
  const [openFeedback, setOpenFeedback] = useState({});
  const [mode, setMode] = useState("chat");
  const [darkMode, setDarkMode] = useState(true);
  const [status, setStatus] = useState("");
  const [tourIndex, setTourIndex] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const [messages, setMessages] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [chats, setChats] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [renamingThread, setRenamingThread] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [threadTitles, setThreadTitles] = useState({});
  const [compareMode, setCompareMode] = useState(false);
const [compareResult, setCompareResult] = useState({ a: null, b: null });
const runComparison = async (msg) => {
  setLoadingCompare(true);

  const res = await fetch("http://localhost:8000/regenerate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id: msg.run_id }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }

  setCompareResult({
    a: msg.content,   // original
    b: text           // regenerated
  });

  setLoadingCompare(false);
};
const [loadingCompare, setLoadingCompare] = useState(false);
  const [openCitations, setOpenCitations] = useState({});
  const exportChat = (type) => {
  const threadMessages = messages.filter(
    m => m.thread_id === activeThread
  );

  if (!threadMessages.length) return;

  // ---------------- MD EXPORT ----------------
  if (type === "md") {
    let md = `# Chat Export\n\n`;

    threadMessages.forEach(msg => {
      md += `## ${msg.role === "user" ? "User" : "AI"}\n\n`;
      md += `${msg.content}\n\n`;
    });

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${activeThread}.md`;
    a.click();

    URL.revokeObjectURL(url);
  }

  // ---------------- PDF EXPORT ----------------
  if (type === "pdf") {
    import("jspdf").then(({ default: jsPDF }) => {
      import("html2canvas").then(({ default: html2canvas }) => {
        const element = document.createElement("div");

        element.style.padding = "20px";

        element.innerHTML = threadMessages
          .map(
            msg => `
              <div style="margin-bottom:20px;">
                <h3>${msg.role.toUpperCase()}</h3>
                <p>${msg.content.replace(/\n/g, "<br/>")}</p>
              </div>
            `
          )
          .join("");

        document.body.appendChild(element);

        html2canvas(element).then(canvas => {
          const imgData = canvas.toDataURL("image/png");

          const pdf = new jsPDF();

          const width = pdf.internal.pageSize.getWidth();
          const height = (canvas.height * width) / canvas.width;

          pdf.addImage(imgData, "PNG", 0, 0, width, height);
          pdf.save(`chat-${activeThread}.pdf`);

          document.body.removeChild(element);
        });
      });
    });
  }

  setExportOpen(false);
};
const renderWithCitations = (text, msg) => {
  if (!text) return null;

  const parts = String(text).split(/(\[\d+\])/g);

  return parts.map((part, i) => {
    const match = part.match(/\[(\d+)\]/);

    if (!match) return part;

    const number = Number(match[1]);

    return (
      <Citation
        key={`${msg.run_id}-${i}`}
        number={number}
        onClick={(num) => {
          const key = `${msg.run_id}-${num}`;

          setOpenCitations((prev) => ({
            ...prev,
            [msg.run_id]: true,
          }));

          requestAnimationFrame(() => {
            citationRefs.current[key]?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          });
        }}
      />
    );
  });
};  const getTarget = (key) => {
  return document.querySelector(`[data-tour="${key}"]`);
};
    const tourSteps = [
  {
    target: "mode-switch",
    title: "Chat Modes",
    text: "Switch between Chat, RAG, and Hybrid modes here.",
  },
  {
    target: "chat-list",
    title: "Your Chats",
    text: "All your previous conversations are stored here.",
  },
  {
    target: "input-box",
    title: "Ask Anything",
    text: "Type your message and press Enter or send.",
  },
];
  const messagesEndRef = useRef(null);
  const streamingRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
  if (!showTour) return;

  const step = tourSteps[tourIndex];
  const el = getTarget(step.target);

  if (el) {
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}, [tourIndex, showTour]);
useEffect(() => {
  const timeout = setTimeout(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, 0);

  return () => clearTimeout(timeout);
}, [activeThread, messages]);

  const question = input.trim();
  const createNewChat = () => {
  const newThreadId = crypto.randomUUID();
  setActiveThread(newThreadId);
  localStorage.setItem("activeThread", newThreadId);

  setMessages(prev => [
    ...prev,
    {
      role: "system",
      content: "How can I help you?",
      thread_id: newThreadId,
    },
  ]);
};

const threadId = activeThread;
const renameThread = (threadId) => {
  const updated = {
    ...threadTitles,
    [threadId]: renameValue
  };

  setThreadTitles(updated);

  localStorage.setItem("threadTitles", JSON.stringify(updated));

  setRenamingThread(null);
  setRenameValue("");
};
const deleteThread = async (threadId) => {
  try {
    await fetch(`http://localhost:8000/thread/${threadId}`, {
      method: "DELETE",
    });

    setMessages(prev => prev.filter(m => m.thread_id !== threadId));
    setChats(prev => prev.filter(t => t.thread_id !== threadId));

    if (activeThread === threadId) {
      const remaining = messages.filter(m => m.thread_id !== threadId);
      const nextThread = remaining[0]?.thread_id || null;

      setActiveThread(nextThread);
      localStorage.setItem("activeThread", nextThread || "");
    }
  } catch (err) {
    console.error("Delete failed:", err);
  }
};
const userMessage = {
  
  role: "user",
  content: question,
  thread_id: threadId,
};
const threads = Object.values(
  messages.reduce((acc, msg) => {
    if (!msg.thread_id) return acc;

    if (!acc[msg.thread_id]) {
      acc[msg.thread_id] = {
        thread_id: msg.thread_id,
        messages: [],
        title: null,
      };
    }

    acc[msg.thread_id].messages.push(msg);

    return acc;
  }, {})
);
const activeMessages = messages.filter(
  m => m.thread_id === activeThread
);
console.log("ACTIVE THREAD:", activeThread);
console.log("ACTIVE MESSAGES:", activeMessages);
console.log("ALL MESSAGES:", messages);
console.log(
  messages.map(m => ({
    thread_id: m.thread_id,
    role: m.role,
    content: m.content
  }))
);
useEffect(() => {
  const saved = localStorage.getItem("threadTitles");
  if (saved) {
    setThreadTitles(JSON.parse(saved));
  }
}, []);
useEffect(() => {
  const saved = localStorage.getItem("feedback");
  if (saved) {
    setFeedback(JSON.parse(saved));
  }
}, []);
useEffect(() => {
  localStorage.setItem("feedback", JSON.stringify(feedback));
}, [feedback]);
useEffect(() => {
  fetch("http://localhost:8000/history")
    .then(res => res.json())
    .then(data => {
      console.log("HISTORY:", data);
      setChats(data);
      setMessages(data.map(msg => ({
        ...msg,
        toggle: msg.toggle || null,
        citations: msg.citations || [],
      })));
      const loadedFeedback = {};
      console.log(
  "AI MESSAGES:",
  data
    .filter(m => m.role === "ai")
    .map(m => ({
      run_id: m.run_id,
      current_version: m.current_version,
      versions: m.versions
    }))
);

data.forEach(msg => {
  if (
    msg.run_id &&
    msg.feedback_score !== undefined
  ) {
    loadedFeedback[msg.run_id] = {
      score: msg.feedback_score,
      comment: msg.feedback_comment || "",
      sent: true
    };
  }
});

setFeedback(loadedFeedback);

      const savedThread = localStorage.getItem("activeThread");
      if (savedThread) setActiveThread(savedThread);
      else if (data.length > 0) setActiveThread(data[data.length - 1].thread_id);
    });
}, []);
// On mode change
useEffect(() => {
  localStorage.setItem("lastMode", mode);
}, [mode]);

// On component mount
useEffect(() => {
  const savedMode = localStorage.getItem("lastMode");
  if (savedMode) setMode(savedMode);
}, []);
{messages.length === 0 && (
  <div className="text-center opacity-60">
    How can I help you today?
  </div>
)}

  const submitFeedback = async (runId, override = null) => {
  try {
    const data = override || feedback[runId];

    await fetch("http://localhost:8000/api/feedback", {
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
const runMetaRef = useRef({
  runId: null,
  toggle: null,
  citations: []
});

let answer = "";
let buffer = "";
const sendMessage = async () => {
  if (!input.trim() || loading) return;

  const question = input.trim();
  const tempId = crypto.randomUUID();
  streamingRef.current = tempId;
  const newThreadId = activeThread ?? crypto.randomUUID();
  console.log("Sending with thread:", newThreadId);
  console.log("ACTIVE THREAD:", activeThread);
  console.log("NEW THREAD:", newThreadId);

  setActiveThread(newThreadId);
  localStorage.setItem("activeThread", newThreadId); // must come BEFORE setMessages

  const userMessage = {
    role: "user",
    content: question,
    thread_id: newThreadId,
  };

  setInput("");
  setLoading(true);
  setStatus("thinking");


  
setMessages(prev => [
  ...prev,
  userMessage,
  {
    role: "ai",
    content: "",
    thread_id: newThreadId,
    tempId,
    run_id: null,
    citations: [],
  },
]);

setLoading(true);
setStatus("thinking");

try {
  const res = await fetch("http://localhost:8000/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: question,
      mode: mode,
      thread_id: newThreadId,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    if (streamingRef.current !== tempId) return;

    if (status !== "typing") {
      setStatus("typing");
    }

    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop() || "";

    for (const event of events) {
      if (!event.startsWith("data: ")) continue;

      try {
        const payload = JSON.parse(event.replace(/^data:\s*/, ""));

        if (payload.type === "meta") {
          runMetaRef.current = {
            runId: payload.run_id,
            toggle: payload.toggle,
            citations: payload.citations || [],
          };
          continue;
        }

        if (payload.type === "token") {
          answer += payload.token;

          const meta = runMetaRef.current;

          setMessages(prev =>
            prev.map(m =>
              m.tempId === tempId
                ? {
                    ...m,
                    content: answer,
                    run_id: meta.runId,
                    toggle: meta.toggle,
                    citations: meta.citations || [],
                  }
                : m
            )
          );

          requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({
              behavior: "smooth",
            });
          });
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    }
  }

  // optional final cleanup message fix
} catch (err) {
  console.error("Request failed:", err);

  setMessages(prev =>
    prev.map(m =>
      m.tempId === tempId
        ? {
            ...m,
            content: "Error connecting to backend.",
          }
        : m
    )
  );
} finally {
  setLoading(false);
  setStatus("");
}
  };
  
  return (
    <div 
      className={`flex h-screen ${
    darkMode ? "bg-black text-white" : "bg-white text-black"
  }`}
>

  {compareResult.a && compareResult.b && (
  <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
    
    <div
      className={`w-[85%] max-h-[85vh] rounded p-4 flex flex-col ${
        darkMode ? "bg-zinc-900 text-white" : "bg-white text-black"
      }`}
    >
      
      {/* CONTENT AREA (scroll only this) */}
      <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
        
        <div className="overflow-y-auto pr-2 max-h-[70vh]">
          <h3 className="font-bold mb-2">Original</h3>
          <div className="whitespace-pre-wrap text-sm">
            {compareResult.a}
          </div>
        </div>

        <div className="overflow-y-auto pr-2 max-h-[70vh]">
          <h3 className="font-bold mb-2">Regenerated</h3>
          <div className="whitespace-pre-wrap text-sm">
            {compareResult.b}
          </div>
        </div>

      </div>

      {/* FOOTER (NOT scrollable) */}
      <div className="mt-4 flex justify-end">
        <button
          className={`px-4 py-2 rounded ${
            darkMode
              ? "bg-red-600 hover:bg-red-700"
              : "bg-red-500 hover:bg-red-600"
          } text-white`}
          onClick={() => setCompareResult({ a: null, b: null })}
        >
          Close
        </button>
      </div>

    </div>
  </div>
)}
  {/* SIDEBAR */}

{/* SIDEBAR */}
<div
  className={`w-64 border-r overflow-y-auto transition flex flex-col ${
    darkMode
      ? "bg-black border-zinc-800 text-white"
      : "bg-white border-zinc-200 text-black"
  }`}
>

  {/* HEADER */}
  <div className="flex items-center justify-between mb-2 p-2">
    <h2 style={{ color: darkMode ? "white" : "black" }}>
  Chats
</h2>
<div className="relative">
  {/* ICON BUTTON */}
  <button
    onClick={(e) => {
      e.stopPropagation();
      setExportOpen(prev => !prev);
    }}
    className="p-2 rounded hover:bg-zinc-800 transition"
    title="Download chat"
  >
    <Download size={18} />
  </button>

  {/* DROPDOWN */}
  {exportOpen && (
    <div className="absolute right-0 mt-2 bg-zinc-900 border rounded shadow-lg text-xs min-w-[140px] z-50">
      <button
        onClick={() => exportChat("md")}
        className="block px-3 py-2 hover:bg-zinc-700 w-full text-left"
      >
        Download .md
      </button>

      <button
        onClick={() => exportChat("pdf")}
        className="block px-3 py-2 hover:bg-zinc-700 w-full text-left"
      >
        Download .pdf
      </button>
    </div>
  )}
</div>
    <button
      data-tour="new-chat"
      onClick={createNewChat}
      className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-700 text-white text-lg"
    >
      +
    </button>
  </div>

  {/* CHAT LIST */}
 <div
  data-tour="chat-list"

 className="p-2 flex-1 overflow-y-auto pb-4"
>
    {threads.map((thread) => (
      <div
  key={thread.thread_id}
  className={`group p-2 flex items-center justify-between cursor-pointer rounded-lg transition ${
    activeThread === thread.thread_id
      ? darkMode
        ? "bg-zinc-700 text-white"
        : "bg-gray-200 text-black"
      : darkMode
      ? "hover:bg-zinc-800 text-white"
      : "hover:bg-gray-100 text-black"
  }`}
  onClick={() => {
    setActiveThread(thread.thread_id);
    localStorage.setItem("activeThread", thread.thread_id);
  }}
>
  {/* Chat title */}
  {renamingThread === thread.thread_id ? (
    <input
      value={renameValue}
      autoFocus
      onChange={(e) => setRenameValue(e.target.value)}
      onBlur={() => renameThread(thread.thread_id)}
      onKeyDown={(e) => {
        if (e.key === "Enter") renameThread(thread.thread_id);
      }}
      className="bg-transparent border-b outline-none text-sm w-full"
    />
  ) : (
    <span className="truncate text-sm">
      {threadTitles[thread.thread_id] ||
        thread.messages.find(m => m.role === "user")?.content?.slice(0, 30) ||
        "New Chat"}
    </span>
  )}

  {/* Buttons side by side */}
  <div className="flex items-center gap-2">
    <button
      onClick={(e) => {
        e.stopPropagation();
        setRenamingThread(thread.thread_id);
        setRenameValue(thread.title || "");
      }}
      className={`${darkMode ? "text-white" : "text-black"} hover:opacity-70`}
    >
      ✎
    </button>

    <button
      onClick={(e) => {
        e.stopPropagation();
        deleteThread(thread.thread_id);
      }}
      className={`${darkMode ? "text-white" : "text-black"} hover:opacity-70`}
    >
      ✕
    </button>
  </div>
</div>
))}
</div>
</div>
    {/* RIGHT SIDE (CHAT AREA) */}
    <div className="flex flex-col flex-1">

      {/* Header */}
<header className="px-6 py-4 flex items-center justify-between">
  
  {/* Title */}
<h1
    className="text-xl font-bold"
    style={{ color: darkMode ? "white" : "black" }}
  >
    Chatbot
  </h1>
  <div className="flex items-center gap-4">
    {/* Mode Switch */}
    <div
      data-tour="mode-switch"
      className={`relative flex w-52 rounded-full p-1 ${
        darkMode ? "bg-zinc-800" : "bg-gray-200"
      }`}
    >
    {/* SLIDER */}
    <div
      className={`absolute top-1 bottom-1 w-1/3 rounded-full transition-all duration-300
        ${darkMode ? "bg-blue-600" : "bg-blue-500"}
        ${mode === "rag" ? "left-0" : ""}
        ${mode === "hybrid" ? "left-1/3" : ""}
        ${mode === "chat" ? "left-2/3" : ""}
      `}
    />

    <button onClick={() => setMode("rag")} className="w-1/3 text-xs z-10">
      📄
    </button>

    <button onClick={() => setMode("hybrid")} className="w-1/3 text-xs z-10">
      🌐
    </button>

    <button onClick={() => setMode("chat")} className="w-1/3 text-xs z-10">
      💬
    </button>
  </div>

    <button onClick={() => setDarkMode(p => !p)}>
      {darkMode ? "☀️ Light" : "🌙 Dark"}
    </button>

    <div className="w-[100px] flex justify-center">
      {!showTour && !tourCompleted && (
        <button
          onClick={() => {
            setTourIndex(0);
            setShowTour(true);
          }}
          className="text-sm px-3 py-1 rounded bg-blue-600 text-white"
        >
          Start Tour
        </button>
      )}
    </div>
  </div>
</header>

      {/* Chat Area */}
      
      <main 
        className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-3">
{activeMessages.map((msg, index) => (
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

    p: ({ children }) => {
      return <p>{renderWithCitations(children, msg)}</p>;
    },
  }}
>
  {msg.content}
</ReactMarkdown>
{msg.role === "ai" && (
  <>
    {versionPanel?.[msg.run_id] && (
  <div
    className={`mt-2 p-2 border rounded text-xs space-y-2 ${
      darkMode
        ? "bg-zinc-900 border-zinc-700 text-white"
        : "bg-white border-zinc-300 text-black"
    }`}
  >
    {[...(msg.versions || [])]
      .sort((a, b) => a.version - b.version)
      .map((v) => (
        <div
          key={`${msg.run_id}-v${v.version}`}
          className={`cursor-pointer p-2 rounded transition ${
            Number(msg.current_version) === Number(v.version)
              ? darkMode
                ? "bg-blue-600 text-white"
                : "bg-blue-500 text-white"
              : darkMode
              ? "hover:bg-zinc-800"
              : "hover:bg-gray-100"
          }`}
          onClick={() => {
            setMessages(prev =>
              prev.map(m =>
                m.run_id === msg.run_id
                  ? {
                      ...m,
                      content: v.content,
                      current_version: v.version,
                    }
                  : m
              )
            );
          }}
        >
          Version {v.version}
        </div>
      ))}
  </div>
)}
  </>
)}

{/* FEEDBACK PANEL */}
{msg.role === "ai" && msg.run_id && (
<div className="mt-3 flex flex-col gap-2">

  {/* MODE + CITATIONS ONLY (NO FEEDBACK BUTTON HERE) */}
  <div className="flex items-center gap-4">
    <span className="text-xs opacity-60">
      Mode: {msg.toggle?.toUpperCase()}
    </span>
<button
  className="text-xs opacity-70 hover:opacity-100"
  onClick={async () => {
    streamingRef.current = msg.run_id;
    const res = await fetch("http://localhost:8000/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: msg.run_id }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let answer = "";

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      answer += decoder.decode(value);

      setMessages(prev =>
  prev.map(m =>
    m.run_id === msg.run_id && m.role === "ai"
      ? {
          ...m,
          content: answer,
        }
      : m
  )
);
    }

    // refresh versions from backend after stream finishes
    const historyRes = await fetch(
  `http://localhost:8000/message/${msg.run_id}`
);

const updated = await historyRes.json();

setMessages(prev =>
  prev.map(m =>
    m.run_id === msg.run_id
      ? {
          ...m,
          content: updated.content,
          versions: updated.versions,
          current_version: updated.current_version,
        }
      : m
  )
);
    const uniqueVersions = Array.from(
  new Map(
    (updated.versions || []).map(v => [v.version, v])
  ).values()
);

    setMessages(prev =>
  prev.map(m =>
    m.run_id === msg.run_id
      ? {
          ...m,
          versions: [...uniqueVersions], // ✅ force new reference
          current_version: Number(updated.current_version), // ✅ ensure correct type
          content: updated.content ?? m.content, // ✅ optional but important
        }
      : m
  )
);
  }}
>
  🔄 
</button>

<button
  className={`text-xs ml-2 opacity-70 hover:opacity-100 transition ${
    darkMode ? "text-white" : "text-black"
  }`}
  onClick={() =>
    setVersionPanel(prev => ({
      ...prev,
      [msg.run_id]: !prev[msg.run_id],
    }))
  }
>
  🧾 ({msg.versions?.length || 1})
</button>
    <button
      className="text-sm opacity-70 hover:opacity-100 transition"
      onClick={() => {
        setOpenFeedback({});
        setOpenCitations((prev) => ({
          ...prev,
          [msg.run_id]: !prev[msg.run_id],
        }));
      }}
    >
      📘 ({msg.citations.length})
    </button>
    <button
  className="text-xs opacity-70 hover:opacity-100 ml-2"
  onClick={() => runComparison(msg)}
>
  ⚖️
</button>
  </div>

  {/* 👍 / 👎 */}
  <div className="flex gap-2 items-center">

    {/* 👍 AUTO SUBMIT */}
    <button
      className={`text-lg hover:scale-110 transition ${
        feedback[msg.run_id]?.score === 1 ? "text-green-500" : ""
      }`}
      disabled={feedback[msg.run_id]?.score !== undefined}
      onClick={async () => {
  const fb = {
    score: 1,
    comment: "",
    sent: true
  };

  setFeedback(prev => ({
    ...prev,
    [msg.run_id]: fb
  }));

  await submitFeedback(msg.run_id, fb);
}}  >
      👍
      {feedback[msg.run_id]?.score === 1 && (
        <span className="text-xs">✓</span>
      )}
    </button>

    {/* 👎 OPENS PANEL */}
    <button
      className={`text-lg hover:scale-110 transition ${
        feedback[msg.run_id]?.score === 0 ? "text-red-500" : ""
      }`}
      disabled={feedback[msg.run_id]?.score !== undefined}
      onClick={() => {
  setFeedback(prev => ({
    ...prev,
    [msg.run_id]: {
      score: 0,
      comment: "",
      sent: false
    }
  }));

  setOpenFeedback(prev => ({
    ...prev,
    [msg.run_id]: true,
  }));
}}
    >
      👎

      {/* 👇 SENT LABEL */}
      {feedback[msg.run_id]?.score === 0 &&
 feedback[msg.run_id]?.sent && (
  <span className="ml-2 text-xs text-red-500">
    Sent
  </span>
)}
    </button>
  </div>

  {/* 👎 ONLY PANEL */}
  {openFeedback[msg.run_id] && (
    <div className="flex flex-col gap-2">

      <textarea
        className="w-full p-2 text-sm border rounded bg-transparent"
        placeholder="Optional feedback..."
        value={feedback[msg.run_id]?.comment || ""}
        onChange={(e) =>
          setFeedback(prev => ({
            ...prev,
            [msg.run_id]: {
              ...prev[msg.run_id],
              comment: e.target.value,
            },
          }))
        }
      />

      <button
        className="px-3 py-1 mt-1 rounded bg-blue-600 text-white hover:opacity-80"
        onClick={async () => {
  await submitFeedback(msg.run_id);

  setFeedback(prev => ({
    ...prev,
    [msg.run_id]: {
      ...prev[msg.run_id],
      sent: true,
    },
  }));

  setOpenFeedback(prev => ({
    ...prev,
    [msg.run_id]: false,
  }));
}}
      >
        Submit Feedback
      </button>

    </div>
  )}
</div>
)}

{openCitations[msg.run_id] && (
  <div className="mt-2 p-2 rounded border text-xs flex flex-col gap-2">
    {msg.citations.map((c, i) => {
  const key = `${msg.run_id}-${i + 1}`;

  return (
    <div
      key={i}
      ref={(el) => {
        if (el) citationRefs.current[key] = el;
      }}
      className="py-2"
    >
      <div className="text-xs font-semibold">
        [{c.id}] {c.source}
      </div>

      <div className="text-xs opacity-70">
        Page {c.page}
      </div>

      {c.content && (
        <div className="text-xs opacity-60 mt-1">
          {c.content}
        </div>
      )}

      {/* subtle divider */}
      {i !== msg.citations.length - 1 && (
        <div className="border-b border-zinc-700 mt-2" />
      )}
    </div>
  );
})}
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
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
<footer className="p-4">
  <div
    data-tour="input-box"
    className={`mx-auto flex max-w-4xl items-center gap-2
      rounded-2xl border px-3 py-2 transition
      ${
        darkMode
          ? "bg-zinc-900 border-zinc-700"
          : "bg-white border-zinc-300"
      }`}
  >
    <Input
      placeholder="Ask something..."
      value={input}
      disabled={loading}
      onChange={(e) => setInput(e.target.value)}
     onKeyDown={(e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
}}
      className={`flex-1 border-0 shadow-none focus-visible:ring-0 bg-transparent
        ${darkMode ? "text-white placeholder:text-zinc-400" : "text-black placeholder:text-zinc-500"}
      `}
    />

    <button
      onClick={sendMessage}
      disabled={loading}
      className={`p-2 rounded-xl transition disabled:opacity-50
        ${
          darkMode
            ? "bg-blue-600 hover:bg-blue-700"
            : "bg-blue-500 hover:bg-blue-600"
        }`}
    >
      <Send size={18} color="white" />
    </button>
  </div>
</footer>

{showTour && (() => {
 if (!showTour) return null;

const step = tourSteps[tourIndex];

// 🛑 SAFETY CHECK (this prevents blank screen)
if (!step) return null;

const el = getTarget(step.target);

// if element not found, don't crash UI
if (!el) return null;

const rect = el.getBoundingClientRect();

const tooltipWidth = 280;
const tooltipHeight = 140;
const padding = 12;

let top = rect.bottom + 10;
let left = rect.left;

// ONLY chat-list goes right
if (step.target === "chat-list") {
  left = rect.right + 12;
  top = rect.top;
}

// clamp X
left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));

// clamp Y
top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

let highlightTop = rect.top - 6;
let highlightLeft = rect.left - 4;

// ONLY chat-list goes slightly above browser edge
if (step.target === "chat-list") {
  highlightTop = rect.top - 18;
}

// final style
const highlightStyle = {
  top: highlightTop,
  left: highlightLeft,
  width: rect.width + 8,
  height: rect.height + 12,
};
  return (
    <div className="fixed inset-0 z-50 bg-black/60">

      {/* Highlight box */}
      <div
        className="absolute border-2 border-blue-500 rounded-lg"
        style={highlightStyle}
      />

      {/* Tooltip */}
      <div
        className="absolute bg-white text-black p-3 rounded-lg shadow-lg w-64"
 style={{
  top,
  left,
}}
      >
        <h3 className="font-bold">{step.title}</h3>
        <p className="text-sm">{step.text}</p>

        <div className="flex justify-between mt-3">
          <button
            onClick={() =>
              setTourIndex((i) => Math.max(i - 1, 0))
            }
          >
            Back
          </button>

          <button
onClick={() => {
  if (tourIndex < tourSteps.length - 1) {
    setTourIndex(i => i + 1);
  } else {
    setShowTour(false);
    setTourIndex(0);
    setTourCompleted(true); // 👈 key part
  }
}}
          >
            {tourIndex === tourSteps.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
})()}
    </div>
    </div>
  );
  
}

export default App;