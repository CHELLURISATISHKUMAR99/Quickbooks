"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface MonthPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export function RevenueChart({ data }: { data: MonthPoint[] }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-5">
      <h3 className="font-semibold mb-4">Revenue vs Expenses · last 6 months</h3>
      <div style={{ width: "100%", height: 280 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EDEBE5" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="revenue" fill="#185FA5" name="Revenue" />
            <Bar dataKey="expenses" fill="#D3D1C7" name="Expenses" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
