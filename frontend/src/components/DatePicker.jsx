import { useState } from "react";
import { fr } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const toLocalISO = (d) => format(d, "yyyy-MM-dd");

export const DatePicker = ({
  value,
  onChange,
  testid,
  placeholder = "Choisir une date",
  minDate,
  className = "",
}) => {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid={testid}
          className={`flex items-center gap-2 w-full h-9 px-3 rounded-md border border-input bg-white text-sm text-left ${className}`}
        >
          <CalendarDays size={14} className="text-slate-400 shrink-0" />
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {selected
              ? format(selected, "d MMM yyyy", { locale: fr })
              : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={fr}
          weekStartsOn={1}
          selected={selected}
          defaultMonth={selected}
          disabled={minDate ? { before: parseISO(minDate) } : undefined}
          onSelect={(d) => {
            onChange(d ? toLocalISO(d) : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
