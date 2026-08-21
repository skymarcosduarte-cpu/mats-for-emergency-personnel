// Botón reutilizable para descargar la guía completa + onboarding en PDF (offline)
import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GuidePdfButtonProps {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  label?: string;
}

export const GuidePdfButton: React.FC<GuidePdfButtonProps> = ({
  className,
  variant = 'outline',
  size = 'sm',
  label = 'Descargar PDF',
}) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const t = toast.loading('Generando PDF de la guía…');
    try {
      const { downloadGuidePdf } = await import('@/lib/guidePdf');
      await downloadGuidePdf();
      toast.success('PDF descargado. Ya puedes compartirlo sin internet.', { id: t });
    } catch (e) {
      console.error('[GuidePdf] error', e);
      toast.error('No se pudo generar el PDF. Intenta de nuevo.', { id: t });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className={cn('gap-1.5', className)}
      aria-label="Descargar guía completa en PDF"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Download className="w-4 h-4" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
};

export default GuidePdfButton;
