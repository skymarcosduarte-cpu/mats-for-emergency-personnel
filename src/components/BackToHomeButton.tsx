import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface BackToHomeButtonProps {
  onClick: () => void;
}

export const BackToHomeButton: React.FC<BackToHomeButtonProps> = ({ onClick }) => {
  return (
    <motion.button
      onClick={onClick}
      className="h-11 w-11 shrink-0 rounded-full bg-primary/15 border-2 border-primary/40 flex items-center justify-center text-primary shadow-md"
      title="Volver a Inicio"
      whileHover={{ scale: 1.12, x: -4 }}
      whileTap={{ scale: 0.88 }}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 18 }}
    >
      <motion.div
        animate={{ x: [0, -4, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
      >
        <ArrowLeft className="w-6 h-6" strokeWidth={2.8} />
      </motion.div>
    </motion.button>
  );
};
