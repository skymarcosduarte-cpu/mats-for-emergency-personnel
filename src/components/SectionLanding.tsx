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
  borderColor?: string; // Optional border color class
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
      <div className="p-4 space-y-2">
        <h1 className="text-3xl font-bold text-foreground">{title}</h1>
        <p className="text-base text-muted-foreground">{subtitle}</p>
      </div>

      {/* Large Button Cards */}
      <div className="px-4 space-y-4">
        {items.map((item, index) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center gap-4 p-5 rounded-2xl",
              "bg-card border-2 shadow-sm",
              "hover:scale-[1.02] hover:shadow-md active:scale-[0.98]",
              "transition-all duration-200 animate-fade-in",
              item.borderColor || "border-border"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Icon */}
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
              "transition-transform duration-300 hover:scale-105",
              item.iconBg
            )}>
              {item.icon}
            </div>

            {/* Text */}
            <div className="flex-1 text-left min-w-0">
              <h3 className="font-bold text-foreground text-xl">
                {item.label}
              </h3>
              <p className="text-base text-muted-foreground line-clamp-2 leading-relaxed">
                {item.description}
              </p>
            </div>

            {/* Chevron */}
            <ChevronRight className="w-7 h-7 text-muted-foreground/60 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default SectionLanding;
