import { useState } from "react";
import type { ChangeEvent } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Input } from "~/components/ui/input";

export function DatePicker() {
  const [date, setDate] = useState<Date | undefined>();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!date}
            className="data-[empty=true]:text-muted-foreground justify-start text-left font-normal"
          />
        }
      >
        <CalendarIcon />
        {date ? format(date, "PPP") : <span>Pick a date</span>}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </PopoverContent>
    </Popover>
  );
}

export function DatePickerRange() {
  const [range, setRange] = useState<DateRange | undefined>();

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!range?.from}
            className="data-[empty=true]:text-muted-foreground justify-start text-left font-normal"
          />
        }
      >
        <CalendarIcon />
        {range?.from != null ? (
          range.to != null ? (
            <>
              {format(range.from, "LLL d, y")} – {format(range.to, "LLL d, y")}
            </>
          ) : (
            format(range.from, "LLL d, y")
          )
        ) : (
          <span>Pick a date range</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="range"
          selected={range}
          onSelect={setRange}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  );
}

export function DateTimePicker() {
  const [date, setDate] = useState<Date | undefined>(() => new Date());
  const [time, setTime] = useState(
    () =>
      `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
  );

  const handleSelect = (d: Date | undefined) => {
    setDate(d);
    if (d) {
      setTime(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      );
    }
  };

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTime(value);
    const [h, m] = value.split(":").map(Number);
    if (date && !Number.isNaN(h) && !Number.isNaN(m)) {
      const next = new Date(date);
      next.setHours(h, m, 0, 0);
      setDate(next);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            data-empty={!date}
            className="data-[empty=true]:text-muted-foreground justify-start text-left font-normal w-full"
          />
        }
      >
        <CalendarIcon />
        {date ? (
          <>
            {format(date, "PPP")} at {time}
          </>
        ) : (
          <span>Pick date and time</span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={handleSelect} />
        <div className="border-t p-3">
          <label className="text-muted-foreground text-xs">Time</label>
          <Input
            type="time"
            value={time}
            onChange={handleTimeChange}
            className="mt-1"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
