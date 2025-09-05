import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useReducer,
  createContext,
  useContext,
  startTransition,
} from "react";
import axios from "axios";
import { RiMenuLine } from "react-icons/ri";

import { useAuth } from "./auth/AuthProvider";
import AuthPage from "./pages/AuthPage";
import Composer from "./components/Composer"; 
import MessageList from "./components/MessageList";
import PromptChips from "./components/PromptChips";
import Sidebar from "./components/Sidebar";

// === constants ===
const BOT = "assistant";
const USER = "user";
const ID_RE = /^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const COMPOSER_H = 112;           // px (kept as your original)
const STREAM_CPS = 220;           // characters per second (raise to go faster)
const STREAM_TICK_MS = 50;        // timer granularity (smoothness)

// send cookies to Express/FastAPI through Vite proxy
axios.defaults.withCredentials = true;

// === theme ctx ===
const ThemeContext = createContext({ theme: "system", setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

// === messages reducer (centralizes all mutations) ===
function messagesReducer(state, action) {
  switch (action.type) {
    case "RESET":
      return [];
    case "LOAD": // payload: items[]
      return Array.isArray(action.items) ? action.items : [];
    case "APPEND_USER_AND_BOT": // payload: prompt
      return [
        ...state,
        { role: USER, content: action.prompt },
        { role: BOT, content: "", loading: true, complete: false },
      ];
    case "STREAM_CLEAR": // payload: index
      return state.map((m, i) => (i === action.index ? { ...m, content: "" } : m));
    case "STREAM_APPEND": // payload: index, chunk
      return state.map((m, i) =>
        i === action.index ? { ...m, content: (m.content || "") + action.chunk } : m
      );
    case "STREAM_FINALIZE": // payload: index, full
      return state.map((m, i) =>
        i === action.index ? { ...m, content: action.full, loading: false, complete: true } : m
      );
    case "STREAM_ERROR": // payload: index, error
      return state.map((m, i) =>
        i === action.index ? { ...m, content: action.error, loading: false, complete: true } : m
      );
    case "STOP_LATEST_BOT": {
      const next = [...state];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === BOT && !next[i].complete) {
          next[i] = { ...next[i], loading: false, complete: true };
          break;
        }
      }
      return next;
    }
    default:
      return state;
  }
}

