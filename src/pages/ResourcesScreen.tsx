import React, { useState, useEffect } from 'react';
import { HeartPulse, BookOpen, Phone } from 'lucide-react';
import { SectionLanding, SectionLandingItem } from '@/components/SectionLanding';
import { BackToHomeButton } from '@/components/BackToHomeButton';
import EmergencyGuidesScreen from '@/components/EmergencyGuidesScreen';
import EmergencyDirectory from '@/components/EmergencyDirectory';

type SubView = 'landing' | 'guides' | 'directory';

interface ResourcesScreenProps {
  onGoHome?: () => void;
  initialSubView?: SubView;
}

export default function ResourcesScreen({ onGoHome, initialSubView }: ResourcesScreenProps) {
  const [subView, setSubView] = useState<SubView>(initialSubView || 'landing');

  // Sync when initialSubView changes (e.g. after panic alert)
  useEffect(() => {
    if (initialSubView) {
      setSubView(initialSubView);
    }
  }, [initialSubView]);

  const items: SectionLandingItem[] = [
    {
      id: 'directory',
      label: 'Directorio PC y Cruz Roja',
      description: 'Protección Civil y Cruz Roja Internacional — teléfonos, ubicaciones y servicios por país',
      icon: <Phone className="w-8 h-8 text-white" strokeWidth={2.5} />,
      iconBg: 'bg-[hsl(0,90%,50%)]',
      borderColor: 'border-[hsl(0,90%,50%)]/40',
      onClick: () => setSubView('directory'),
    },
    {
      id: 'guides',
      label: 'Guías de Emergencias',
      description: 'Recursos educativos, primeros auxilios, protocolos de seguridad y más',
      icon: <BookOpen className="w-8 h-8 text-white" strokeWidth={2.5} />,
      iconBg: 'bg-[hsl(25,100%,50%)]',
      borderColor: 'border-[hsl(25,100%,50%)]/40',
      onClick: () => setSubView('guides'),
    },
  ];

  if (subView === 'guides') {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-3 p-4 pb-0">
          <BackToHomeButton onClick={() => setSubView('landing')} />
          <h1 className="text-xl font-bold">Guías de Emergencias</h1>
        </div>
        <EmergencyGuidesScreen />
      </div>
    );
  }

  if (subView === 'directory') {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-3 p-4 pb-0">
          <BackToHomeButton onClick={() => setSubView('landing')} />
          <h1 className="text-xl font-bold">Directorio PC y Cruz Roja</h1>
        </div>
        <EmergencyDirectory />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {onGoHome && (
        <div className="flex items-center gap-3 p-4 pb-0">
          <BackToHomeButton onClick={onGoHome} />
        </div>
      )}
      <SectionLanding
        title="RecurSOS"
        subtitle="Directorio de emergencias y guías de protección"
        items={items}
      />
    </div>
  );
}
