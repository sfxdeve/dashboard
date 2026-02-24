import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Calendar } from "~/components/ui/calendar";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import {
  formatDateForButton,
  fromDateToInput,
  toDateFromInput,
} from "~/lib/datetime";

type DatePickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  placeholder?: string;
  allowClear?: boolean;
};

export function DatePickerField({
  label,
  value,
  onChange,
  disabled,
  required,
  error,
  placeholder = "Pick a date",
  allowClear = false,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const selected = toDateFromInput(value);

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !selected && "text-muted-foreground",
              )}
              disabled={disabled}
            />
          }
        >
          <CalendarIcon className="mr-2 size-4" />
          {selected ? formatDateForButton(value) : placeholder}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              if (!date) {
                return;
              }

              onChange(fromDateToInput(date));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
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
