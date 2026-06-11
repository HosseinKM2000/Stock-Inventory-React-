import * as Progress from "@radix-ui/react-progress";

interface Props {
  value?: number;
  bgClass?: string;
  heightClass?: string;
}

export default function ProgressBar({
  value = 50,
  heightClass = "h-2",
  bgClass = "bg-foreground",
}: Props) {
  return (
    <Progress.Root
      className={`${heightClass} w-full overflow-hidden rounded bg-gray-200/5 border border-foreground/10`}
    >
      <Progress.Indicator
        className={`h-full ${bgClass}  transition-transform rotate-180`}
        style={{
          transform: `translateX(-${100 - value}%)`,
        }}
      />
    </Progress.Root>
  );
}
