import {
  ShoppingBag,
  House,
  Car,
  Utensils,
  Heart,
  Gift,
  Briefcase,
  Shapes,
  Inbox,
  RefreshCw,
} from "lucide-react";
import type { Category } from "@tracker/shared";
import type { CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
export const icons = {
  shopping: ShoppingBag,
  home: House,
  car: Car,
  food: Utensils,
  heart: Heart,
  gift: Gift,
  salary: Briefcase,
  other: Shapes,
};
export const iconNames = {
  shopping: "Покупки",
  home: "Дом",
  car: "Транспорт",
  food: "Еда",
  heart: "Здоровье",
  gift: "Подарок",
  salary: "Работа",
  other: "Другое",
};
export const colorNames = {
  violet: "Фиолетовый",
  emerald: "Зелёный",
  amber: "Жёлтый",
  rose: "Розовый",
  blue: "Синий",
  cyan: "Голубой",
};
export function Brand() {
  return (
    <div className="brand">
      поток<span className="text-primary">.</span>
    </div>
  );
}
export function CategoryIcon({
  category,
}: {
  category?: Pick<Category, "icon" | "color">;
}) {
  const Icon = icons[category?.icon ?? "other"];
  return (
    <div
      className="category-icon"
      style={
        {
          "--category-color": `var(--category-${category?.color ?? "violet"})`,
        } as CSSProperties
      }
    >
      <Icon />
    </div>
  );
}
export function Blank({
  title = "Пока ничего нет",
  description = "Добавьте первую операцию — и здесь появится ваша финансовая история.",
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Inbox />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {children}
    </Empty>
  );
}
export function Failure({
  error,
  retry,
}: {
  error: Error;
  retry?: () => unknown;
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Не удалось загрузить данные</AlertTitle>
      <AlertDescription>
        {error.message}
        {retry && (
          <Button size="sm" variant="outline" onClick={() => retry()}>
            <RefreshCw data-icon="inline-start" />
            Повторить
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
export function Loading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Загрузка">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
