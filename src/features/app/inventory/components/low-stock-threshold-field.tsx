import { FormField } from "@/shared/ui/form/field/form-field";
import { TextInput } from "@/shared/ui/form/input/text-input";
import { normalizeIntegerText } from "../services/localized-integer";

type Props = {
  id?: string;
  value: number | string;
  disabled?: boolean;
  optional?: boolean;
  error?: string;
  onValueChange(value: string): void;
};

export function LowStockThresholdField({
  id = "low_stock_threshold",
  value,
  disabled,
  optional = false,
  error,
  onValueChange,
}: Props) {
  return <FormField
    id={id}
    label="حد نصاب هشدار"
    error={error}
    description={optional ? "برای بدون تغییر ماندن، این فیلد را خالی بگذارید." : undefined}
  >
    <TextInput
      id={id}
      size="3"
      type="text"
      inputMode="numeric"
      pattern="[0-9۰-۹٠-٩]*"
      name={id}
      value={value}
      placeholder={optional ? "بدون تغییر" : "۰"}
      onFocus={(event) => { if (event.currentTarget.value) event.currentTarget.select(); }}
      onChange={(event) => onValueChange(normalizeIntegerText(event.target.value))}
      disabled={disabled}
    />
  </FormField>;
}
