import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface TimeUpScreenProps {
  onViewResults: () => void;
}

export function TimeUpScreen({ onViewResults }: TimeUpScreenProps) {
  return (
    <motion.div
      className="test-timeup-container"
      initial={{ opacity: 0, scale: 0.98, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -12 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="test-timeup-kicker">TIME EXPIRED</div>
      <h1 className="test-timeup-title">TIME'S UP</h1>
      <p className="test-timeup-description">
        Your test has been automatically submitted with all recorded answers.
      </p>

      <div className="test-timeup-actions">
        <button
          type="button"
          className="test-editorial-action-btn action-primary"
          onClick={onViewResults}
          autoFocus
        >
          <span>VIEW RESULTS</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}
