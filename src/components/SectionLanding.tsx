// SectionLanding Component
// Shows large icon buttons for sections that have multiple tabs inside
// Used as an entry view before navigating to specific tabs

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionLandingItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
}

interface SectionLandingProps {
  title: string;
  subtitle: string;
  items: SectionLandingItem[];
}

export const SectionLanding: React.FC<SectionLandingProps> = ({
  title,
  subtitle,
  items,
}) => {
  return (
    <div className="flex-1 overflow-auto pb-20">
      {/* Header */}
      <div className="p-4 space-y-1">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Large Button Cards */}
      <div className="px-4 space-y-3">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center gap-4 p-4 rounded-xl",
              "bg-card border border-border/50",
              "hover:bg-muted/50 active:scale-[0.98]",
              "transition-all duration-200"
            )}
          >
            {/* Icon */}
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
              item.iconBg
            )}>
              {item.icon}
            </div>

            {/* Text */}
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-semibold text-foreground text-base">
                {item.label}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            </div>

            {/* Chevron */}
            <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SectionLanding;
