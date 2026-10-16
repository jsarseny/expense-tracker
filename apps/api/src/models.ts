import mongoose, { Schema } from "mongoose";
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);
const categorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    kind: { type: String, enum: ["income", "expense"], required: true },
    color: { type: String, required: true },
    icon: { type: String, required: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);
categorySchema.index({ userId: 1, kind: 1 });
const transactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: ["income", "expense"], required: true },
    amountMinor: { type: Number, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    date: { type: String, required: true },
    comment: { type: String, default: "" },
  },
  { timestamps: true },
);
transactionSchema.index({ userId: 1, date: -1, _id: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
export const UserModel = mongoose.model("User", userSchema);
export const CategoryModel = mongoose.model("Category", categorySchema);
export const TransactionModel = mongoose.model(
  "Transaction",
  transactionSchema,
);
export const defaults = [
  { name: "Продукты", kind: "expense", color: "emerald", icon: "food" },
  { name: "Жильё", kind: "expense", color: "violet", icon: "home" },
  { name: "Транспорт", kind: "expense", color: "blue", icon: "car" },
  { name: "Покупки", kind: "expense", color: "rose", icon: "shopping" },
  { name: "Здоровье", kind: "expense", color: "cyan", icon: "heart" },
  { name: "Другое", kind: "expense", color: "amber", icon: "other" },
  { name: "Зарплата", kind: "income", color: "emerald", icon: "salary" },
  { name: "Подарки", kind: "income", color: "violet", icon: "gift" },
  { name: "Прочие доходы", kind: "income", color: "blue", icon: "other" },
];
export function categoryDto(c: any) {
  return {
    id: String(c._id),
    name: c.name,
    kind: c.kind,
    color: c.color,
    icon: c.icon,
    archived: c.archived,
  };
}
export function transactionDto(t: any) {
  return {
    id: String(t._id),
    kind: t.kind,
    amountMinor: t.amountMinor,
    categoryId: String(t.categoryId),
    date: t.date,
    comment: t.comment,
  };
}
