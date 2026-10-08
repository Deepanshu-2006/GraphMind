import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bookmark, Check } from 'lucide-react';
import type { TestQuestion } from '../../types/test';

interface QuestionNavigatorProps {
  isOpen: boolean;
  onClose: () => void;
  questions: TestQuestion[];
  currentIndex: number;
  answers: Record<string, string>;
  flaggedIds: Set<string>;
  onSelectIndex: (index: number) => void;
}

export function QuestionNavigator({
  isOpen,
  onClose,
  questions,
  currentIndex,
  answers,
  flaggedIds,
  onSelectIndex
}: QuestionNavigatorProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          className="question-navigator-popover"
          initial={{ opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label="Question Navigator"
        >
          <div className="navigator-header">
            <span className="navigator-title">QUESTION INDEX</span>
            <span className="navigator-count">{Object.keys(answers).length} / {questions.length} ANSWERED</span>
          </div>

          <div className="navigator-grid" role="list">
            {questions.map((q, idx) => {
              const numStr = (idx + 1).toString().padStart(2, '0');
              const isAnswered = Boolean(answers[q.id]);
              const isFlagged = flaggedIds.has(q.id);
              const isCurrent = idx === currentIndex;

              return (
                <button
                  key={q.id}
                  type="button"
                  className={`navigator-item ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : 'unanswered'} ${isFlagged ? 'flagged' : ''}`}
                  onClick={() => {
                    onSelectIndex(idx);
                    onClose();
                  }}
                  role="listitem"
                  title={`Question ${numStr}${isAnswered ? ' (Answered)' : ''}${isFlagged ? ' (Flagged)' : ''}`}
                >
                  <span className="navigator-item-num">{numStr}</span>
                  <span className="navigator-item-status">
                    {isFlagged ? (
                      <Bookmark size={11} className="nav-icon-flag" />
                    ) : isAnswered ? (
                      <Check size={11} className="nav-icon-check" />
                    ) : (
                      <span className="nav-icon-empty">—</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
