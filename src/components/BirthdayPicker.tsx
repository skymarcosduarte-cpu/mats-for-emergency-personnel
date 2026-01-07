// Birthday Picker Component
// Easy year/month/day selection for birth dates

import React, { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface BirthdayPickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
}

const MONTHS = [
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
];

export const BirthdayPicker: React.FC<BirthdayPickerProps> = ({
  value,
  onChange,
  label = 'Fecha de nacimiento',
  required = false,
}) => {
  // Parse current value
  const [year, month, day] = useMemo(() => {
    if (!value) return ['', '', ''];
    const parts = value.split('-');
    return [parts[0] || '', parts[1] || '', parts[2] || ''];
  }, [value]);

  // Generate years (from current year back to 1920)
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result: string[] = [];
    for (let y = currentYear; y >= 1920; y--) {
      result.push(y.toString());
    }
    return result;
  }, []);

  // Generate days based on selected month and year
  const days = useMemo(() => {
    if (!month || !year) {
      // Default to 31 days
      return Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
    }
    
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, [month, year]);

  const handleYearChange = (newYear: string) => {
    const newValue = buildDate(newYear, month, day);
    onChange(newValue);
  };

  const handleMonthChange = (newMonth: string) => {
    // Validate day if month changes
    let validDay = day;
    if (year && day) {
      const daysInMonth = new Date(parseInt(year), parseInt(newMonth), 0).getDate();
      if (parseInt(day) > daysInMonth) {
        validDay = daysInMonth.toString().padStart(2, '0');
      }
    }
    const newValue = buildDate(year, newMonth, validDay);
    onChange(newValue);
  };

  const handleDayChange = (newDay: string) => {
    const newValue = buildDate(year, month, newDay);
    onChange(newValue);
  };

  const buildDate = (y: string, m: string, d: string): string => {
    if (!y || !m || !d) {
      // Return partial or empty
      if (y && m && d) return `${y}-${m}-${d}`;
      return '';
    }
    return `${y}-${m}-${d}`;
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && '*'}
        </Label>
      )}
      <div className="grid grid-cols-3 gap-2">
        {/* Year selector - FIRST for easy access */}
        <Select value={year} onValueChange={handleYearChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Año" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Month selector */}
        <Select value={month} onValueChange={handleMonthChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Day selector */}
        <Select value={day} onValueChange={handleDayChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Día" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Tu cumpleaños aparecerá en el tablero de la comunidad
      </p>
    </div>
  );
};
