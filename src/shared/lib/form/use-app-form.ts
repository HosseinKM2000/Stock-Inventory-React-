import { useState } from "react";
import type { z } from "zod";

type Options<T extends z.ZodType> = {
  schema: T;
  initialValues: z.input<T>;
  onSubmit: (values: z.output<T>) => void;
};

export function useAppForm<T extends z.ZodType>({
  schema,
  initialValues,
  onSubmit,
}: Options<T>) {
  type Values = z.input<T>;

  const [values, setValues] = useState<Values>(initialValues);

  const [errors, setErrors] = useState<
    Partial<Record<keyof Values, string>>
  >({});

  function setValue<K extends keyof Values>(
    key: K,
    value: Values[K],
  ) {
    setValues((prev) => ({
      ...prev,
      [key]: value,
    }));

    if (errors[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: undefined,
      }));
    }
  }

  function handleChange(
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement
    >,
  ) {
    const { name, value } = e.target;

    setValue(name as keyof Values, value as Values[keyof Values]);
  }

  function submit() {
    const result = schema.safeParse(values);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof Values, string>> =
        {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (
          typeof field === "string" &&
          !(field in fieldErrors)
        ) {
          fieldErrors[field as keyof Values] =
            issue.message;
        }
      }

      setErrors(fieldErrors);

      return;
    }

    setErrors({});

    onSubmit(result.data);
  }

  function reset() {
    setValues(initialValues);
    setErrors({});
  }

  return {
    values,
    errors,
    submit,
    reset,
    handleChange,
    setValue,
    setValues,
    setErrors,
  };
}