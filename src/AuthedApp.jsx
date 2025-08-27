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
  const [sessionId, setSessionId] = useState(null);      // FastAPI memory key
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

  const { user, logout } = useAuth();

  // theme
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

  // --- HISTORY: ensure a conversation exists (create on first send)
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

  // --- HISTORY: open a conversation from the sidebar
  const openConversation = useCallback(async (id) => {
    setConversationId(id);
    setSessionId(id); // align memory
    try {
      const { data } = await axios.get(`/api/app/conversations/${id}/messages`);
      const items = Array.isArray(data.items) ? data.items : [];
      setMessages(items.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })));
    } catch {
      setMessages([]);
    }
  }, []);

  // fake streaming
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

    // append user + placeholder bot
    setMessages((prev) => [
      ...prev,
      { role: USER, content: prompt },
      { role: BOT, content: "", loading: true, complete: false },
    ]);
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

      const botMsgIndex = messages.length + 1;

      streamBotMessage(data?.output || "", botMsgIndex, async () => {
        setMessages((prev) => {
          const arr = [...prev];
          if (arr[botMsgIndex]) {
            arr[botMsgIndex] = { ...arr[botMsgIndex], content: data?.output || "", complete: true };
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
  }, [input, isGenerating, messages.length, sessionId, user, conversationId, ensureConversation]);

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

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <main className="min-h-svh bg-bgp text-textp">
        <div className="flex">
          <Sidebar
            onOpenAuth={() => setShowAuth(true)}
            conversations={conversations}
            onOpenConversation={openConversation}
          />

          <div className="min-w-0 flex-1 flex flex-col">
            <header className="sticky top-0 z-10 bg-bgp/60 backdrop-blur">
              <div className="mx-auto flex h-14 w-full items-center justify-between px-4">
                <div className="flex items-center gap-2 justify-start">
                  <span className="text-xl font-semibold text-texts">TALINO</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* {user ? (
                    <button
                      onClick={logout}
                      className="rounded-md border border-borderc bg-bgs px-2 py-1 text-sm text-textp hover:bg-bgs/60"
                      title="Logout"
                    >
                      Logout
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowAuth(true)}
                      className="rounded-md border border-borderc bg-bgs px-2 py-1 text-sm text-textp hover:bg-bgs/60"
                      title="Login or Register"
                    >
                      Login / Register
                    </button>
                  )} */}
                </div>
              </div>
            </header>

            <section className="mx-auto grid w-full max-w-5xl flex-1 grid-rows-[1fr_auto] gap-4 px-4 pb-6">
              <div className="flex justify-center w-full flex-1 px-4 items-start">
                <div className={isWelcome ? "w-full max-w-3xl text-center" : "w-full max-w-none justify-end"}>
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
                <div className="mx-auto w-full composer-3xl">
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

              {isWelcome && (
                <footer>
                  <div className="mx-auto w-full max-w-5xl px-4">
                    <div className="flex flex-col items-center">
                      <p className="text-sm text-texts">In partnership with</p>
                      <div className="mt-2 flex gap-8">
                        <div className="h-[60px] w-[60px]">
                          <img src="/asti.png" alt="ASTI Logo" className="h-full w-full object-contain" />
                        </div>
                        <div className="h-[70px] w-[70px]">
                          <img src="/csu.png" alt="CSU Logo" className="h-full w-full object-contain" />
                        </div>
                      </div>
                    </div>
                  </div>
                </footer>
              )}
            </section>
          </div>
        </div>

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