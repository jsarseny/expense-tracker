import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import type { Category } from "@tracker/shared";
import { api } from "@/lib/api";
import { CategoryIcon, Blank } from "@/components/common";
import { CategoryDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
export function Categories({ categories }: { categories: Category[] }) {
  const [edit, setEdit] = useState<Category | null | undefined>();
  const [mode, setMode] = useState("expense");
  const qc = useQueryClient();
  const archive = useMutation({
    mutationFn: (c: Category) =>
      api(`/categories/${c.id}`, "PATCH", { archived: !c.archived }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Категория обновлена");
    },
    onError: (e) => toast.error(e.message),
  });
  const list = categories.filter((c) =>
    mode === "archived" ? c.archived : !c.archived && c.kind === mode,
  );
  return (
    <>
      <header className="page-top">
        <div>
          <h1 className="page-title">Категории</h1>
        </div>
        <Button onClick={() => setEdit(null)}>
          <Plus data-icon="inline-start" />
          Новая категория
        </Button>
      </header>
      <ToggleGroup
        className="mb-6"
        type="single"
        value={mode}
        onValueChange={(v) => {
          if (v) setMode(v);
        }}
        variant="outline"
      >
        <ToggleGroupItem value="expense">Расходы</ToggleGroupItem>
        <ToggleGroupItem value="income">Доходы</ToggleGroupItem>
        <ToggleGroupItem value="archived">Архив</ToggleGroupItem>
      </ToggleGroup>
      <Card>
        <CardHeader>
          <CardTitle>
            {mode === "archived"
              ? "Архив категорий"
              : mode === "income"
                ? "Категории доходов"
                : "Категории расходов"}
          </CardTitle>
          <CardDescription>
            {mode === "archived"
              ? "Архивные категории сохраняются в истории операций."
              : "Настройте категории под свои привычки."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <Blank
              title="Категорий нет"
              description="Создайте новую категорию или восстановите её из архива."
            />
          ) : (
            <div>
              {list.map((c) => (
                <div className="transaction-row" key={c.id}>
                  <CategoryIcon category={c} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    {mode === "archived" && (
                      <Badge variant="secondary">
                        {c.kind === "income" ? "Доход" : "Расход"}
                      </Badge>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Редактировать ${c.name}`}
                    onClick={() => setEdit(c)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={archive.isPending}
                    aria-label={`${c.archived ? "Восстановить" : "Архивировать"} ${c.name}`}
                    onClick={() => archive.mutate(c)}
                  >
                    {c.archived ? <ArchiveRestore /> : <Archive />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {edit !== undefined && (
        <CategoryDialog value={edit} onClose={() => setEdit(undefined)} />
      )}
    </>
  );
}
