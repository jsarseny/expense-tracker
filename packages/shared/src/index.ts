import { z } from "zod";
z.config(z.locales.ru());
export const kinds = ["income", "expense"] as const;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Укажите дату")
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !isNaN(+d) && d.toISOString().slice(0, 10) === v;
  }, "Некорректная дата");
export const idSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Некорректный идентификатор");
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email("Укажите корректный email")),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .max(128, "Максимум 128 символов"),
});
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(50),
  kind: z.enum(kinds),
  color: z.enum(["violet", "emerald", "amber", "rose", "blue", "cyan"]),
  icon: z.enum([
    "shopping",
    "home",
    "car",
    "food",
    "heart",
    "gift",
    "salary",
    "other",
  ]),
});
export const transactionSchema = z.object({
  kind: z.enum(kinds),
  amountMinor: z
    .number()
    .int()
    .positive("Сумма должна быть больше нуля")
    .max(100_000_000_000),
  categoryId: idSchema,
  date: dateSchema,
  comment: z.string().trim().max(500).default(""),
});
export const filterSchema = z
  .object({
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    kind: z.enum(kinds).optional(),
    categoryId: idSchema.optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(100000).default(1),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Начало периода должно быть не позже окончания",
  );
export const statisticsSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    group: z.enum(["day", "month"]).default("day"),
  })
  .refine(
    (v) => v.from <= v.to,
    "Начало периода должно быть не позже окончания",
  )
  .refine(
    (v) =>
      new Date(v.to).getTime() - new Date(v.from).getTime() <= 3660 * 86400000,
    "Максимальный период — 10 лет",
  );
export type Credentials = z.infer<typeof credentialsSchema>;
export type TransactionInput = z.infer<typeof transactionSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type Category = CategoryInput & { id: string; archived: boolean };
export type Transaction = TransactionInput & { id: string };
export type User = { id: string; email: string };
export type ApiError = {
  error: { code: string; message: string; fields?: Record<string, string[]> };
};
export type TransactionPage = {
  items: Transaction[];
  total: number;
  page: number;
  pageSize: number;
};
export type Statistics = {
  balance: number;
  income: number;
  expense: number;
  difference: number;
  series: { date: string; income: number; expense: number }[];
  categories: {
    id: string;
    name: string;
    color: Category["color"];
    amount: number;
  }[];
};
