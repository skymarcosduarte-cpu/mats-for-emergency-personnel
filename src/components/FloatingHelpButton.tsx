import React, { useState } from 'react';
import { HelpCircle, X, GraduationCap, MessageSquarePlus, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { ComprehensiveTutorial } from '@/components/ComprehensiveTutorial';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface FloatingHelpButtonProps {
  className?: string;
}

const FEEDBACK_CATEGORIES = [
  { value: 'problema', label: 'Reportar un problema' },
  { value: 'sugerencia', label: 'Sugerencia de mejora' },
  { value: 'invitacion', label: 'Solicitar invitación' },
  { value: 'otro', label: 'Otro' },
];

export const FloatingHelpButton: React.FC<FloatingHelpButtonProps> = ({ className }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [feedbackForm, setFeedbackForm] = useState({
    category: '',
    name: '',
    email: '',
    message: '',
  });

  const handleOpenTutorial = () => {
    setIsExpanded(false);
    setShowTutorial(true);
  };

  const handleCloseTutorial = () => {
    setShowTutorial(false);
  };

  const handleOpenFeedback = () => {
    setIsExpanded(false);
    setShowFeedbackDialog(true);
  };

  const handleCloseFeedback = () => {
    setShowFeedbackDialog(false);
    setFeedbackForm({ category: '', name: '', email: '', message: '' });
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedbackForm.category || !feedbackForm.name || !feedbackForm.email || !feedbackForm.message) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos.",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(feedbackForm.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor ingresa un email válido.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('user_feedback')
        .insert({
          user_id: user?.id || null,
          category: feedbackForm.category,
          name: feedbackForm.name.trim(),
          email: feedbackForm.email.trim().toLowerCase(),
          message: feedbackForm.message.trim(),
        });

      if (error) throw error;

      toast({
        title: "¡Gracias por tu feedback!",
        description: "Hemos recibido tu mensaje y lo revisaremos pronto.",
      });

      handleCloseFeedback();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error al enviar",
        description: "No pudimos enviar tu feedback. Intenta de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating Button - z-index higher than map */}
      <div className={cn("fixed bottom-24 right-4 z-[1100]", className)}>
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-left"
                  onClick={handleOpenFeedback}
                >
                  <MessageSquarePlus className="w-4 h-4 text-primary" />
                  <span>Enviar Feedback</span>
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

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Feedback</DialogTitle>
            <DialogDescription>
              Reporta problemas, sugerencias o solicita una invitación.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmitFeedback} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={feedbackForm.category}
                onValueChange={(value) => setFeedbackForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[10200]">
                  {FEEDBACK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Tu nombre"
                value={feedbackForm.name}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, name: e.target.value }))}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={feedbackForm.email}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, email: e.target.value }))}
                maxLength={255}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensaje</Label>
              <Textarea
                id="message"
                placeholder="Describe tu problema, sugerencia o solicitud..."
                value={feedbackForm.message}
                onChange={(e) => setFeedbackForm(prev => ({ ...prev, message: e.target.value }))}
                rows={4}
                maxLength={2000}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseFeedback}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
