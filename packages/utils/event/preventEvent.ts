export function preventEventHandler<T extends React.SyntheticEvent>(
  handler?: (event: T) => void,
) {
  return (event: T) => {
    event.preventDefault();
    handler?.(event);
  };
}
