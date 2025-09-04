import { RiRobot2Line, RiBook2Line, RiGovernmentLine } from "react-icons/ri";

/**
 * items can be:
 *  - string: "Who is DOST?"
 *  - object: { title, subtitle, value, icon: 'tech'|'project'|'service'|ReactNode }
 */
export default function PromptChips({ items = [], onPick }) {
  if (!items?.length) return null;

  const iconFor = (icon) => {
    if (icon === "tech") return <RiRobot2Line className="text-xl" />;
    if (icon === "project") return <RiBook2Line className="text-xl" />;
    if (icon === "service") return <RiGovernmentLine className="text-xl" />;
    // If they passed a ReactNode, render it; else fallback
    if (icon) return icon;
    return <RiRobot2Line className="text-xl" />;
  };

  const normalized = items.map((it) =>
    typeof it === "string"
      ? { title: it, subtitle: "", value: it, icon: null }
      : it
  );

  return (
    <div
      role="list"
      aria-label="Suggested topics"
      className="mx-auto w-full max-w-5xl px-4"
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {normalized.map((it, idx) => (
          <button
            key={idx}
            type="button"
            role="listitem"
            onClick={() => onPick?.(it.value ?? it.title)}
            className="group flex items-start gap-3 rounded-3xl border border-borderc bg-bgs px-4 py-4 text-left shadow-card
                       transition-colors hover:bg-bgp/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <div className="grid size-15 place-items-center shrink-0 rounded-xl text-textp">
              {iconFor(it.icon)}
            </div>

            <div className="min-w-0">
              <div className="text-[15px] font-semibold text-textp">
                {it.title}
              </div>
              {it.subtitle ? (
                <div className="mt-0.5 text-sm leading-snug text-texts">
                  {it.subtitle}
                </div>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}