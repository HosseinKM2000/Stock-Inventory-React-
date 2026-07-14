import { Flex, Text } from "@radix-ui/themes";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import type { CategoryBreakdown } from "./types";

const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
  const firstPayload = payload?.[0];
  const isVisible = active && firstPayload != null;
  return (
    <div
      className="custom-tooltip"
      style={{ visibility: isVisible ? "visible" : "hidden" }}
    >
      {isVisible && (
        <p className="label">{`${label} : ${firstPayload.value}`}</p>
      )}
    </div>
  );
};

type ChartProps = {
  data: CategoryBreakdown[];
};

const Chart = ({ data }: ChartProps) => {
  if (data.length === 0) {
    return (
      <Flex justify="center" align="center" py="9">
        <Text color="gray">داده ای برای نمایش وجود ندارد</Text>
      </Flex>
    );
  }

  return (
    <BarChart
      style={{
        width: "100%",
        maxHeight: "70vh",
        aspectRatio: 1.618,
      }}
      responsive
      data={data}
      margin={{
        top: 5,
        right: 0,
        left: 0,
        bottom: 0,
      }}
    >
      <CartesianGrid vertical={false} horizontal={false} />
      <YAxis width="auto" niceTicks="snap125" />
      <XAxis dataKey="name" niceTicks="snap125" />
      <Tooltip
        content={CustomTooltip}
        isAnimationActive={true}
        defaultIndex={0}
        cursor={false}
      />
      <Bar
        dataKey="value"
        barSize={100}
        fill="#8884d8"
        isAnimationActive={true}
      />
    </BarChart>
  );
};

export default Chart;
