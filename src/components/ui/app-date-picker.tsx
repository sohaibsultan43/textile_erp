import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatDate } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";

const isoDateToPickerDate = (value: string): Date | undefined => {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
};

const pickerDateToIso = (value?: Date): string => {
  if (!value) return "";
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const typedDateToIso = (typed: string): string | null => {
  const raw = String(typed || "").trim();
  if (!raw) return "";

  const match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!match) return null;

  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return `${y}-${m}-${d}`;
};

type AppDatePickerProps = {
  value: string;
  onChange: (nextValue: string) => void;
  className?: string;
  placeholder?: string;
};

export function AppDatePicker({
  value,
  onChange,
  className,
  placeholder = "DD-MM-YYYY",
}: AppDatePickerProps) {
  const [typedValue, setTypedValue] = useState(value ? formatDate(value) : "");

  useEffect(() => {
    setTypedValue(value ? formatDate(value) : "");
  }, [value]);

  const handleTypedChange = (nextTyped: string) => {
    setTypedValue(nextTyped);
    const parsed = typedDateToIso(nextTyped);
    if (parsed !== null) {
      onChange(parsed);
    }
  };

  const handleTypedBlur = () => {
    const parsed = typedDateToIso(typedValue);
    if (parsed === null) {
      setTypedValue(value ? formatDate(value) : "");
      return;
    }
    onChange(parsed);
    setTypedValue(parsed ? formatDate(parsed) : "");
  };

  return (
    <div className={cn("relative w-full", className)}>
      <Input
        value={typedValue}
        onChange={(event) => handleTypedChange(event.target.value)}
        onBlur={handleTypedBlur}
        placeholder={placeholder}
        className={cn("pr-10", !typedValue && "text-muted-foreground")}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label="Open calendar"
          >
            <CalendarIcon className="h-4 w-4 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={isoDateToPickerDate(value)}
            onSelect={(selected) => onChange(pickerDateToIso(selected))}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
