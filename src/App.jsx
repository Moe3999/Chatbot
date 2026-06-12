
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
