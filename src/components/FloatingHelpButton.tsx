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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error('timeout')), ms);

    promise.then(
      (value) => {
        window.clearTimeout(t);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      }
    );
  });
};

const feedbackSchema = z.object({
  category: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  message: z.string().trim().min(1).max(2000),
});

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

  const submitFeedback = async () => {
    const parsed = feedbackSchema.safeParse(feedbackForm);
    if (!parsed.success) {
      toast({
        title: 'Campos inválidos',
        description: parsed.error.issues[0]?.message ?? 'Revisa los datos e intenta de nuevo.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    const values = parsed.data;

    try {
      const {
        data: { user },
        error: userError,
      } = await withTimeout(supabase.auth.getUser(), 8000);

      if (userError) throw userError;

      const { error } = await withTimeout(
        (supabase.from('user_feedback').insert({
          user_id: user?.id ?? null,
          category: values.category,
          name: values.name,
          email: values.email.toLowerCase(),
          message: values.message,
        }) as unknown as PromiseLike<{ error: unknown }>),
        12000
      );

      if (error) throw error;

      toast({
        title: '¡Gracias por tu feedback!',
        description: 'Hemos recibido tu mensaje y lo revisaremos pronto.',
      });

      handleCloseFeedback();
    } catch (error: any) {
      const isTimeout = String(error?.message || '').includes('timeout');
      console.error('Error submitting feedback:', error);

      toast({
        title: isTimeout ? 'Tiempo de espera' : 'Error al enviar',
        description: isTimeout
          ? 'Parece que la conexión está lenta. Intenta de nuevo.'
          : 'No pudimos enviar tu feedback. Intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    void submitFeedback();
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
              <select
                id="category"
                name="category"
                value={feedbackForm.category}
                onChange={(e) =>
                  setFeedbackForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className={cn(
                  "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                )}
                required
              >
                <option value="" disabled>
                  Selecciona una categoría
                </option>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
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
              <Button
                type="submit"
                disabled={isSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  void submitFeedback();
                }}
              >
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
