import type { SyntheticEvent } from "react";

export function preventEventHandler<T extends SyntheticEvent>(
  handler?: (event: T) => void,
) {
  return (event: T) => {
    event.preventDefault();
    handler?.(event);
  };
}
