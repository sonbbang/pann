'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const label = value?.from && value?.to
    ? `${format(value.from, 'yyyy.MM.dd', { locale: ko })} ~ ${format(value.to, 'yyyy.MM.dd', { locale: ko })}`
    : '기간 선택';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CalendarIcon className="h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={(range) => {
            onChange(range);
            if (range?.from && range?.to) setOpen(false);
          }}
          numberOfMonths={2}
          locale={ko}
        />
      </PopoverContent>
    </Popover>
  );
}
