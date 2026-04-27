import { motion, AnimatePresence } from 'framer-motion';
import { Dice5 } from 'lucide-react';

const TERRA = '#e8622a';

export function Splash({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center select-none"
          style={{ backgroundColor: TERRA }}
          initial={{ y: 0 }}
          exit={{ y: '-100%' }}
          transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
        >
          <motion.div
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5"
            style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, duration: 0.5 }}
          >
            <Dice5 className="w-10 h-10 text-white" />
          </motion.div>

          <motion.h1
            className="text-4xl font-black text-white tracking-tight leading-none"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.28, duration: 0.36 }}
          >
            TukpaMaster
          </motion.h1>

          <motion.p
            className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.44, duration: 0.3 }}
          >
            Operator Suite
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
