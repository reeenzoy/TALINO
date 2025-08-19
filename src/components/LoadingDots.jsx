export default function LoadingDots() {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <span className="text-sm font-medium">Thinking</span>
      <span className="inline-flex gap-1 leading-none">
        <span className="text-2xl animate-dotFade" style={{ color: '#ffbe18' }}>•</span>
        <span className="text-2xl animate-dotFade [animation-delay:200ms]" style={{ color: '#014687' }}>•</span>
        <span className="text-2xl animate-dotFade [animation-delay:400ms]" style={{ color: '#da231c' }}>•</span>
      </span>
    </div>
  );
}
