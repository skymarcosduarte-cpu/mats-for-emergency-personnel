import React, { useState, useRef } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { Share2, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MatsLogo } from '@/components/MatsLogo';
import { APP_VERSION } from '@/lib/versionCheck';
import { toast } from 'sonner';

// Re-use the guide data & rendering from UserGuideStepByStep but in a full-page scrollable format
// so it can be shared as a URL and printed/downloaded as PDF.

import { GUIDE_PAGES } from '@/components/UserGuideStepByStep';

const PAGE_URL = typeof window !== 'undefined' ? window.location.origin + '/guia-paso-a-paso' : '';

export default function StepByStepGuidePage() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const navigate = useNavigate();

  const handleShareWhatsApp = () => {
    const text = `📖 *Guía Paso a Paso de M.A.T.S.* — Conoce todas las funciones de la app:\n${PAGE_URL}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const options = {
        margin: [12, 12, 12, 12] as [number, number, number, number],
        filename: `MATS_Guia_Paso_a_Paso_v${APP_VERSION}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] as const },
      };
      await html2pdf().set(options).from(contentRef.current).save();
      toast.success('PDF descargado correctamente');
    } catch {
      toast.error('Error al generar el PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Guía Paso a Paso — M.A.T.S.',
          text: 'Conoce todas las funciones de la app M.A.T.S.',
          url: PAGE_URL,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleShareWhatsApp();
    }
  };

  return (
    <div className="min-h-screen bg-white print:bg-white">
      <Helmet>
        <title>Guía paso a paso de M.A.T.S.: SOS, sismos y viajes</title>
        <meta name="description" content="Tutorial paso a paso de COMUNIDAD SOS: configurar el botón SOS, alertas sísmicas, Tránsito Seguro, Red Mesh y mapa comunitario. Descargable en PDF." />
        <link rel="canonical" href="https://mats-app.com/guia-paso-a-paso" />
        <meta property="og:title" content="Guía paso a paso de M.A.T.S.: SOS, sismos y viajes" />
        <meta property="og:url" content="https://mats-app.com/guia-paso-a-paso" />
        <meta property="og:description" content="Tutorial ilustrado de todas las funciones de COMUNIDAD SOS, página por página." />
      </Helmet>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-4 py-3 gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-gray-700">
            <ArrowLeft className="w-4 h-4 mr-1" /> Volver
          </Button>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button size="sm" onClick={handleShare} className="bg-green-600 hover:bg-green-700 text-white">
              <Share2 className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {isGeneratingPdf ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {isGeneratingPdf ? 'Generando…' : 'PDF'}
            </Button>
          </div>
        </div>
      </div>

      {/* Printable content */}
      <div ref={contentRef} className="max-w-3xl mx-auto px-6 py-8 print:px-4 print:py-4 bg-white text-gray-900">
        {/* Cover */}
        <header className="text-center mb-12 print:mb-6">
          <div className="flex justify-center mb-4">
            <MatsLogo size={80} />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Guía Paso a Paso</h1>
          <p className="text-xl text-orange-600 font-semibold">M.A.T.S. — Comunidad EX SOS</p>
          <p className="text-base text-muted-foreground mt-2">Versión {APP_VERSION}</p>
        </header>

        {/* All pages rendered sequentially */}
        {GUIDE_PAGES.map((page, pageIdx) => (
          <section key={pageIdx} className="mb-14 print:mb-8 page-break-before">
            {/* Page header */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b-2 border-orange-200">
              <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0">
                {page.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-orange-500 uppercase tracking-wider">
                  Paso {pageIdx + 1} de {GUIDE_PAGES.length}
                </p>
                <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">{page.title}</h2>
              </div>
            </div>

            {/* Sections */}
            {page.sections.map((section, sIdx) => (
              <div key={sIdx} className="mb-6">
                {section.heading && (
                  <h3 className="text-xl font-bold text-gray-800 mb-3">{section.heading}</h3>
                )}
                {section.paragraphs.map((p, pIdx) => (
                  <p key={pIdx} className="text-lg leading-relaxed text-gray-700 mb-3">{p}</p>
                ))}
                {section.tip && (
                  <div className="bg-blue-50 border-l-4 border-blue-400 rounded-r-lg p-4 my-3">
                    <p className="text-base text-blue-800">💡 <strong>Consejo:</strong> {section.tip}</p>
                  </div>
                )}
                {section.warning && (
                  <div className="bg-red-50 border-l-4 border-red-400 rounded-r-lg p-4 my-3">
                    <p className="text-base text-red-800">⚠️ <strong>Importante:</strong> {section.warning}</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}

        {/* Footer */}
        <footer className="text-center py-8 border-t border-gray-200 mt-8">
          <MatsLogo size={40} />
          <p className="text-sm text-muted-foreground mt-2">
            © {new Date().getFullYear()} M.A.T.S. — Comunidad EX SOS · v{APP_VERSION}
          </p>
        </footer>
      </div>
    </div>
  );
}
