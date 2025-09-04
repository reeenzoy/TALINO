import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import axios from "axios";

import { useAuth } from "./auth/AuthProvider";
import AuthPage from "./pages/AuthPage";
import Composer from "./components/Composer";
import MessageList from "./components/MessageList";
import PromptChips from "./components/PromptChips";
import Sidebar from "./components/Sidebar";

const BOT = "assistant";
const USER = "user";

const ThemeContext = createContext({ theme: "system", setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// send cookies to Express/FastAPI through Vite proxy
axios.defaults.withCredentials = true;

export default function AuthedApp() {
  // chat state
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null); // FastAPI memory key
  const [isGenerating, setIsGenerating] = useState(false);

  // history state (DB)
  const [conversationId, setConversationId] = useState(null); // Prisma conversation id
  const [conversations, setConversations] = useState([]);

  // UI helpers
  const [recLoading, setRecLoading] = useState(false);
  const [related, setRelated] = useState([]);
  const [feedbacks, setFeedbacks] = useState({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const abortRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const botIndexRef = useRef(-1);

  const { user, logout } = useAuth();

  // ✅ mobile drawer — declare ONCE
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    const onChange = (e) =>
      theme === "system" && root.setAttribute("data-theme", e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // default suggestions
  const suggestionButtons = useMemo(
    () => ["Who is DOST?", "What are the technologies of DOST?", "Services of DOST"],
    []
  );

  const pickPrompt = (t) => {
    setInput(t);
    setTimeout(() => sendMessage(), 10);
  };

  const handleFeedback = (idx, value) =>
    setFeedbacks((p) => ({ ...p, [idx]: value }));

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

  // --- HISTORY: load after login
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setConversationId(null);
      return;
    }
    (async () => {
      try {
        const { data } = await axios.get("/api/app/conversations");
        setConversations(Array.isArray(data.items) ? data.items : []);
      } catch {
        setConversations([]);
      }
    })();
  }, [user]);

  // cleanup (abort streaming on unmount)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
    };
  }, []);

  // --- ensure a conversation exists (create on first send)
  const ensureConversation = useCallback(
    async (titleSeed) => {
      if (conversationId) return conversationId;
      if (!user) return null; // skip persistence if not logged in

      const { data } = await axios.post("/api/app/conversations", {
        title: String(titleSeed || "New chat").slice(0, 120),
      });
      setConversationId(data.id);

      // refresh list to show it in History
      try {
        const { data: list } = await axios.get("/api/app/conversations");
        setConversations(Array.isArray(list.items) ? list.items : []);
      } catch {}

      // align FastAPI memory session with DB id so you can resume later
      setSessionId(data.id);
      return data.id;
    },
    [conversationId, user]
  );

  // --- open a conversation from the sidebar
  const openConversation = useCallback(async (id) => {
    setConversationId(id);
    setSessionId(id); // align memory
    try {
      const { data } = await axios.get(`/api/app/conversations/${id}/messages`);
      const items = Array.isArray(data.items) ? data.items : [];
      setMessages(
        items.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }))
      );
    } catch {
      setMessages([]);
    }
  }, []);

  // fake streaming (typing effect)
  const streamBotMessage = (fullMsg, botMsgIndex, onDone) => {
    // keep loading: true; just clear content before typing
    setMessages((prev) => {
      const arr = [...prev];
      if (arr[botMsgIndex]) arr[botMsgIndex] = { ...arr[botMsgIndex], content: "" };
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

  // --- SEND: call FastAPI then persist to Express/Prisma
  const sendMessage = useCallback(async () => {
    const prompt = input;
    if (!prompt.trim() || isGenerating) return;

    // if logged out, allow chatting but show login modal for saving
    if (!user && !conversationId) {
      setShowAuth(true);
    }

    setHasInteracted(true);
    setIsGenerating(true);

    // append user + placeholder bot and capture the bot index safely
    setMessages((prev) => {
      const userIdx = prev.length;
      const botIdx = userIdx + 1;
      botIndexRef.current = botIdx;
      return [
        ...prev,
        { role: USER, content: prompt },
        { role: BOT, content: "", loading: true, complete: false },
      ];
    });
    setInput("");

    try {
      // make sure there's a DB conversation (returns id or null when logged out)
      const convId = await ensureConversation(prompt);

      // choose memory session (conv id if present, else existing sessionId)
      const session = convId || sessionId;

      const controller = new AbortController();
      abortRef.current = controller;

      const { data } = await axios.post(
        "/api/chat",
        { input: prompt, session_id: session },
        { signal: controller.signal }
      );

      if (data?.session_id) setSessionId(data.session_id);

      const botMsgIndex = botIndexRef.current;

      streamBotMessage(data?.output || "", botMsgIndex, async () => {
        setMessages((prev) => {
          const arr = [...prev];
          if (arr[botMsgIndex]) {
            arr[botMsgIndex] = {
              ...arr[botMsgIndex],
              content: data?.output || "",
              loading: false,
              complete: true,
            };
          }
          return arr;
        });

        // persist only when logged in & we have a conversation id
        if (convId) {
          try {
            await axios.post(`/api/app/conversations/${convId}/messages`, {
              items: [
                { role: "user", content: prompt },
                { role: "assistant", content: data?.output || "" },
              ],
            });
            // refresh list ordering
            const { data: list } = await axios.get("/api/app/conversations");
            setConversations(Array.isArray(list.items) ? list.items : []);
          } catch (e) {
            console.error("Persist error:", e?.response?.data || e.message);
          }
        }

        await fetchRecommendations(prompt);
        setIsGenerating(false);
      });
    } catch (err) {
      const botMsgIndex = botIndexRef.current;
      const errorMessage =
        err?.name === "CanceledError"
          ? "Generation stopped."
          : err?.response?.data?.error || "Error: Could not reach backend.";
      setMessages((prev) => {
        const arr = [...prev];
        if (arr[botMsgIndex])
          arr[botMsgIndex] = {
            ...arr[botMsgIndex],
            content: errorMessage,
            loading: false,
            complete: true,
          };
        return arr;
      });
      setIsGenerating(false);
    } finally {
      abortRef.current = null;
    }
  }, [input, isGenerating, sessionId, user, conversationId, ensureConversation]);

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

  const isWelcome = messages.filter((m) => m.role === USER).length === 0;
  
  // New state to manage the sidebar hover effect
  const [sidebarWidth, setSidebarWidth] = useState("w-12");

  // inside AuthedApp.jsx component
  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    setConversationId(null);
    setRecLoading(false);
    setRelated([]);
    setFeedbacks({});
    setHasInteracted(false);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <main className="min-h-svh bg-bgp text-textp flex">
        {/* Sidebar container - Now fixed with hover events */}
        <div
          className={`fixed inset-y-0 left-0 z-20 hidden md:block transition-all duration-300 ${sidebarWidth}`}
          onMouseEnter={() => setSidebarWidth("w-[260px]")}
          onMouseLeave={() => setSidebarWidth("w-12")}
        >
          <Sidebar
            onOpenAuth={() => setShowAuth(true)}
            conversations={conversations}
            onOpenConversation={openConversation}
          />
        </div>

        {/* Right column - dynamically adjust margin to accommodate sidebar width */}
        <div className={`min-w-0 flex-1 min-h-svh flex flex-col transition-all duration-300 ${sidebarWidth === "w-[260px]" ? "md:ml-[260px]" : "md:ml-12"}`}>
          {/* Header - Stays at the top of the main column */}
          <header className="sticky top-0 z-10 bg-bgp h-14 w-full">
            <div
              className={`mx-auto flex h-full w-full items-center justify-between transition-all duration-300 ${
                sidebarWidth === 'w-[260px]' ? 'px-4' : 'px-9'
              }`}
            >
              <div className="flex items-center gap-2 justify-start">
                {/* Burger — mobile only */}
                <button
                  type="button"
                  className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-borderc bg-bgs text-textp"
                  onClick={() => setMobileNavOpen(true)}
                  aria-label="Open menu"
                >
                  <i className="fa-solid fa-bars" />
                </button>
                <span className="text-xl font-bold text-texts">TALINO</span>
              </div>
              <div className="flex items-center gap-2">
                {/* right actions (optional) */}
              </div>
            </div>
          </header>

          {/* The rest of the main content that should not move */}
          <section className="mx-auto w-full max-w-5xl flex-1 min-h-0 px-4 pb-0 flex flex-col">
            <div className="flex w-full flex-1 min-w-0 min-h-0 items-start justify-center px-4">
              <div className={isWelcome ? "w-full max-w-3xl text-center" : "w-full max-w-none"}>
                {isWelcome ? (
                  <>
                    <div className="mb-6">
                      <div className="mx-auto mb-2 inline-grid place-items-center">
                        <div className="h-[80px] w-[80px] rounded-full flex items-center justify-center overflow-hidden">
                          <img src="/logo.png" alt="TALINO AI Logo" className="h-full w-full object-contain" />
                        </div>
                      </div>
                      <div className="text-xl font-bold text-textp">Welcome to TALINO.AI</div>
                      <div className="mt-2 text-[1.05rem] font-medium italic text-accent">
                        Science and Technology Within Everyone's Reach
                      </div>
                    </div>
                    {/* Centered composer on welcome screen */}
                    <div className="mx-auto w-full max-w-3xl transition-all duration-300 ease-in-out">
                      <Composer
                        value={input}
                        onChange={setInput}
                        onSubmit={sendMessage}
                        isLoading={false}
                        isGenerating={isGenerating}
                        onStop={handleStop}
                      />
                    </div>
                    {/* Suggestions under textarea */}
                    {!hasInteracted && (
                      <div className="mt-4">
                        <PromptChips items={suggestionButtons} onPick={pickPrompt} />
                      </div>
                    )}
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
                    onFeedback={(i, v) => setFeedbacks((p) => ({ ...p, [i]: v }))}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Fixed composer at bottom after first interaction */}
          {!isWelcome && (
            <div className={`fixed bottom-0 left-0 right-0 bg-bgp pb-6 px-4 transition-all duration-300 ${sidebarWidth === "w-[260px]" ? "md:left-[260px]" : "md:left-12"}`}>
              <div className="mx-auto w-full max-w-3xl transition-all duration-300 ease-in-out">
                <Composer
                  value={input}
                  onChange={setInput}
                  onSubmit={sendMessage}
                  isLoading={false}
                  isGenerating={isGenerating}
                  onStop={handleStop}
                />
                <p className="mt-2 font-bold text-center text-xs text-texts">
                  TALINO.AI can make mistakes. Check important information.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute left-0 top-0 h-full w-[260px] bg-bgs border-r border-borderc shadow-card">
              <Sidebar
                variant="drawer"                // <-- critical
                onOpenAuth={() => { setShowAuth(true); setMobileNavOpen(false); }}
                conversations={conversations}
                onOpenConversation={(id) => { openConversation(id); setMobileNavOpen(false); }}
              />
            </div>
          </div>
        )}

        {/* Auth modal */}
        {!user && showAuth && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <div className="relative w-full max-w-sm"> {/* <-- Add relative position here */}
              <button
                onClick={() => setShowAuth(false)}
                className="absolute -right-2 rounded-full bg-bgs px-2 py-1 text-sm text-textp border border-borderc"
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