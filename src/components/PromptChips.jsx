export default function PromptChips({ items = [], onPick }) {
  if (!items?.length) return null;
  return (
    <div className="mx-auto mt-3 flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-4">
      {items.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onPick?.(t)}
          className="rounded-full border border-borderc bg-bgs px-3 py-1.5 text-sm text-textp shadow-sm hover:bg-bgp/60 active:scale-[.99] focus:outline-none focus:ring-2 focus:ring-accent"
        >
          {t}
        </button>
      ))}
    </div>
  );
}
