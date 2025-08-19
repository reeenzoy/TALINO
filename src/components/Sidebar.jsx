import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

import {
  RiHome2Line,
  RiCompass3Line,
  RiLayoutGridLine,
  RiAddLine,
  RiUser3Line,
  RiBook2Line,
  RiBankLine,
  RiNavigationLine,
  RiGraduationCapLine,
  RiExternalLinkLine,
  RiDownloadLine,
  RiSettings3Line,
  RiLogoutBoxRLine,
  RiSunLine,
  RiMoonLine,
  RiContrast2Line,
} from "react-icons/ri";

/** Narrow rail that expands on hover (desktop). */
export default function Sidebar() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const menuRef = useRef(null);

  // close menus on outside click
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
    // mirror your app's theme logic (no circular imports)
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

  const userLabel = user?.email || "Account";

  return (
    <aside
      className={[
        "group/aside sticky top-0 z-20 h-svh border-r border-borderc bg-bgs",
        "w-[72px] hover:w-[260px]",
        "transition-[width] duration-300 ease-out",
        "overflow-hidden",
      ].join(" ")}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-3">
        <div className="h-[55px] w-[55px] grid size-8 place-items-center rounded-md font-bold">
          <img 
            src="/bot_logo.png" 
            alt="TALINO AI Logo" 
            className="h-full w-full object-contain"
          />
        </div>
      </div>

      {/* Main nav */}
      <nav className="font-bold px-3">
        <RailItem icon={<RiAddLine />} label="New" />
        <RailItem icon={<RiHome2Line />} label="Home" active />
        {/* <RailItem icon={<RiCompass3Line />} label="Discover" />
        <RailItem icon={<RiLayoutGridLine />} label="Spaces" /> */}
      </nav>

      {/* Expanded “Home” panel (visible when open) */}
      <div className="mt-2 px-2 opacity-0 pointer-events-none translate-x-2 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:pointer-events-auto group-hover/aside:translate-x-0">
        {/* <Section title="Home" icon={<RiBook2Line />}>
          <ListLink icon={<RiBankLine />} text="Finance" />
          <ListLink icon={<RiNavigationLine />} text="Travel" />
          <ListLink icon={<RiGraduationCapLine />} text="Academic" />
        </Section> */}

        <Section title="History" icon={<RiBook2Line />} add>
          <PlainLink text="Who is DOST?" />
          <PlainLink text="what are the technologies of DOST?" />
          <PlainLink text="Services of DOST" />
        </Section>
      </div>

      {/* Bottom actions */}
      <div className="absolute inset-x-0 bottom-0 px-2 pb-3" ref={menuRef}>
        {/* User button -> shows email if logged in, opens menu */}
        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setThemeOpen(false);
          }}
          className="group/item relative flex w-full items-center gap-3 rounded-xl px-3 py-2 hover:bg-bgp/40 transition-colors"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <div className="grid size-10 place-items-center rounded-xl border border-borderc bg-bgs">
            <span className="text-xl opacity-90"><RiUser3Line /></span>
          </div>
          <span
            className="max-w-[160px] truncate text-sm text-textp opacity-0 translate-x-1 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:translate-x-0"
            title={userLabel}
          >
            {userLabel}
          </span>
        </button>

        {/* User menu */}
        {menuOpen && (
          <div
            role="menu"
            className="relative ml-[64px] mr-1 mt-2 rounded-xl border border-borderc bg-bgs p-1 shadow-card group-hover/aside:ml-0"
          >
            <MenuItem
              icon={<RiSettings3Line />}
              label="Settings"
              onClick={() => {
                // hook up to your settings panel if you have one
                // you can toggle a settings modal here
                setMenuOpen(false);
              }}
            />
            <MenuItem
              icon={<RiSunLine />}
              label="Theme"
              rightIcon={
                <span className="text-texts">
                  {/* chevron mimic using ">" */}
                  &gt;
                </span>
              }
              onClick={() => setThemeOpen((v) => !v)}
              ariaHasPopup
            />
            {themeOpen && (
              <div
                className="mt-1 rounded-lg border border-borderc bg-bgp p-1"
                role="menu"
                aria-label="Theme options"
              >
                <MenuItem icon={<RiContrast2Line />} label="System" onClick={() => applyTheme("system")} />
                <MenuItem icon={<RiSunLine />} label="Light" onClick={() => applyTheme("light")} />
                <MenuItem icon={<RiMoonLine />} label="Dark" onClick={() => applyTheme("dark")} />
              </div>
            )}
            {user && (
              <>
                <div className="my-1 h-px bg-borderc/60" />
                <MenuItem
                  icon={<RiLogoutBoxRLine />}
                  label="Logout"
                  onClick={async () => {
                    setMenuOpen(false);
                    setThemeOpen(false);
                    try {
                      await logout();
                    } catch (_) {}
                  }}
                />
              </>
            )}
          </div>
        )}

        {/* Other bottom items */}
        {/* <RailItem icon={<RiExternalLinkLine />} label="Upgrade" />
        <RailItem icon={<RiDownloadLine />} label="Install" /> */}
      </div>
    </aside>
  );
}

/* ===== building blocks ===== */

function RailItem({ icon, label, active = false }) {
  return (
    <button
      type="button"
      className={[
        "group/item flex w-full items-center gap-3 rounded-xl px-3 py-2",
        active ? "bg-bgp/60" : "hover:bg-bgp/40",
        "transition-colors",
      ].join(" ")}
    >
      <div className="grid size-10 place-items-center rounded-xl border border-borderc bg-bgs">
        <span className="text-xl opacity-90">{icon}</span>
      </div>
      <span className="text-sm text-textp opacity-0 translate-x-1 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:translate-x-0">
        {label}
      </span>
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
        {add && (
          <button className="text-xs text-texts hover:text-textp" title="Add">
            ＋
          </button>
        )}
      </div>
      <div className="px-3 pb-2">{children}</div>
    </div>
  );
}

function ListLink({ icon, text }) {
  return (
    <a href="#" className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-bgp/40">
      <span className="text-base text-texts">{icon}</span>
      <span className="text-textp">{text}</span>
    </a>
  );
}

function PlainLink({ text }) {
  return (
    <a
      href="#"
      className="block truncate rounded-lg px-2 py-1.5 text-sm text-textp hover:bg-bgp/40"
      title={text}
    >
      {text}
    </a>
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
