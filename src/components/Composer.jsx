import { useRef, useEffect } from 'react';
import { FaStop } from 'react-icons/fa';

export default function Composer({ 
  value, 
  onChange, 
  onSubmit, 
  isLoading, 
  isGenerating, 
  onStop 
}) {
  const ref = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      const scrollHeight = ref.current.scrollHeight;
      ref.current.style.height = Math.min(scrollHeight, 120) + 'px'; // Max 120px height
    }
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!isLoading && value.trim()) onSubmit?.();
      }}
      aria-label="Message composer"
      className="mx-auto w-full max-w-3xl rounded-2xl bg-bgs p-3 shadow-lg border border-white/10 backdrop-blur-sm"
    >
      <textarea
        ref={ref}
        rows={1}
        placeholder="Ask for DOST technologies, programs, or services"
        className="w-full resize-none bg-transparent text-base text-textp outline-none placeholder:text-texts leading-6 min-h-[24px] max-h-[120px]"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && value.trim()) onSubmit?.();
          }
        }}
        disabled={isLoading}
        style={{ overflow: 'hidden' }}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            title="Stop generating"
            aria-label="Stop generating"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-400 hover:bg-red-500/30 transition-colors"
          >
            <FaStop size={12} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            title="Send"
            aria-label="Send"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/20 hover:bg-cyan/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
          >
            <svg viewBox="0 0 512 512" className="h-6 w-6 fill-current text-cyan-400">
              <path d="M476 3L12 222c-27 13-23 53 6 61l111 31 31 111c8 29 48 33 61 6L440 69c13-27-14-54-41-41zM164 284l168-104-120 120 16 80-64-96z"/>
            </svg>
          </button>
        )}
      </div>
    </form>
  );
}