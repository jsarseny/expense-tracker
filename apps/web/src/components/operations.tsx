import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Transaction, Category } from "@tracker/shared";
import { api, money, dateLabel } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CategoryIcon, Blank } from "./common";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
export function Operations({
  items,
  categories,
  onEdit,
  compact = false,
}: {
  items: Transaction[];
  categories: Category[];
  onEdit: (t: Transaction) => void;
  compact?: boolean;
}) {
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const qc = useQueryClient();
  const remove = useMutation({
    mutationFn: (id: string) => api(`/transactions/${id}`, "DELETE"),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["statistics"] });
      setDeleting(null);
      toast.success("Операция удалена");
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <>
      {items.length === 0 ? (
        <Blank />
      ) : (
        <div>
          {items.map((t) => {
            const c = categories.find((c) => c.id === t.categoryId);
            return (
              <div className="transaction-row" key={t.id}>
                <CategoryIcon category={c} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {t.comment || c?.name || "Операция"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {c?.name} · {dateLabel(t.date)}
                  </p>
                </div>
                <span
                  className={cn(
                    "font-medium number whitespace-nowrap text-sm",
                    t.kind === "income" ? "text-income" : "text-foreground",
                  )}
                >
                  {t.kind === "income" ? "+" : "−"}
                  {money(t.amountMinor)}
                </span>
                {!compact && (
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Редактировать ${t.comment || c?.name}`}
                      onClick={() => onEdit(t)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Удалить ${t.comment || c?.name}`}
                      onClick={() => setDeleting(t)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o && !remove.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить операцию?</AlertDialogTitle>
            <AlertDialogDescription>
              Операция на {money(deleting?.amountMinor ?? 0)} будет удалена.
              Баланс и статистика пересчитаются.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Отмена
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => deleting && remove.mutate(deleting.id)}
            >
              {remove.isPending ? "Удаляем…" : "Удалить операцию"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
