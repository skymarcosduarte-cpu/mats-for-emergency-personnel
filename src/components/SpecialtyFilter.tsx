import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// List of specialties - keep in sync with AuthGate and SettingsScreen
export const SPECIALTIES = [
  'Bombero',
  'Rescatista urbano',
  'Paramédico',
  'Técnico en Urgencias Médicas (TUM)',
  'Enfermera/Enfermero',
  'Médico',
  'Rescatista de alta montaña',
  'Rescatista acuático',
  'Buzo',
  'Radioaficionado',
  'Especialista en telecomunicaciones',
  'Policía',
  'Electricista',
  'Plomero',
  'Ingeniero civil',
  'Psicólogo',
  'Operador de maquinaria pesada',
  'Conductor de ambulancia',
  'Cocinero/preparación de alimentos',
  'Coordinador de albergues',
  'Traductor',
  'Veterinario',
  'Prensa',
  'Sacerdote',
];

interface SpecialtyFilterProps {
  selectedSpecialties: string[];
  onSpecialtiesChange: (specialties: string[]) => void;
  availableSpecialties?: string[];
  specialistCounts?: Record<string, number>;
}

export const SpecialtyFilter: React.FC<SpecialtyFilterProps> = ({
  selectedSpecialties,
  onSpecialtiesChange,
  availableSpecialties,
  specialistCounts = {},
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleSpecialty = (specialty: string) => {
    if (selectedSpecialties.includes(specialty)) {
      onSpecialtiesChange(selectedSpecialties.filter(s => s !== specialty));
    } else {
      onSpecialtiesChange([...selectedSpecialties, specialty]);
    }
  };

  const clearAll = () => {
    onSpecialtiesChange([]);
  };

  // Filter to show only specialties that exist in current users
  const displaySpecialties = availableSpecialties && availableSpecialties.length > 0 
    ? SPECIALTIES.filter(s => availableSpecialties.includes(s))
    : SPECIALTIES;

  const hasFilters = selectedSpecialties.length > 0;
  const totalFiltered = selectedSpecialties.reduce((sum, s) => sum + (specialistCounts[s] || 0), 0);

  return (
    <div className="fixed left-4 top-52 sm:top-56 z-[1200] max-w-[calc(100vw-2rem)]">
      {/* Collapsed view - always visible */}
      <div 
        className={cn(
          "bg-card/95 backdrop-blur-sm rounded-lg shadow-lg border border-border overflow-hidden transition-all duration-200",
          isExpanded ? "rounded-b-none border-b-0" : ""
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 p-2.5 hover:bg-accent/50 transition-colors w-full"
        >
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-foreground">
            {hasFilters ? `Filtro: ${selectedSpecialties.length}` : 'Especialidades'}
          </span>
          {hasFilters && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-auto">
              {totalFiltered} en mapa
            </Badge>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
          )}
        </button>

        {/* Selected filters preview (when collapsed) */}
        {!isExpanded && hasFilters && (
          <div className="px-2.5 pb-2 flex flex-wrap gap-1">
            {selectedSpecialties.slice(0, 3).map(specialty => (
              <Badge 
                key={specialty} 
                variant="outline" 
                className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 border-primary/30"
              >
                {specialty.length > 12 ? specialty.substring(0, 12) + '...' : specialty}
              </Badge>
            ))}
            {selectedSpecialties.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                +{selectedSpecialties.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Expanded view */}
      {isExpanded && (
        <div className="bg-card/95 backdrop-blur-sm rounded-b-lg shadow-lg border border-border border-t-0 animate-in slide-in-from-top-2 duration-200">
          {/* Header with clear button */}
          {hasFilters && (
            <div className="px-2.5 py-1.5 border-b border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                {selectedSpecialties.length} seleccionado(s)
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-6 text-[10px] text-muted-foreground hover:text-destructive px-2"
              >
                <X className="w-3 h-3 mr-1" />
                Limpiar
              </Button>
            </div>
          )}

          {/* Specialties list */}
          <div
            className="h-[40vh] max-h-[420px] overscroll-contain"
            style={{ touchAction: 'pan-y' }}
            onWheel={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {displaySpecialties.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    No hay especialistas activos
                  </p>
                ) : (
                  displaySpecialties.map(specialty => {
                    const isSelected = selectedSpecialties.includes(specialty);
                    const count = specialistCounts[specialty] || 0;

                    return (
                      <button
                        key={specialty}
                        onClick={() => toggleSpecialty(specialty)}
                        className={cn(
                          "flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs transition-colors text-left",
                          isSelected
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "hover:bg-accent/50 text-foreground"
                        )}
                      >
                        <span className="truncate flex-1 mr-2">{specialty}</span>
                        {count > 0 && (
                          <Badge
                            variant={isSelected ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-4 flex-shrink-0"
                          >
                            {count}
                          </Badge>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
          {/* Footer hint */}
          <div className="px-2.5 py-1.5 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Toca una especialidad para filtrar el mapa
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
