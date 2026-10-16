import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { Category, Transaction, TransactionPage } from "@tracker/shared";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Failure, Loading } from "@/components/common";
import { Operations } from "@/components/operations";
export function Transactions({
  categories,
  onNew,
  onEdit,
}: {
  categories: Category[];
  onNew: () => void;
  onEdit: (t: Transaction) => void;
}) {
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    kind: "",
    categoryId: "",
    search: "",
    page: 1,
  });
  const change = (key: string, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, page: 1 }));
  const valid = !filters.from || !filters.to || filters.from <= filters.to;
  const query = new URLSearchParams(
    Object.entries(filters)
      .filter(([, v]) => v !== "")
      .map(([k, v]) => [k, String(v)]),
  );
  const result = useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => api<TransactionPage>("/transactions?" + query),
    enabled: valid,
  });
  return (
    <>
      <header className="page-top">
        <div>
          <h1 className="page-title">Операции</h1>
        </div>
        <Button onClick={onNew}>
          <Plus data-icon="inline-start" />
          Добавить операцию
        </Button>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>История операций</CardTitle>
          <CardDescription>
            Найдите нужную запись с помощью фильтров.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="filters mb-6">
            {[
              { key: "from", label: "С", type: "date" },
              { key: "to", label: "По", type: "date" },
              { key: "search", label: "Поиск", type: "search" },
            ].map((f) => (
              <Field
                key={f.key}
                className={f.key === "search" ? "min-w-40 flex-1" : "w-auto"}
              >
                <FieldLabel htmlFor={"filter-" + f.key}>{f.label}</FieldLabel>
                <Input
                  id={"filter-" + f.key}
                  type={f.type}
                  placeholder={
                    f.key === "search" ? "По комментарию" : undefined
                  }
                  value={filters[f.key as "from" | "to" | "search"]}
                  onChange={(e) => change(f.key, e.target.value)}
                />
              </Field>
            ))}
            <Field className="w-auto">
              <FieldLabel htmlFor="filter-kind">Тип</FieldLabel>
              <NativeSelect
                id="filter-kind"
                value={filters.kind}
                onChange={(e) => {
                  setFilters({
                    ...filters,
                    kind: e.target.value,
                    categoryId: "",
                    page: 1,
                  });
                }}
              >
                <NativeSelectOption value="">Все</NativeSelectOption>
                <NativeSelectOption value="income">Доходы</NativeSelectOption>
                <NativeSelectOption value="expense">Расходы</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field className="w-auto">
              <FieldLabel htmlFor="filter-category">Категория</FieldLabel>
              <NativeSelect
                id="filter-category"
                value={filters.categoryId}
                onChange={(e) => change("categoryId", e.target.value)}
              >
                <NativeSelectOption value="">Все категории</NativeSelectOption>
                {categories
                  .filter((c) => !filters.kind || c.kind === filters.kind)
                  .map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? " (архив)" : ""}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
            </Field>
            <Button
              variant="ghost"
              onClick={() =>
                setFilters({
                  from: "",
                  to: "",
                  kind: "",
                  categoryId: "",
                  search: "",
                  page: 1,
                })
              }
            >
              Сбросить
            </Button>
          </div>
          {!valid ? (
            <Failure
              error={new Error("Начало периода должно быть не позже окончания")}
            />
          ) : result.error ? (
            <Failure error={result.error} retry={result.refetch} />
          ) : !result.data ? (
            <Loading />
          ) : (
            <>
              <Operations
                items={result.data.items}
                categories={categories}
                onEdit={onEdit}
              />
              <div className="flex items-center justify-between mt-6 gap-2 text-sm text-muted-foreground">
                <span>Всего: {result.data.total}</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Предыдущая страница"
                    disabled={filters.page <= 1}
                    onClick={() =>
                      setFilters({ ...filters, page: filters.page - 1 })
                    }
                  >
                    <ChevronLeft />
                  </Button>
                  <span>
                    {filters.page} /{" "}
                    {Math.max(1, Math.ceil(result.data.total / 20))}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Следующая страница"
                    disabled={filters.page * 20 >= result.data.total}
                    onClick={() =>
                      setFilters({ ...filters, page: filters.page + 1 })
                    }
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
