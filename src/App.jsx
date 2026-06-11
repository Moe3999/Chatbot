
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