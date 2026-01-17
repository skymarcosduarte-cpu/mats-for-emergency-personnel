// Floating button to reopen the Clave 100 check-in prompt during active drills

import React from 'react';
import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReopenCheckinButtonProps {
  isDrill: boolean;
  onClick: () => void;
}

export const ReopenCheckinButton: React.FC<ReopenCheckinButtonProps> = ({
  isDrill,
  onClick,
}) => {
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed bottom-24 right-4 z-[9999]"
    >
      <Button
        onClick={onClick}
        className={`h-14 w-14 rounded-full shadow-xl border-2 ${
          isDrill
            ? 'bg-amber-500 hover:bg-amber-600 border-amber-300'
            : 'bg-destructive hover:bg-destructive/90 border-red-300'
        }`}
      >
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1.5 }}
        >
          <Bell className="w-6 h-6 text-white" />
        </motion.div>
      </Button>
      <span className="absolute -top-8 right-0 text-xs font-medium bg-background/90 text-foreground px-2 py-1 rounded shadow whitespace-nowrap">
        Reportar estado
      </span>
    </motion.div>
  );
};

export default ReopenCheckinButton;
