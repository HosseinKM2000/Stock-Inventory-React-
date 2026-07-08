import { useEffect, useRef, useState } from "react";
import type { ZodType } from "zod";

type Options<TValues extends Record<string, unknown>> = {
  schema: ZodType<TValues>;
  initialValues: TValues;
  onSubmit: (values: TValues) => void;
};

export function useAppForm<TValues extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
}: Options<TValues>) {
  const initialized = useRef(false);

  const [values, setValues] = useState<TValues>(initialValues);

  const [errors, setErrors] = useState<
    Partial<Record<keyof TValues, string>>
  >({});

  useEffect(() => {
    if (initialized.current) return;

    initialized.current = true;

    setValues(initialValues);
  }, [initialValues]);

  function load(values: TValues) {
    setValues(values);
    setErrors({});
  }

  function patch(values: Partial<TValues>) {
    setValues((prev) => ({
      ...prev,
      ...values,
    }));
  }

  function reset() {
    setValues(initialValues);
    setErrors({});
  }

  function clearErrors() {
    setErrors({});
  }

  function setFieldError<K extends keyof TValues>(
    key: K,
    message?: string,
  ) {
    setErrors((prev) => ({
      ...prev,
      [key]: message,
    }));
  }

  function setValue<K extends keyof TValues>(
    key: K,
    value: TValues[K],
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

    setValue(
      name as keyof TValues,
      value as TValues[keyof TValues],
    );
  }

  function submit() {
    const result = schema.safeParse(values);

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof TValues, string>> =
        {};

      for (const issue of result.error.issues) {
        const field = issue.path[0];

        if (
          typeof field === "string" &&
          !(field in fieldErrors)
        ) {
          fieldErrors[field as keyof TValues] =
            issue.message;
        }
      }

      setErrors(fieldErrors);

      return;
    }

    clearErrors();

    onSubmit(result.data);
  }

  return {
    values,
    errors,

    submit,
    reset,

    load,
    patch,

    setValue,
    handleChange,

    clearErrors,
    setFieldError,
  };
}