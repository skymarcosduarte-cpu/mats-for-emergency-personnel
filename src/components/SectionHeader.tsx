// Section Header with Back to Home button
import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  onGoHome?: () => void;
  rightContent?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  onGoHome,
  rightContent,
}) => {
  return (
    <div className="sticky top-0 z-20 -mx-4 px-4 pb-3 pt-4 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onGoHome && (
            <motion.button
              onClick={onGoHome}
              className="h-10 w-10 shrink-0 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm"
              title="Volver a Inicio"
              whileHover={{ scale: 1.1, x: -3 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <motion.div
                animate={{ x: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
              </motion.div>
            </motion.button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {rightContent && (
          <div className="flex gap-2 shrink-0">
            {rightContent}
          </div>
        )}
      </div>
    </div>
  );
};
