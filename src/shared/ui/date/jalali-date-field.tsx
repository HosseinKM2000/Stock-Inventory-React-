import { TextField } from "@radix-ui/themes";
import { parseJalaliDate } from "@/shared/lib/date/jalali";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function JalaliDateField({ id, label, value, onChange }: Props) {
  const invalid = value.trim().length > 0 && parseJalaliDate(value) == null;
  const errorId = `${id}-error`;
  return (
    <label htmlFor={id} className="jalali-date-field">
      <span>{label}</span>
      <TextField.Root
        id={id}
        dir="ltr"
        inputMode="numeric"
        autoComplete="off"
        placeholder="۱۴۰۳/۱۲/۰۱"
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid ? <small id={errorId} role="alert">تاریخ را به شکل ۱۴۰۳/۱۲/۰۱ وارد کنید.</small> : null}
    </label>
  );
}
