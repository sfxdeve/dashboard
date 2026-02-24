import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Label } from "~/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  createTimeOptions,
  formatDateTimeForButton,
  fromDateTimeInput,
  fromDateToInput,
  getTodayInput,
  toDateFromInput,
  toDateOnlyInput,
  toTimeInput,
} from "~/lib/datetime";
import { cn } from "~/lib/utils";

type DateTimePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  timezone: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  allowClear?: boolean;
  minuteStep?: number;
};

export function DateTimePickerField({
  label,
  value,
  onChange,
  timezone,
  disabled,
  required,
  error,
  allowClear = false,
  minuteStep = 5,
}: DateTimePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const timeOptions = React.useMemo(
    () => createTimeOptions(minuteStep),
    [minuteStep],
  );

  const dateInput = toDateOnlyInput(value, timezone);
  const selectedDate = toDateFromInput(dateInput);
  const timeInput = toTimeInput(value, timezone) || "00:00";

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="space-y-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !value && "text-muted-foreground",
                )}
                disabled={disabled}
              />
            }
          >
            <CalendarIcon className="mr-2 size-4" />
            {formatDateTimeForButton(value, timezone)}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (!date) {
                  return;
                }

                const nextDate = fromDateToInput(date);
                const nextValue = fromDateTimeInput(
                  nextDate,
                  timeInput,
                  timezone,
                );
                if (nextValue) {
                  onChange(nextValue);
                }
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        <NativeSelect
          value={timeInput}
          onChange={(event) => {
            const nextTime = event.target.value;
            const nextDate = dateInput || getTodayInput(timezone);
            const nextValue = fromDateTimeInput(nextDate, nextTime, timezone);
            if (nextValue) {
              onChange(nextValue);
            }
          }}
          disabled={disabled || !dateInput}
        >
          {timeOptions.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      {allowClear && value ? (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="px-0"
          disabled={disabled}
          onClick={() => onChange("")}
        >
          Clear
        </Button>
      ) : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
