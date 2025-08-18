import { useLayoutEffect } from 'react';

export default function useAutoGrowTextarea(ref, value, maxHeight = 220) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${newHeight}px`;
    if (el.scrollHeight > maxHeight) {
      el.style.overflowY = 'auto';
      el.classList.add('scrollbar-none');
    } else {
      el.style.overflowY = 'hidden';
      el.classList.remove('scrollbar-none');
    }
  }, [ref, value, maxHeight]);
}
