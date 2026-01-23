// UI Issue Report Prompt Component
// Shows a subtle prompt when UI issues are detected

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Copy, Check, MessageSquare, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { diagLog, getDeviceName } from '@/lib/diagnosticLogger';
import { cn } from '@/lib/utils';
import type { UIIssue } from '@/hooks/useUIIssueDetector';

interface UIIssueReportPromptProps {
  issue: UIIssue | null;
  show: boolean;
  onDismiss: () => void;
  onClear: () => void;
}

export const UIIssueReportPrompt: React.FC<UIIssueReportPromptProps> = ({
  issue,
  show,
  onDismiss,
  onClear,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [userDescription, setUserDescription] = useState('');
  const [copied, setCopied] = useState(false);

  if (!show || !issue) return null;

  const handleCopyLogs = async () => {
    try {
      const logsText = diagLog.getLogsAsText();
      const reportText = `
=== Reporte de Problema ===
Tipo: ${issue.type}
Mensaje: ${issue.message}
Detalles: ${issue.details}
Fecha: ${issue.timestamp.toISOString()}
Dispositivo: ${getDeviceName()}

=== Descripción del Usuario ===
${userDescription || '(No proporcionada)'}

${logsText}
      `.trim();

      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      diagLog.action('UIIssueReport', 'User copied diagnostic report');
      toast.success('Reporte copiado al portapapeles');
      
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('No se pudo copiar el reporte');
      diagLog.error('UIIssueReport', 'Failed to copy report', { error: String(err) });
    }
  };

  const handleDismiss = () => {
    setExpanded(false);
    setUserDescription('');
    onDismiss();
  };

  const handleReportViaWhatsApp = () => {
    const text = `🐛 *Reporte de Problema en M.A.T.S.*\n\n` +
      `📱 Dispositivo: ${getDeviceName()}\n` +
      `❌ Problema: ${issue.message}\n` +
      `📝 Detalles: ${issue.details}\n` +
      `🕐 Hora: ${issue.timestamp.toLocaleTimeString()}\n\n` +
      `${userDescription ? `💬 Mi descripción: ${userDescription}\n\n` : ''}` +
      `_Por favor copia los logs de diagnóstico también_`;
    
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    diagLog.action('UIIssueReport', 'User shared via WhatsApp');
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.9 }}
        className={cn(
          "fixed bottom-20 left-4 right-4 z-[9999]",
          "bg-card border border-border rounded-xl shadow-xl",
          "max-w-md mx-auto"
        )}
      >
        {/* Compact header */}
        <div className="flex items-start gap-3 p-4">
          <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center flex-shrink-0">
            <Bug className="w-5 h-5 text-warning" />
          </div>
          
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm text-foreground">
              {issue.message}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {issue.details}
            </p>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Expanded report section */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                <Textarea
                  placeholder="Describe brevemente qué intentabas hacer..."
                  value={userDescription}
                  onChange={(e) => setUserDescription(e.target.value)}
                  className="min-h-[80px] text-sm resize-none"
                  maxLength={500}
                />
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyLogs}
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-1 text-safe" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-1" />
                        Copiar Logs
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReportViaWhatsApp}
                    className="flex-1 bg-[#25D366] hover:bg-[#128C7E] text-white"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                </div>
                
                <p className="text-[10px] text-muted-foreground text-center">
                  Los logs incluyen información del dispositivo y acciones recientes para diagnóstico
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons when not expanded */}
        {!expanded && (
          <div className="flex gap-2 px-4 pb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="flex-1"
            >
              Ignorar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setExpanded(true);
                diagLog.action('UIIssueReport', 'User expanded report form');
              }}
              className="flex-1"
            >
              <Bug className="w-4 h-4 mr-1" />
              Reportar
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default UIIssueReportPrompt;