// === utils ===
function normalizeConversation(items = []) {
  // only keep user/assistant + string content
  const clean = items.filter(
    (m) => m && (m.role === USER || m.role === BOT) && typeof m.content === "string"
  );
  // drop leading assistants (historical welcome)
  let s = 0;
  while (s < clean.length && clean[s].role === BOT) s++;
  const trimmed = clean.slice(s);
  // merge consecutive same-role messages
  const out = [];
  for (const m of trimmed) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content = `${last.content}\n\n${m.content}`.trim();
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

export default function AuthedApp() {
  const { user, logout } = useAuth();

  // chat state
  const [input, setInput] = useState("");
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [sessionId, setSessionId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // history state
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);

  // UI helpers
  const [recLoading, setRecLoading] = useState(false);
  const [related, setRelated] = useState([]);
  const [feedbacks, setFeedbacks] = useState({});
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // refs
  const abortRef = useRef(null);
  const streamIntervalRef = useRef(null);
  const botIndexRef = useRef(-1);
  const scrollElRef = useRef(null);
  const composerRef = useRef(null);
  const [composerH, setComposerH] = useState(112);
  const [isScrollable, setIsScrollable] = useState(false);

  // pin-to-bottom state
  const [isPinned, setIsPinned] = useState(true);

  // mobile nav state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    const onChange = (e) =>
      theme === "system" && root.setAttribute("data-theme", e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  // derived flag (place this early, right after messages/dispatch are defined)
  const isWelcome = useMemo(
    () => messages.every(m => m.role !== USER),
    [messages]
  );

  // keep --composer-h in sync on the scroll container
  useEffect(() => {
    const scroll = scrollElRef.current;
    const comp = composerRef.current;
    if (!scroll || !comp) return;

    const ro = new ResizeObserver(([entry]) => {
      const h = entry.target.clientHeight || 112;
      scroll.style.setProperty("--composer-h", `${h}px`);
    });
    ro.observe(comp);
    return () => ro.disconnect();
  }, [isWelcome]); // rerun when the composer mounts

  // keep numeric composerH in sync
  useEffect(() => {
    const comp = composerRef.current;
    if (!comp) return;

    const ro = new ResizeObserver(([entry]) => {
      setComposerH(entry.target.offsetHeight || 112);
    });
    ro.observe(comp);
    return () => ro.disconnect();
  }, [isWelcome]);

  // at mount: listen to the section's scroll
  // useEffect(() => {
  //   const el = scrollElRef.current;
  //   if (!el) return;

  //   const onScroll = () => {
  //     // strict bottom check (8px tolerance)
  //     const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  //     setIsPinned(atBottom);
  //   };

  //   // run once so the initial state is correct
  //   onScroll();
  //   el.addEventListener("scroll", onScroll, { passive: true });
  //   return () => el.removeEventListener("scroll", onScroll);
  // }, []);

  // put this near your other constants
  const BOTTOM_TOLERANCE = 24;

  useEffect(() => {
    const el = scrollElRef.current;
    if (!el) return;

    const update = () => {
      setIsScrollable(el.scrollHeight - el.clientHeight > 4);
      const bottomGap = el.scrollHeight - el.clientHeight - el.scrollTop;
      setIsPinned(bottomGap <= (composerH || 112) + BOTTOM_TOLERANCE);
    };

    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [composerH]);

  // suggestions
  const suggestionButtons = useMemo(
    () => [
      { title: "Technologies", subtitle: "DOST research programs and innovations", value: "Give me some of the DOST technologies", icon: "🤖" },
      { title: "Programs and Projects", subtitle: "Empowering research and industries", value: "What programs and projects can help MSMEs?", icon: "🗃️" },
      { title: "Services", subtitle: "Delivering through science and technology", value: "What testing services does DOST offer?", icon: "🏛️" },
    ],
    []
  );

  const pickPrompt = (t) => {
    setInput(t);
    setTimeout(() => sendMessage(), 10);
  };

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

  // simple SPA location helpers
  const navigateToConversation = useCallback((id, { replace = false } = {}) => {
    const url = new URL(window.location.href);
    url.pathname = `/${id}`;
    if (replace) window.history.replaceState({}, "", url);
    else window.history.pushState({}, "", url);
  }, []);
  const navigateToRoot = useCallback(() => {
    const url = new URL(window.location.href);
    url.pathname = "/";
    window.history.pushState({}, "", url);
  }, []);

  // Load history after login
  useEffect(() => {
    if (!user) {
      setConversations([]);
      setConversationId(null);
      dispatch({ type: "RESET" });
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

  // abort in-flight requests on page close (clean dev consoles)
  useEffect(() => {
    const handler = () => abortRef.current?.abort();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ensure a conversation exists (create on first send)
  const ensureConversation = useCallback(
    async (titleSeed) => {
      if (conversationId) return conversationId;
      if (!user) return null;
      const { data } = await axios.post("/api/app/conversations", {
        title: String(titleSeed || "New chat").slice(0, 120),
      });
      setConversationId(data.id);
      // refresh list
      try {
        const { data: list } = await axios.get("/api/app/conversations");
        setConversations(Array.isArray(list.items) ? list.items : []);
      } catch {}
      setSessionId(data.id); // align memory
      return data.id;
    },
    [conversationId, user]
  );

  // scroll pin tracking using the ref (no getElementById)
  // useEffect(() => {
  //   const el = scrollElRef.current;
  //   if (!el) return;
  //   const onScroll = () => {
  //     const threshold = 64; // px from bottom counts as “pinned”
  //     const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  //     setIsPinned(atBottom);
  //   };
  //   el.addEventListener("scroll", onScroll, { passive: true });
  //   return () => el.removeEventListener("scroll", onScroll);
  // }, []);

  const scrollToBottom = useCallback(() => {
    const el = scrollElRef.current;
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);
  // your auto-scroll effect
  useEffect(() => {
    const el = scrollElRef.current;
    if (el) setIsScrollable(el.scrollHeight - el.clientHeight > 4);
  }, [messages.length, isGenerating, composerH]);

  // open a conversation from the sidebar (and cancel any current stream)
  const openConversation = useCallback(
    async (id) => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (streamIntervalRef.current) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
      }
      setIsGenerating(false);
      navigateToConversation(id);
      setConversationId(id);
      setSessionId(id);
      try {
        const { data } = await axios.get(`/api/app/conversations/${id}/messages`);
        const items = Array.isArray(data.items) ? data.items : [];
        dispatch({ type: "LOAD", items: normalizeConversation(items) });
      } catch {
        dispatch({ type: "RESET" });
      }
    },
    [navigateToConversation]
  );

  // deep-link on first mount
  useEffect(() => {
    if (!user) return;
    const m = window.location.pathname.match(ID_RE);
    const id = m?.[1];
    if (id && id !== conversationId) openConversation(id);
  }, [user, conversationId, openConversation]);

  // back/forward
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(ID_RE);
      const id = m?.[1];
      if (id) {
        if (id !== conversationId) openConversation(id);
      } else if (conversationId) {
        setConversationId(null);
        dispatch({ type: "RESET" });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [conversationId, openConversation]);

  // streaming (time-based; catches up after background tab)
  const streamBotMessage = (fullMsg, botMsgIndex, onDone) => {
    dispatch({ type: "STREAM_CLEAR", index: botMsgIndex });

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    let i = 0;
    let last = performance.now();
    let carry = 0;

    streamIntervalRef.current = setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;

      carry += (STREAM_CPS * dt) / 1000;
      const step = Math.max(1, Math.floor(carry));
      if (step > 0) carry -= step;

      const next = fullMsg.slice(i, Math.min(i + step, fullMsg.length));
      i += step;

      startTransition(() => {
        dispatch({ type: "STREAM_APPEND", index: botMsgIndex, chunk: next });
      });

      if (i >= fullMsg.length) {
        clearInterval(streamIntervalRef.current);
        streamIntervalRef.current = null;
        onDone?.();
      }
    }, STREAM_TICK_MS);
  };

  // send
  const sendMessage = useCallback(
    async (explicit) => {
      const prompt = explicit ?? input;
      if (!prompt.trim() || isGenerating) return;

      if (!user && !conversationId) setShowAuth(true);

      setHasInteracted(true);
      setIsGenerating(true);

      // append user + placeholder assistant
      const botIdx = messages.length + 1;
      botIndexRef.current = botIdx;
      dispatch({ type: "APPEND_USER_AND_BOT", prompt });
      setInput("");

      try {
        const convId = await ensureConversation(prompt);
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
          dispatch({
            type: "STREAM_FINALIZE",
            index: botMsgIndex,
            full: data?.output || "",
          });

          if (convId) {
            try {
              await axios.post(`/api/app/conversations/${convId}/messages`, {
                items: [
                  { role: USER, content: prompt },
                  { role: BOT, content: data?.output || "" },
                ],
              });
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
        dispatch({ type: "STREAM_ERROR", index: botMsgIndex, error: errorMessage });
        setIsGenerating(false);
      } finally {
        abortRef.current = null;
      }
    },
    [input, isGenerating, sessionId, user, conversationId, ensureConversation, messages.length]
  );

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    dispatch({ type: "STOP_LATEST_BOT" });
    setIsGenerating(false);
  };

  // collapsible rail width (hover)
  const [sidebarWidth, setSidebarWidth] = useState("w-12");

  // reset chat (and go to /)
  const resetChat = useCallback(() => {
    dispatch({ type: "RESET" });
    setSessionId(null);
    setConversationId(null);
    setRecLoading(false);
    setRelated([]);
    setFeedbacks({});
    setHasInteracted(false);
    navigateToRoot();
  }, [navigateToRoot]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <main className="min-h-svh bg-bgp text-textp flex">
        {/* Sidebar (desktop rail) */}
        <div
          className={`fixed inset-y-0 left-0 z-10 hidden md:block transition-all duration-300 ${sidebarWidth}`}
          onMouseEnter={() => setSidebarWidth("w-[260px]")}
          onMouseLeave={() => setSidebarWidth("w-12")}
          aria-label="Primary navigation"
        >
          <Sidebar
            onOpenAuth={() => setShowAuth(true)}
            conversations={conversations}
            onOpenConversation={openConversation}
            onNewChat={resetChat}
          />
        </div>

        {/* Right column */}
        <div
          className={`min-w-0 flex-1 min-h-svh flex flex-col transition-all duration-300 ${
            sidebarWidth === "w-[260px]" ? "md:ml-[260px]" : "md:ml-12"
          }`}
        >
          {/* Header */}
          <header className="sticky top-0 bg-bgp h-14 w-full">
            <div
              className={`mx-auto flex h-full w-full items-center justify-between transition-all duration-300 ${
                sidebarWidth === "w-[260px]" ? "px-4" : "px-9"
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
                  <RiMenuLine className="text-xl" aria-hidden="true" />
                </button>
                <span className="text-xl font-bold text-texts">TALINO AI</span>
              </div>
              <div className="flex items-center gap-2">{/* right actions */}</div>
            </div>
          </header>

          {/* Scroll area */}
          <section
            id="message-scroll"
            ref={scrollElRef}
            className="relative mx-auto w-full max-w-5xl flex-1 min-h-0 mt-0 md:mt-20 px-4 overflow-y-auto scroll-smooth flex flex-col pb-[calc(var(--composer-h)+20px)]"
            style={{ ["--composer-h"]: `${composerH}px` }}
          >
            <div className="flex w-full flex-1 min-w-0 min-h-0 items-start justify-center px-4">
              <div className={isWelcome ? "w-full max-w-3xl text-center" : "w-full max-w-none"}>
                {isWelcome ? (
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
                        Science and Technology Within Everyone&apos;s Reach
                      </div>
                    </div>
                    <div className="mx-auto w-full max-w-3xl transition-all duration-300 ease-in-out">
                      <Composer
                        value={input}
                        onChange={setInput}
                        onSubmit={sendMessage}
                        isLoading={false}
                        isGenerating={isGenerating}
                        onStop={handleStop}
                        autoFocus
                      />
                    </div>
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

            {isScrollable && !isWelcome && (
              <button
                onClick={() =>
                  scrollElRef.current?.scrollTo({
                    top: scrollElRef.current.scrollHeight,
                    behavior: "smooth",
                  })
                }
                className={[
                  "absolute right-4 md:right-6 z-[200]",
                  "grid h-9 w-9 place-items-center rounded-full",
                  "border border-borderc bg-bgs/95 backdrop-blur text-textp shadow",
                  "hover:bg-bgp hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40",
                  isPinned ? "opacity-60" : "opacity-100",
                ].join(" ")}
                style={{ bottom: (composerH || 112) + 16 }}  // always just above the composer
                aria-label="Jump to latest"
                title="Jump to latest"
              >
                <span className="text-lg leading-none">↓</span>
              </button>
            )}

            {/* Reserve space for the fixed composer */}
            <div aria-hidden className="h-[var(--composer-h)]" />
          </section>

          {/* Jump-to-latest */}
          {/* {isScrollable && !isWelcome && (
            <button
              onClick={() =>
                scrollElRef.current?.scrollTo({
                  top: scrollElRef.current.scrollHeight,
                  behavior: "smooth",
                })
              }
              className={[
                "fixed grid h-9 w-9 place-items-center rounded-full",
                "border border-borderc bg-bgs text-textp shadow transition-opacity",
                "hover:bg-bgp hover:shadow-md focus:outline-none focus:ring-2 focus:ring-accent/40",
                isPinned ? "opacity-60" : "opacity-100",
                "z-[200] right-4 pointer-events-auto",
              ].join(" ")}
              style={{ bottom: composerH + 16 }}   // <- numeric px value
              aria-label="Jump to latest"
              title="Jump to latest"
            >
              ↓
            </button>
          )} */}

          {/* Fixed composer (overlays the sidebar, solid bg) */}
          {!isWelcome && (
            <div
              ref={composerRef}
              className={`fixed bottom-0 left-0 right-0 bg-bgp px-4 transition-all duration-300 ${
                sidebarWidth === "w-[260px]" ? "md:left-[260px]" : "md:left-12"
              }`}
            >
              <div className="mx-auto w-full max-w-3xl transition-all duration-300 ease-in-out">
                <Composer
                  key={conversationId || "new"}
                  value={input}
                  onChange={setInput}
                  onSubmit={sendMessage}
                  isLoading={false}
                  isGenerating={isGenerating}
                  onStop={handleStop}
                  autoFocus
                />
                <p className="mt-2 pb-4 font-bold text-center text-xs text-texts">
                  TALINO.AI can make mistakes. Check important information.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileNavOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-0 h-full w-[260px] bg-bgs border-r border-borderc shadow-card">
              <Sidebar
                variant="drawer"
                onOpenAuth={() => {
                  setShowAuth(true);
                  setMobileNavOpen(false);
                }}
                conversations={conversations}
                onOpenConversation={(id) => {
                  openConversation(id);
                  setMobileNavOpen(false);
                }}
                onNewChat={() => {
                  resetChat();
                  setMobileNavOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Auth modal */}
        {!user && showAuth && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
            <div className="relative w-full max-w-sm">
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
