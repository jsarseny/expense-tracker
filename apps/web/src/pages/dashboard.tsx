import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  ArrowRight,
  Plus,
  TrendingUp,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type {
  Statistics,
  Category,
  Transaction,
  TransactionPage,
} from "@tracker/shared";
import { api, money, localDate, dateLabel } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Field, FieldLabel } from "@/components/ui/field";
import { Failure, Loading, Blank } from "@/components/common";
import { Operations } from "@/components/operations";
const chartConfig = {
  income: { label: "Доходы", color: "var(--income)" },
  expense: { label: "Расходы", color: "var(--primary)" },
};
export function Dashboard({
  categories,
  onNew,
  onEdit,
}: {
  categories: Category[];
  onNew: () => void;
  onEdit: (t: Transaction) => void;
}) {
  const [range, setRange] = useState(() => ({
    from: localDate(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    ),
    to: localDate(
      new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0),
    ),
  }));
  const [group, setGroup] = useState("day");
  const valid = !!range.from && !!range.to && range.from <= range.to;
  const stats = useQuery({
    queryKey: ["statistics", range, group],
    queryFn: () =>
      api<Statistics>(
        "/statistics?" + new URLSearchParams({ ...range, group }),
      ),
    enabled: valid,
  });
  const recent = useQuery({
    queryKey: ["transactions", "recent"],
    queryFn: () => api<TransactionPage>("/transactions"),
  });
  const s = stats.data;
  return (
    <div className="flex flex-col gap-6">
      <header className="page-top mb-0!">
        <div>
          <h1 className="page-title">Обзор финансов</h1>
        </div>
        <Button onClick={onNew}>
          <Plus data-icon="inline-start" />
          Добавить операцию
        </Button>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-4 justify-end">
        <div className="period-fields">
          <Field className="w-auto">
            <FieldLabel htmlFor="period-from">С</FieldLabel>
            <Input
              id="period-from"
              type="date"
              value={range.from}
              onChange={(e) => setRange({ ...range, from: e.target.value })}
            />
          </Field>
          <Field className="w-auto">
            <FieldLabel htmlFor="period-to">По</FieldLabel>
            <Input
              id="period-to"
              type="date"
              value={range.to}
              onChange={(e) => setRange({ ...range, to: e.target.value })}
            />
          </Field>
        </div>
      </div>
      {!valid ? (
        <Failure
          error={
            new Error(
              "Укажите корректный период: начало должно быть не позже окончания.",
            )
          }
        />
      ) : stats.error ? (
        <Failure error={stats.error} retry={stats.refetch} />
      ) : !s ? (
        <Loading />
      ) : (
        <>
          <section className="summary-grid" aria-label="Сводка финансов">
            {[
              {
                title: "Общий баланс",
                value: s.balance,
                icon: Wallet,
                note: "За всё время",
                tone: "text-primary",
              },
              {
                title: "Доходы",
                value: s.income,
                icon: ArrowDownLeft,
                note: "За выбранный период",
                tone: "text-income",
              },
              {
                title: "Расходы",
                value: s.expense,
                icon: ArrowUpRight,
                note: "За выбранный период",
                tone: "text-expense",
              },
              {
                title: "Разница",
                value: s.difference,
                icon: TrendingUp,
                note: "Доходы минус расходы",
                tone: s.difference >= 0 ? "text-income" : "text-expense",
              },
            ].map(({ title, value, icon: Icon, note, tone }) => (
              <Card key={title}>
                <CardHeader className="flex flex-row justify-between items-center gap-2">
                  <CardDescription>{title}</CardDescription>
                  <Icon size={18} className={tone} />
                </CardHeader>
                <CardContent>
                  <p
                    className={cn(
                      "stat-value",
                      title === "Общий баланс" && "text-primary",
                    )}
                    data-testid={
                      title === "Общий баланс" ? "balance" : undefined
                    }
                  >
                    {money(value)}
                  </p>
                </CardContent>
                <CardFooter>
                  <p className="text-xs text-muted-foreground">{note}</p>
                </CardFooter>
              </Card>
            ))}
          </section>
          <section className="charts-grid">
            <Card className="chart-panel">
              <CardHeader>
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div>
                    <CardTitle>Движение денег</CardTitle>
                    <CardDescription className="mt-2">
                      Доходы и расходы за период
                    </CardDescription>
                  </div>
                  <ToggleGroup
                    type="single"
                    size="sm"
                    variant="outline"
                    value={group}
                    onValueChange={(v) => {
                      if (v) setGroup(v);
                    }}
                  >
                    <ToggleGroupItem value="day">Дни</ToggleGroupItem>
                    <ToggleGroupItem value="month">Месяцы</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                {s.income + s.expense === 0 ? (
                  <Blank
                    title="График скоро появится"
                    description="Добавьте доход или расход за этот период."
                  />
                ) : (
                  <ChartContainer
                    config={chartConfig}
                    className="h-[240px] w-full"
                  >
                    <AreaChart accessibilityLayer data={s.series}>
                      <defs>
                        <linearGradient
                          id="incomeFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--income)"
                            stopOpacity={0.18}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--income)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="expenseFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="var(--primary)"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="100%"
                            stopColor="var(--primary)"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        minTickGap={32}
                        tickFormatter={(d) =>
                          group === "day" ? dateLabel(d) : d
                        }
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        width={58}
                        tickFormatter={(v) =>
                          new Intl.NumberFormat("ru-RU", {
                            notation: "compact",
                          }).format(v / 100)
                        }
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            labelFormatter={(d) =>
                              group === "day" ? dateLabel(String(d)) : d
                            }
                            formatter={(value, name) => (
                              <span>
                                {name === "income" ? "Доходы" : "Расходы"}:{" "}
                                {money(Number(value))}
                              </span>
                            )}
                          />
                        }
                      />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="income"
                        stroke="var(--income)"
                        strokeWidth={2}
                        fill="url(#incomeFill)"
                      />
                      <Area
                        isAnimationActive={false}
                        type="monotone"
                        dataKey="expense"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fill="url(#expenseFill)"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
              <CardFooter>
                <div className="flex gap-5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-income" />
                    Доходы
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    Расходы
                  </span>
                </div>
              </CardFooter>
            </Card>
            <Card className="chart-panel">
              <CardHeader>
                <CardTitle>На что уходят деньги</CardTitle>
                <CardDescription>Расходы по категориям</CardDescription>
              </CardHeader>
              <CardContent>
                {s.categories.length === 0 ? (
                  <Blank
                    title="Нет расходов"
                    description="Расходы за выбранный период появятся здесь."
                  />
                ) : (
                  <>
                    <div className="relative">
                      <ChartContainer
                        config={Object.fromEntries(
                          s.categories.map((c) => [
                            c.id,
                            {
                              label: c.name,
                              color: `var(--category-${c.color})`,
                            },
                          ]),
                        )}
                        className="h-[180px] w-full"
                      >
                        <PieChart>
                          <Pie
                            isAnimationActive={false}
                            data={s.categories}
                            dataKey="amount"
                            nameKey="name"
                            innerRadius={61}
                            outerRadius={80}
                            paddingAngle={4}
                            stroke="none"
                          >
                            {s.categories.map((c) => (
                              <Cell
                                key={c.id}
                                fill={`var(--category-${c.color})`}
                              />
                            ))}
                          </Pie>
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                hideLabel
                                formatter={(v, name) => (
                                  <span>
                                    {name}: {money(Number(v))}
                                  </span>
                                )}
                              />
                            }
                          />
                        </PieChart>
                      </ChartContainer>
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        <span className="text-xs text-muted-foreground">
                          Всего
                        </span>
                        <span className="font-semibold number mt-1">
                          {money(s.expense)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 mt-5">
                      {s.categories.map((c) => (
                        <div
                          className="flex items-center gap-2 text-xs"
                          key={c.id}
                        >
                          <span
                            className="size-2 rounded-full"
                            style={{ background: `var(--category-${c.color})` }}
                          />
                          <span className="flex-1 truncate text-muted-foreground">
                            {c.name}
                          </span>
                          <span className="number">{money(c.amount)}</span>
                          <span className="text-muted-foreground w-9 text-right">
                            {Math.round((c.amount / s.expense) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center gap-3">
            <div>
              <CardTitle>Последние операции</CardTitle>
              <CardDescription className="mt-2">
                Ваша финансовая история
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/transactions">
                Все операции
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recent.error ? (
            <Failure error={recent.error} retry={recent.refetch} />
          ) : recent.data ? (
            <Operations
              items={recent.data.items.slice(0, 5)}
              categories={categories}
              onEdit={onEdit}
              compact
            />
          ) : (
            <Loading />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
