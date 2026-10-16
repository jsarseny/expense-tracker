import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";
import {
  categorySchema,
  transactionSchema,
  type Category,
  type CategoryInput,
  type Transaction,
} from "@tracker/shared";
import { api, localDate } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { colorNames, iconNames } from "./common";
const transactionFormSchema = transactionSchema
  .omit({ amountMinor: true, comment: true })
  .extend({
    amount: z
      .string()
      .regex(/^\d{1,10}([.,]\d{1,2})?$/, "Введите сумму, например 1250,50")
      .refine(
        (v) => Number(v.replace(",", ".")) > 0,
        "Сумма должна быть больше нуля",
      )
      .refine(
        (v) => Number(v.replace(",", ".")) <= 1_000_000_000,
        "Максимум 1 млрд ₽",
      ),
    comment: z.string().max(500),
  });
type TransactionForm = z.infer<typeof transactionFormSchema>;
export function TransactionDialog({
  value,
  categories,
  onClose,
}: {
  value: Transaction | null;
  categories: Category[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<TransactionForm>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: value
      ? {
          ...value,
          amount: (value.amountMinor / 100).toFixed(2).replace(".", ","),
        }
      : {
          kind: "expense",
          amount: "",
          date: localDate(),
          categoryId: "",
          comment: "",
        },
  });
  const kind = form.watch("kind");
  const save = useMutation({
    mutationFn: (body: TransactionForm) => {
      const [whole, fraction = ""] = body.amount.replace(",", ".").split(".");
      return api(
        value ? `/transactions/${value.id}` : "/transactions",
        value ? "PUT" : "POST",
        {
          kind: body.kind,
          categoryId: body.categoryId,
          date: body.date,
          comment: body.comment,
          amountMinor: Number(whole) * 100 + Number(fraction.padEnd(2, "0")),
        },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["transactions"] });
      void qc.invalidateQueries({ queryKey: ["statistics"] });
      toast.success(value ? "Операция обновлена" : "Операция добавлена");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const err = (name: keyof TransactionForm) => form.formState.errors[name];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {value ? "Редактировать операцию" : "Новая операция"}
          </DialogTitle>
          <DialogDescription>Все суммы учитываются в рублях.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((body) => save.mutate(body))}>
          <FieldGroup>
            <Field>
              <FieldLabel>Тип операции</FieldLabel>
              <ToggleGroup
                type="single"
                variant="outline"
                value={kind}
                onValueChange={(v) => {
                  if (v) {
                    form.setValue("kind", v as "income" | "expense");
                    form.setValue("categoryId", "");
                  }
                }}
              >
                <ToggleGroupItem value="expense">Расход</ToggleGroupItem>
                <ToggleGroupItem value="income">Доход</ToggleGroupItem>
              </ToggleGroup>
            </Field>
            <Field data-invalid={!!err("amount")}>
              <FieldLabel htmlFor="amount">Сумма, ₽</FieldLabel>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
                aria-invalid={!!err("amount")}
                {...form.register("amount")}
              />
              <FieldError>{err("amount")?.message}</FieldError>
            </Field>
            <Field data-invalid={!!err("categoryId")}>
              <FieldLabel htmlFor="categoryId">Категория</FieldLabel>
              <NativeSelect
                id="categoryId"
                aria-invalid={!!err("categoryId")}
                {...form.register("categoryId")}
              >
                <NativeSelectOption value="">
                  Выберите категорию
                </NativeSelectOption>
                {categories
                  .filter(
                    (c) =>
                      c.kind === kind &&
                      (!c.archived || c.id === value?.categoryId),
                  )
                  .map((c) => (
                    <NativeSelectOption key={c.id} value={c.id}>
                      {c.name}
                      {c.archived ? " (в архиве)" : ""}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <FieldError>
                {err("categoryId") ? "Выберите категорию" : null}
              </FieldError>
            </Field>
            <Field data-invalid={!!err("date")}>
              <FieldLabel htmlFor="date">Дата</FieldLabel>
              <Input
                id="date"
                type="date"
                aria-invalid={!!err("date")}
                {...form.register("date")}
              />
              <FieldError>{err("date")?.message}</FieldError>
            </Field>
            <Field data-invalid={!!err("comment")}>
              <FieldLabel htmlFor="comment">Комментарий</FieldLabel>
              <Textarea
                id="comment"
                placeholder="На что потратили или откуда пришли деньги"
                aria-invalid={!!err("comment")}
                {...form.register("comment")}
              />
              <FieldError>{err("comment")?.message}</FieldError>
            </Field>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && (
                <LoaderCircle
                  className="animate-spin"
                  data-icon="inline-start"
                />
              )}
              {save.isPending ? "Сохраняем…" : "Сохранить операцию"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function CategoryDialog({
  value,
  onClose,
}: {
  value: Category | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const form = useForm<CategoryInput>({
    resolver: zodResolver(categorySchema),
    defaultValues: value ?? {
      name: "",
      kind: "expense",
      color: "violet",
      icon: "other",
    },
  });
  const [serverError, setServerError] = useState("");
  const save = useMutation({
    mutationFn: (body: CategoryInput) => {
      const { kind, ...rest } = body;
      return api(
        value ? `/categories/${value.id}` : "/categories",
        value ? "PATCH" : "POST",
        value ? rest : { ...rest, kind },
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["categories"] });
      void qc.invalidateQueries({ queryKey: ["statistics"] });
      toast.success("Категория сохранена");
      onClose();
    },
    onError: (e) => setServerError(e.message),
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !save.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {value ? "Редактировать категорию" : "Новая категория"}
          </DialogTitle>
          <DialogDescription>
            Подберите название, цвет и значок.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => save.mutate(v))}>
          <FieldGroup>
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="category-name">Название</FieldLabel>
              <Input
                id="category-name"
                autoFocus
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="category-kind">Тип</FieldLabel>
              <NativeSelect
                id="category-kind"
                disabled={!!value}
                {...form.register("kind")}
              >
                <NativeSelectOption value="expense">Расход</NativeSelectOption>
                <NativeSelectOption value="income">Доход</NativeSelectOption>
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="category-color">Цвет</FieldLabel>
              <NativeSelect id="category-color" {...form.register("color")}>
                {Object.entries(colorNames).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            <Field>
              <FieldLabel htmlFor="category-icon">Значок</FieldLabel>
              <NativeSelect id="category-icon" {...form.register("icon")}>
                {Object.entries(iconNames).map(([k, v]) => (
                  <NativeSelectOption key={k} value={k}>
                    {v}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {serverError && <FieldError>{serverError}</FieldError>}
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Сохраняем…" : "Сохранить категорию"}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
