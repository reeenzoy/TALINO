// Sidebar.jsx
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
} from "react-icons/ri";

/** Narrow rail that expands on hover (desktop). */
export default function Sidebar() {
  return (
    <aside
      className={[
        "group/aside sticky top-0 z-20 h-svh border-r border-borderc bg-bgs",
        "w-[72px] hover:w-[280px]",
        "transition-[width] duration-300 ease-out",
        "overflow-hidden",
      ].join(" ")}
      aria-label="Primary"
    >
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 px-3">
        <div className="grid size-8 place-items-center rounded-md bg-bgp font-bold">✶</div>
        <span className="text-sm font-semibold text-textp opacity-0 translate-x-2 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:translate-x-0">
          TALINO.AI
        </span>
      </div>

      {/* Main nav */}
      <nav className="px-2">
        <RailItem icon={<RiAddLine />} label="New" />
        <RailItem icon={<RiHome2Line />} label="Home" active />
        {/* <RailItem icon={<RiCompass3Line />} label="Discover" />
        <RailItem icon={<RiLayoutGridLine />} label="Spaces" /> */}
      </nav>

      {/* Expanded “Home” panel (visible when open) */}
      <div className="mt-2 px-2 opacity-0 pointer-events-none translate-x-2 transition-all duration-300 group-hover/aside:opacity-100 group-hover/aside:pointer-events-auto group-hover/aside:translate-x-0">
        <Section title="Library" icon={<RiBook2Line />} add>
          <PlainLink text="Who is TALINO.AI?" />
          <PlainLink text="What is the history of Dos..." />
        </Section>
      </div>

      {/* Bottom actions */}
      <div className="absolute inset-x-0 bottom-0 px-2 pb-3">
        <RailItem icon={<RiUser3Line />} label="Account" avatar />
        <RailItem icon={<RiDownloadLine />} label="Install" />
      </div>
    </aside>
  );
}

/* ===== building blocks ===== */

function RailItem({ icon, label, active = false, avatar = false }) {
  return (
    <button
      type="button"
      className={[
        "group/item flex w-full items-center gap-3 rounded-xl px-3 py-2",
        active ? "bg-bgp/60" : "hover:bg-bgp/40",
        "transition-colors",
      ].join(" ")}
    >
      <div
        className={[
          "grid size-10 place-items-center rounded-xl border border-borderc",
          avatar ? "bg-[--avatar-bg]" : "bg-bgs",
        ].join(" ")}
        style={avatar ? { ["--avatar-bg"]: "#4A3F39" } : undefined}
      >
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
