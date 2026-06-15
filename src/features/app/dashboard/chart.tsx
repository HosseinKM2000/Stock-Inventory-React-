import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

const data = [
  {
    name: "Food",
    pv: 60,
  },
  {
    name: "Drinks",
    pv: 70,
  },
  {
    name: "Tools",
    pv: 5,
  },
  {
    name: "Tools",
    pv: 50,
  },
  {
    name: "Tools",
    pv: 2,
  },
  {
    name: "Tools",
    pv: 25,
  },
  {
    name: "Tools",
    pv: 10,
  },
];

const getIntroOfPage = (label: string | number | undefined) => {
  if (label === "Page A") {
    return "Page A is about men's clothing";
  }
  if (label === "Page B") {
    return "Page B is about women's dress";
  }
  if (label === "Page C") {
    return "Page C is about women's bag";
  }
  if (label === "Page D") {
    return "Page D is about household goods";
  }
  if (label === "Page E") {
    return "Page E is about food";
  }
  if (label === "Page F") {
    return "Page F is about baby food";
  }
  return "";
};

const CustomTooltip = ({ active, payload, label }: TooltipContentProps) => {
  const firstPayload = payload?.[0];
  const isVisible = active && firstPayload != null;
  return (
    <div
      className="custom-tooltip"
      style={{ visibility: isVisible ? "visible" : "hidden" }}
    >
      {isVisible && (
        <>
          <p className="label">{`${label} : ${firstPayload.value}`}</p>
          <p className="intro">{getIntroOfPage(label)}</p>
          <p className="desc">Anything you want can be displayed here.</p>
        </>
      )}
    </div>
  );
};

const Chart = () => {
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
      <Legend />
      <Bar dataKey="pv" barSize={100} fill="#8884d8" isAnimationActive={true} />
    </BarChart>
  );
};

export default Chart;
