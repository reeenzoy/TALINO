import {
  useCallback, useEffect, useMemo, useRef, useState, createContext, useContext,
} from "react";
import axios from "axios";
import { useAuth } from "./auth/AuthProvider";
import AuthPage from "./pages/AuthPage";
import Composer from "./components/Composer";
import MessageList from "./components/MessageList";
import PromptChips from "./components/PromptChips";
import Sidebar from "./components/Sidebar";

const BOT = "bot";
const USER = "user";

const ThemeContext = createContext({ theme: "system", setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

export default function AuthedApp() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [conversationMemory, setConversationMemory] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [related, setRelated] = useState([]);
  const [feedbacks, setFeedbacks] = useState({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const abortRef = useRef(null);
  const streamIntervalRef = useRef(null);

  // Auth
  const { user, logout } = useAuth();
  // ⬅️ Do NOT gate the app here (no if (!ready) or if (!user) returns)

  // Theme
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");
  useEffect(() => {
    const root = document.documentElement;
    const apply = (th) => {
      if (th === "system") {
        const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
        root.setAttribute("data-theme", prefersDark ? "dark" : "light");
      } else {
        root.setAttribute("data-theme", th);
      }
    };
    apply(theme);
    localStorage.setItem("theme", theme);
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e) => theme === "system" && root.setAttribute("data-theme", e.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const suggestionButtons = useMemo(
    () => [
      "Who is DOST?",
      "What are the technologies of DOST?",
      "Services of DOST",
    ],
    []
  );

  const pickPrompt = (t) => {
    setInput(t);
    setTimeout(() => sendMessage(), 10);
  };

  const handleFeedback = (idx, value) => setFeedbacks((p) => ({ ...p, [idx]: value }));

  const fetchRecommendations = async (prompt) => {
    setRecLoading(true);
    setRelated([]);
    try {
      const { data } = await axios.post("/api/recommendations", { prompt, n_suggestions: 5 });
      setRelated(data?.recommended_questions || []);
    } catch {
      setRelated([]);
    } finally {
      setRecLoading(false);
    }
  };

  const streamBotMessage = (fullMsg, botMsgIndex, onDone) => {
    setMessages((prev) => {
      const arr = [...prev];
      if (arr[botMsgIndex]) arr[botMsgIndex] = { ...arr[botMsgIndex], loading: false, content: "" };
      return arr;
    });

    let i = 0;
    streamIntervalRef.current = setInterval(() => {
      setMessages((prev) => {
        const arr = [...prev];
        if (arr[botMsgIndex]) arr[botMsgIndex].content = fullMsg.slice(0, i + 1);
        return arr;
      });
      i++;
      if (i >= fullMsg.length) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        onDone?.();
      }
    }, 15);
  };

  const sendMessage = useCallback(async () => {
    const messageToSend = input;
    if (!messageToSend.trim() || isGenerating) return;
    setHasInteracted(true);
    setIsGenerating(true);

    setMessages((prev) => [
      ...prev,
      { role: USER, content: messageToSend },
      { role: BOT, content: "", loading: true, complete: false },
    ]);
    setInput("");

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const { data } = await axios.post(
        "/api/chat",
        { input: messageToSend, session_id: sessionId },
        { signal: controller.signal }
      );
      if (data?.session_id) setSessionId(data.session_id);
      setConversationMemory(data?.conversation_memory || {});
      const botMsgIndex = messages.length + 1;

      streamBotMessage(data?.output || "", botMsgIndex, async () => {
        setMessages((prev) => {
          const arr = [...prev];
          if (arr[botMsgIndex]) arr[botMsgIndex] = { ...arr[botMsgIndex], content: data?.output || "", complete: true };
          return arr;
        });
        await fetchRecommendations(messageToSend);
        setIsGenerating(false);
      });
    } catch (err) {
      const botMsgIndex = messages.length + 1;
      const errorMessage =
        err?.name === "CanceledError"
          ? "Generation stopped."
          : err?.response?.data?.error || "Error: Could not reach backend.";
      setMessages((prev) => {
        const arr = [...prev];
        if (arr[botMsgIndex]) arr[botMsgIndex] = { ...arr[botMsgIndex], content: errorMessage, loading: false, complete: true };
        return arr;
      });
      setIsGenerating(false);
    } finally {
      abortRef.current = null;
    }
  }, [input, isGenerating, messages.length, sessionId]);

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    setMessages((prev) => {
      const arr = [...prev];
      for (let i = arr.length - 1; i >= 0; i--) {
        if (arr[i].role === BOT && !arr[i].complete) {
          arr[i] = { ...arr[i], complete: true, loading: false };
          break;
        }
      }
      return arr;
    });
    setIsGenerating(false);
  };

  const newSession = () => {
    setMessages([]);
    setConversationMemory({});
    setSessionId(null);
    setFeedbacks({});
    setHasInteracted(false);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <main className="min-h-svh bg-bgp text-textp">
        <div className="flex">
          <Sidebar />
          <div className="min-w-0 flex-1 flex flex-col">
            <header className="sticky top-0 z-10 bg-bgp/60 backdrop-blur">
              <div className="mx-auto flex h-14 w-full items-center justify-between px-4">
                <div className="flex items-center gap-2 justify-start">
                  <span className="text-xl font-semibold text-texts">TALINO</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                    className="rounded-md border border-borderc bg-bgs px-2 py-1 text-sm text-textp"
                    title="Theme"
                  >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select> */}

                  {/* Refresh Page */}

                  {/* <button
                    className="rounded-md border border-borderc bg-bgs px-2 py-1 text-sm text-texts hover:bg-bgs/60"
                    onClick={() => location.reload()}
                    title="Reload"
                  >
                    ↻
                  </button> */}
                  {user ? (
                    <button>
                      
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="rounded-md border border-borderc bg-bgs px-2 py-1 text-sm text-textp hover:bg-bgs/60"
                      title="Login or Register"
                    >
                      Login / Register
                    </button>
                  )}
                </div>
              </div>
            </header>

            <section className="mx-auto grid w-full max-w-5xl flex-1 grid-rows-[1fr_auto] gap-4 px-4 pb-6">
              <div className="flex justify-center w-full flex-1 px-4 items-start">
                <div className="w-full max-w-3xl text-center">
                  {messages.filter((m) => m.role === USER).length === 0 ? (
                    <>
                      <div className="mb-6">
                        <div className="mx-auto mb-2 inline-grid place-items-center">
                          <div className="h-[80px] w-[80px] rounded-full flex items-center justify-center overflow-hidden">
                            <img 
                              src="/logo.png" 
                              alt="TALINO AI Logo" 
                              className="h-full w-full object-contain"
                            />
                          </div>
                        </div>
                        <div className="text-xl font-bold text-textp">Welcome to TALINO.AI</div>
                        <div className="mt-2 text-[1.05rem] font-medium italic text-accent">
                          Science and Technology Within Everyone’s Reach
                        </div>
                      </div>

                      <Composer
                        value={input}
                        onChange={setInput}
                        onSubmit={sendMessage}
                        isLoading={false}
                        isGenerating={isGenerating}
                        onStop={handleStop}
                      />

                      {!hasInteracted && <PromptChips items={suggestionButtons} onPick={pickPrompt} />}
                    </>
                  ) : (
                    <MessageList
                      items={messages}
                      recLoading={recLoading}
                      related={related}
                      onPickRelated={(q) => {
                        setInput(q);
                        setTimeout(() => sendMessage(), 10);
                      }}
                      feedbacks={feedbacks}
                      onFeedback={handleFeedback}
                    />
                  )}
                </div>
              </div>

              {messages.length > 0 && (
                <div className="mx-auto w-full max-w-3xl">
                  <Composer
                    value={input}
                    onChange={setInput}
                    onSubmit={sendMessage}
                    isLoading={false}
                    isGenerating={isGenerating}
                    onStop={handleStop}
                  />
                </div>
              )}
              {/* Footer (bottom of the right column) */}
              {messages.filter((m) => m.role === USER).length === 0 && (
                <footer>
                  <div className="mx-auto w-full max-w-5xl px-4">
                    <div className="flex flex-col items-center">
                      <p className="text-sm text-texts">In partnership with</p>
                      <div className="mt-2 flex gap-8">
                        <div
                          className="h-[60px] w-[60px]"
                          title="Advanced Science and Technology Institute (ASTI)"
                        >
                          <img 
                            src="/asti.png" 
                            alt="ASTI Logo" 
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div
                          className="h-[70px] w-[70px]"
                          title="Caraga State University"  
                        >
                          <img 
                            src="/csu.png" 
                            alt="CSU Logo" 
                            className="h-full w-full object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </footer>
              )}
            </section>
          </div>
        </div>

        {/* Auth modal (optional login) */}
        {!user && showAuth && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <div className="relative w-full max-w-sm">
              <button
                onClick={() => setShowAuth(false)}
                className="absolute -right-2 -top-2 rounded-full bg-bgs px-2 py-1 text-sm text-textp border border-borderc"
                aria-label="Close"
              >
                ✕
              </button>
              <AuthPage />
            </div>
          </div>
        )}
      </main>
    </ThemeContext.Provider>
  );
}