import ReactMarkdown from 'react-markdown';
import LoadingDots from './LoadingDots';

export default function MessageList({
  items = [], recLoading, related = [], onPickRelated, feedbacks, onFeedback,
}) {
  return (
    <div className="mx-auto mt-6 flex h-[calc(100vh-220px)] max-w-3xl flex-col gap-4 overflow-y-auto px-0 pb-28 scrollbar-none">
      {items.map((msg, idx) => (
        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[95%] rounded-2xl px-4 py-3 text-base leading-7 ${
              msg.role === 'user'
                ? 'bg-userBubble text-white'
                : 'bg-transparent text-[var(--chat-bubble-bot-text)]'
            }`}
          >
            {msg.role === 'bot' && msg.loading ? (
              <div className="inline-flex items-center gap-2">
                <LoadingDots />
              </div>
            ) : (
              <ReactMarkdown
                components={{
                  h1: (p) => <h1 className="mb-2 mt-4 text-xl font-bold text-textp" {...p} />,
                  h2: (p) => <h2 className="mb-2 mt-3 text-lg font-semibold text-textp" {...p} />,
                  ul: (p) => <ul className="ml-6 list-disc text-textp" {...p} />,
                  ol: (p) => <ol className="ml-6 list-decimal text-textp" {...p} />,
                  li: (p) => <li className="mb-1 text-textp" {...p} />,
                  strong: (p) => <strong className="font-bold text-textp" {...p} />,
                  em: (p) => <em className="italic text-textp" {...p} />,
                }}
              >
                {msg.content}
              </ReactMarkdown>
            )}

            {/* Feedback + Related topics (only for last complete bot msg) */}
            {msg.role === 'bot' && msg.complete && (
              <>
                <div className="relative mt-2 flex flex-col rounded-lg border border-borderc bg-bgs p-3">
                  <div className="absolute right-2 top-2 flex gap-3">
                    <button
                      aria-label="Thumbs up"
                      onClick={() => onFeedback?.(idx, 'up')}
                      className={`text-xl transition-colors ${
                        feedbacks[idx] === 'up' ? 'text-accent' : 'text-texts'
                      }`}
                    >
                      👍
                    </button>
                    <button
                      aria-label="Thumbs down"
                      onClick={() => onFeedback?.(idx, 'down')}
                      className={`text-xl transition-colors ${
                        feedbacks[idx] === 'down' ? 'text-error' : 'text-texts'
                      }`}
                    >
                      👎
                    </button>
                  </div>
                  <span className="pr-12 text-[15px] text-textp">Was your query addressed effectively?</span>
                  {feedbacks[idx] && (
                    <span className="mt-1 text-sm text-texts">
                      {feedbacks[idx] === 'up' ? 'Thank you for your feedback!' : 'We appreciate your feedback!'}
                    </span>
                  )}
                </div>

                {/* Related topics */}
                {idx === items.length - 1 && (
                  <div className="recq mt-4 overflow-hidden rounded-xl bg-bgs">
                    <div className="recq-header flex items-center px-5 pb-2 pt-4 text-[0.95rem] font-semibold text-textp">
                      <span className="mr-2 text-base">📝</span>
                      <span className="recq-title">Related topics:</span>
                    </div>
                    <div>
                      {recLoading ? (
                        <div className="px-5 py-4 text-center italic text-texts">Loading...</div>
                      ) : (
                        related.map((q, i) => (
                          <button
                            key={i}
                            className="recq-row flex w-full items-center justify-between border-t border-[#333] px-5 py-3 text-left text-[1.06em] text-textp transition-colors hover:bg-[#181818] focus:outline-none"
                            onClick={() => onPickRelated?.(q)}
                          >
                            <span className="recq-question max-w-[90%] text-[0.9em]">{q}</span>
                            <span className="recq-plus text-[1.1rem] font-bold text-[#21b0ff]">+</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
