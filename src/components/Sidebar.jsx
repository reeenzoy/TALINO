import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  RiHome2Line, RiAddLine, RiUser3Line, RiBook2Line,
  RiLogoutBoxRLine, RiSunLine, RiMoonLine, RiContrast2Line,
} from "react-icons/ri";

/** Narrow rail (desktop) that can also render as a full drawer (mobile). */
export default function Sidebar({
  onOpenAuth,
  conversations = [],
  onOpenConversation,
  variant = "rail",
}) {
  const drawer = variant === "drawer";
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const menuRef = useRef(null);
  const menuPanelRef = useRef(null);
  const menuCloseTimer = useRef(null);

  const keepMenu = () => { clearTimeout(menuCloseTimer.current); setMenuOpen(true); };
  const closeMenuSoon = () => {
    clearTimeout(menuCloseTimer.current);
    menuCloseTimer.current = setTimeout(() => setMenuOpen(false), 260);
  };

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setThemeOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const applyTheme = (mode) => {
    const root = document.documentElement;
    if (mode === "system") {
      const prefersDark = matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", prefersDark ? "dark" : "light");
    } else {
      root.setAttribute("data-theme", mode);
    }
    localStorage.setItem("theme", mode);
    setThemeOpen(false);
  };

  return (
    <aside
      aria-label="Primary"
      className={[
        drawer
            ? "flex h-full w-[260px] flex-col overflow-y-auto border-r border-borderc bg-bgs"
          : // Rail: sticky and hover-expand
            "group/aside sticky top-0 z-20 h-svh border-r border-borderc bg-bgs flex flex-col overflow-hidden " +
            (menuOpen ? "w-[260px]" : "w-[72px] hover:w-[260px]") +
            " transition-[width] duration-300 ease-out",
      ].join(" ")}
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-3">
        <div className="h-[55px] w-[55px] grid size-8 place-items-center rounded-md font-bold">
          <img src="/bot_logo.png" alt="TALINO AI Logo" className="h-full w-full object-contain" />
        </div>
      </div>

      {/* Main nav */}
      <nav className="px-2 font-bold"> {/* <-- Changed from px-3 to px-2 */}
        <RailItem icon={<RiAddLine />} label="New" expanded={drawer} />
        <RailItem icon={<RiHome2Line />} label="Home" active expanded={drawer} />
      </nav>

      {/* Expanded panels */}
      <div className={drawer ? "mt-2 px-2" :
        "mt-2 px-2 opacity-0 pointer-events-none translate-x-2 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:pointer-events-auto group-hover/aside:translate-x-0"}>
        <Section title="History" icon={<RiBook2Line />}>
          {Array.isArray(conversations) && conversations.length > 0 ? (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenConversation?.(c.id)}
                className="block w-full truncate text-left rounded-lg px-2 py-1.5 text-sm text-textp hover:bg-bgp/40"
                title={c.title}
              >
                {c.title}
              </button>
            ))
          ) : (
            <span className="block px-2 py-1.5 text-sm text-texts/70">No conversations</span>
          )}
        </Section>
      </div>

      {/* Bottom actions */}
      <div ref={menuRef} className="mt-auto px-2 pb-3">
        <div className="border-t border-borderc pt-3">
          <div className="relative px-1">
            <div className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
              <button
                type="button"
                onClick={() => { setMenuOpen((v) => !v); setThemeOpen(false); }}
                className="grid size-10 place-items-center rounded-xl border border-borderc bg-bgs"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                title={user ? "Account" : "Login / Register"}
              >
                <span className="text-xl opacity-90"><RiUser3Line /></span>
              </button>

              <span
                title={user?.email || "Guest"}
                className={[
                  "max-w-[160px] truncate text-sm text-textp",
                  drawer ? "" : "opacity-0 translate-x-1 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:translate-x-0",
                ].join(" ")}
              >
                {user ? user.email : "Guest"}
              </span>

              <span
                className={[
                  "h-2.5 w-2.5 rounded-full",
                  user ? "bg-emerald-500" : "bg-zinc-400",
                  drawer ? "" : "opacity-0 transition-opacity duration-200 group-hover/aside:opacity-100",
                ].join(" ")}
              />
            </div>

            {menuOpen && (
              <div
                role="menu"
                ref={menuPanelRef}
                className="absolute left-0 right-0 z-40 rounded-xl border border-borderc bg-bgs shadow-card"
                style={{ bottom: "calc(100% + 8px)" }}
                onMouseEnter={keepMenu}
                onMouseLeave={closeMenuSoon}
              >
                <div className="max-h-[60vh] overflow-auto p-1">
                  <MenuItem icon={<RiContrast2Line />} label="System" onClick={() => applyTheme("system")} />
                  <MenuItem icon={<RiSunLine />} label="Light" onClick={() => applyTheme("light")} />
                  <MenuItem icon={<RiMoonLine />} label="Dark" onClick={() => applyTheme("dark")} />
                  <div className="my-1 h-px bg-borderc/60" />
                  {user ? (
                    <MenuItem
                      icon={<RiLogoutBoxRLine />}
                      label="Logout"
                      onClick={async () => { setMenuOpen(false); setThemeOpen(false); try { await logout(); } catch {} }}
                    />
                  ) : (
                    <MenuItem
                      icon={<RiUser3Line />}
                      label="Login / Register"
                      onClick={() => { setMenuOpen(false); setThemeOpen(false); onOpenAuth?.(); }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ===== building blocks ===== */
function RailItem({ icon, label, active = false, expanded = false }) {
 const labelCls = expanded
  ? "opacity-100 translate-x-0"
  : "opacity-0 translate-x-1 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:translate-x-0";

 return (
  <button
   type="button"
   className={[
    "group/item flex w-full items-center gap-3 rounded-xl px-3 py-2", // <-- Changed from px-3 to px-2
    active ? "bg-bgp/60" : "hover:bg-bgp/40",
    "transition-colors",
   ].join(" ")}
  >
   <div className="grid size-10 place-items-center rounded-xl border border-borderc bg-bgs">
    <span className="p- text-2xl opacity-90">{icon}</span>
   </div>
   <span className={`text-sm text-textp ${labelCls}`}>{label}</span>
  </button>
 );
}

function Section({ title, icon, add = false, children }) {
  return (
    <div className="mb-3 rounded-xl border border-borderc bg-bgs">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-texts">{icon}</span>
          <span className="text-sm font-medium text-textp">{title}</span>
        </div>
        {add && <button className="text-xs text-texts hover:text-textp" title="Add">＋</button>}
      </div>
      <div className="px-3 pb-2">{children}</div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, rightIcon, ariaHasPopup = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      aria-haspopup={ariaHasPopup || undefined}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-bgp/40"
    >
      <span className="flex items-center gap-2">
        <span className="text-base text-texts">{icon}</span>
        <span className="text-textp">{label}</span>
      </span>
      {rightIcon}
    </button>
  );
}