import { formatCurrency, percentChange } from "@/lib/utils/format";

interface Props {
  revenueMtd: number;
  expensesMtd: number;
  netProfitMtd: number;
  outstandingCount: number;
  outstandingAmount: number;
  revenuePrev: number;
  expensesPrev: number;
}

export function DashboardMetrics(props: Props) {
  const revChange = percentChange(props.revenueMtd, props.revenuePrev);
  const expChange = percentChange(props.expensesMtd, props.expensesPrev);
  const netPrev = props.revenuePrev - props.expensesPrev;
  const netChange = percentChange(props.netProfitMtd, netPrev);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Revenue MTD"
        value={formatCurrency(props.revenueMtd)}
        change={revChange}
        upIsGood
      />
      <Card
        label="Expenses MTD"
        value={formatCurrency(props.expensesMtd)}
        change={expChange}
        upIsGood={false}
      />
      <Card
        label="Net Profit MTD"
        value={formatCurrency(props.netProfitMtd)}
        change={netChange}
        upIsGood
      />
      <Card
        label="Outstanding Invoices"
        value={formatCurrency(props.outstandingAmount)}
        subtext={`${props.outstandingCount} invoice${props.outstandingCount === 1 ? "" : "s"}`}
      />
    </div>
  );
}

function Card({
  label,
  value,
  change,
  upIsGood,
  subtext,
}: {
  label: string;
  value: string;
  change?: number;
  upIsGood?: boolean;
  subtext?: string;
}) {
  let changeEl: React.ReactNode = null;
  if (change !== undefined) {
    const up = change >= 0;
    const good = upIsGood ? up : !up;
    changeEl = (
      <span
        className={`text-xs font-medium ${good ? "text-green-600" : "text-red-600"}`}
      >
        {up ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
      </span>
    );
  }
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <div className="text-xs text-neutral-500 mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-2">{changeEl ?? <span className="text-xs text-neutral-500">{subtext}</span>}</div>
    </div>
  );
}
