// Birthday Picker Component
// Easy year/month/day selection for birth dates

// Birthday Picker Component
// Easy year/month/day selection for birth dates

import React, { useMemo } from 'react';
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

const baseSelectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

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

  const getDaysInMonth = (y: string, m: string) => {
    if (!y || !m) return 31;
    return new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
  };

  // Generate days based on selected month and year
  const days = useMemo(() => {
    const daysInMonth = getDaysInMonth(year, month);
    return Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString().padStart(2, '0'));
  }, [month, year]);

  const buildDate = (y: string, m: string, d: string): string => {
    if (!y || !m || !d) return '';
    return `${y}-${m}-${d}`;
  };

  const clampDay = (y: string, m: string, d: string) => {
    if (!d) return '';
    const max = getDaysInMonth(y, m);
    const n = parseInt(d, 10);
    if (!Number.isFinite(n)) return '';
    return Math.min(Math.max(n, 1), max).toString().padStart(2, '0');
  };

  const handleYearChange = (newYear: string) => {
    const validDay = month ? clampDay(newYear, month, day) : day;
    onChange(buildDate(newYear, month, validDay));
  };

  const handleMonthChange = (newMonth: string) => {
    const validDay = year ? clampDay(year, newMonth, day) : day;
    onChange(buildDate(year, newMonth, validDay));
  };

  const handleDayChange = (newDay: string) => {
    onChange(buildDate(year, month, newDay));
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label>
          {label} {required && '*'}
        </Label>
      )}

      <div className="grid grid-cols-3 gap-2">
        {/* Year selector */}
        <select
          className={baseSelectClassName}
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          aria-label="Año"
        >
          <option value="" disabled>
            Año
          </option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Month selector */}
        <select
          className={baseSelectClassName}
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          aria-label="Mes"
          disabled={!year}
        >
          <option value="" disabled>
            Mes
          </option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Day selector */}
        <select
          className={baseSelectClassName}
          value={day}
          onChange={(e) => handleDayChange(e.target.value)}
          aria-label="Día"
          disabled={!year || !month}
        >
          <option value="" disabled>
            Día
          </option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-muted-foreground">Tu cumpleaños aparecerá en el tablero de la comunidad</p>
    </div>
  );
};

