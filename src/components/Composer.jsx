import { useRef } from 'react';
import { FaStop } from 'react-icons/fa';
import useAutoGrowTextarea from '../hooks/AutoGrowTextarea';

export default function Composer({
  value, onChange, onSubmit, isLoading, isGenerating, onStop,
}) {
  const ref = useRef(null);
  useAutoGrowTextarea(ref, value);

  return (
    <div className="mx-auto w-full max-w-3xl rounded-2xl border border-borderc bg-bgs p-3 shadow-sm focus-within:ring-1 focus-within:ring-accent">
      <textarea
        ref={ref}
        rows={1}
        placeholder="Ask for DOST technologies, programs, or services"
        className="w-full resize-none bg-transparent text-base text-textp outline-none placeholder:text-texts"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && value.trim()) onSubmit?.();
          }
        }}
        disabled={isLoading}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-[#8ab4f8] hover:bg-white/20"
          >
            <FaStop size={12} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isLoading || !value.trim()}
            title="Send"
            aria-label="Send"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <svg viewBox="0 0 512 512" className="h-4 w-4 fill-current text-textp">
              <path d="M476 3L12 222c-27 13-23 53 6 61l111 31 31 111c8 29 48 33 61 6L440 69c13-27-14-54-41-41zM164 284l168-104-120 120 16 80-64-96z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
