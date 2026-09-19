import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowUp, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { APP_VERSION } from '@/lib/versionCheck';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { GUIDE_PAGES } from '@/components/UserGuideStepByStep';

export default function UserGuidePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [15, 15, 15, 15] as [number, number, number, number],
        filename: `MATS_Guia_Usuario_v${APP_VERSION}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      }).from(contentRef.current).save();
      toast.success('PDF descargado correctamente');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF. Intenta usar la opción de imprimir.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => setShowScrollTop(container.scrollTop > 300);
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="min-h-screen h-screen bg-background overflow-y-auto">
      <Helmet>
        <title>Guía del Usuario — M.A.T.S. for Emergency Personnel</title>
        <meta name="description" content="Guía de las funciones activas de M.A.T.S.: Sismos, Mapa, RecurSOS, Red Mesh, Detector de Señales y Ajustes." />
        <meta property="og:title" content="Guía del Usuario — M.A.T.S. for Emergency Personnel" />
        <meta property="og:description" content="Manual actualizado de las seis secciones operativas de M.A.T.S." />
      </Helmet>

      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2 flex-wrap justify-end">
        <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
          {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
          {isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}
        </Button>
        <Button onClick={() => window.print()} variant="outline">
          <Printer className="w-4 h-4 mr-2" /> Imprimir
        </Button>
        <Button variant="outline" onClick={() => window.history.back()}>Volver</Button>
      </div>

      <main ref={contentRef} className="max-w-4xl mx-auto p-8 print:p-4 bg-background text-foreground">
        <header className="text-center mb-12 page-break-after">
          <div className="flex justify-center mb-6"><MatsLogo size={96} /></div>
          <h1 className="text-4xl font-bold mb-3">M.A.T.S. for Emergency Personnel</h1>
          <p className="text-2xl text-primary font-semibold">Guía del Usuario</p>
          <p className="text-base text-muted-foreground mt-2">Versión {APP_VERSION}</p>
        </header>

        <nav className="mb-12 border-y border-border py-6">
          <h2 className="text-2xl font-bold mb-4">Contenido</h2>
          <ol className="grid gap-2 sm:grid-cols-2">
            {GUIDE_PAGES.map((page, index) => (
              <li key={page.title} className="text-foreground">{index + 1}. {page.title}</li>
            ))}
          </ol>
        </nav>

        {GUIDE_PAGES.map((page, pageIndex) => (
          <section key={page.title} className="mb-12 page-break-before">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-primary/30">
              <div className={cn('w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0', page.accentColor)}>
                {page.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-primary uppercase">Sección {pageIndex + 1}</p>
                <h2 className="text-2xl font-bold">{page.title}</h2>
              </div>
            </div>
            {page.sections.map((section, sectionIndex) => (
              <div key={sectionIndex} className="mb-6 space-y-3">
                {section.heading && <h3 className="text-xl font-bold">{section.heading}</h3>}
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="text-lg leading-relaxed text-muted-foreground">{paragraph}</p>
                ))}
                {section.tip && <p className="border-l-4 border-primary bg-primary/10 p-4"><strong>Consejo:</strong> {section.tip}</p>}
                {section.warning && <p className="border-l-4 border-destructive bg-destructive/10 p-4"><strong>Importante:</strong> {section.warning}</p>}
              </div>
            ))}
          </section>
        ))}

        <footer className="text-center py-8 border-t border-border">
          <div className="flex justify-center"><MatsLogo size={48} /></div>
          <p className="text-sm text-muted-foreground mt-3">M.A.T.S. for Emergency Personnel · v{APP_VERSION}</p>
        </footer>
      </main>

      <Button
        onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        className={cn('fixed bottom-6 right-6 z-50 rounded-full w-12 h-12 p-0 shadow-lg transition-all print:hidden', showScrollTop ? 'opacity-100' : 'opacity-0 pointer-events-none')}
        size="icon"
        aria-label="Volver al inicio"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  );
}
