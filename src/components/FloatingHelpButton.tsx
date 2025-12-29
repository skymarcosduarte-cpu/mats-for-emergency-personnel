import React, { useState } from 'react';
import { HelpCircle, X, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ComprehensiveTutorial } from '@/components/ComprehensiveTutorial';

interface FloatingHelpButtonProps {
  className?: string;
}

export const FloatingHelpButton: React.FC<FloatingHelpButtonProps> = ({ className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const handleOpenTutorial = () => {
    setIsExpanded(false);
    setShowTutorial(true);
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
  };

  return (
    <>
      {/* Floating Button */}
      <div className={cn("fixed bottom-24 right-4 z-40", className)}>
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-16 right-0 bg-card border border-border rounded-xl shadow-lg p-3 w-56"
            >
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground mb-2">¿Necesitas ayuda?</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-left"
                  onClick={handleOpenTutorial}
                >
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <span>Ver Tutorial Completo</span>
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-colors",
            isExpanded 
              ? "bg-muted text-muted-foreground" 
              : "bg-primary/80 text-primary-foreground hover:bg-primary"
          )}
          aria-label={isExpanded ? "Cerrar ayuda" : "Abrir ayuda"}
        >
          <AnimatePresence mode="wait">
            {isExpanded ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-4 h-4" />
              </motion.div>
            ) : (
              <motion.div
                key="help"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <HelpCircle className="w-4 h-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.button>
      </div>

      {/* Full Tutorial Modal */}
      {showTutorial && (
        <ComprehensiveTutorial 
          onComplete={handleCloseTutorial} 
          onClose={handleCloseTutorial} 
        />
      )}
    </>
  );
};
