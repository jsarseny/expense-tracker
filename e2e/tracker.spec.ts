import { test, expect, type Page } from "@playwright/test";
async function signup(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Зарегистрироваться", exact: true })
    .click();
  await page
    .getByLabel("Электронная почта")
    .fill(
      `browser-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.ru`,
    );
  await page.getByLabel("Пароль", { exact: true }).fill("test-password123");
  await page
    .getByRole("button", { name: "Создать аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Обзор финансов" }),
  ).toBeVisible();
}
async function add(
  page: Page,
  {
    kind = "expense",
    amount,
    category,
    comment,
  }: { kind?: string; amount: string; category: string; comment: string },
) {
  await page
    .getByRole("button", { name: "Добавить операцию", exact: true })
    .click();
  if (kind === "income")
    await page.getByRole("radio", { name: "Доход", exact: true }).click();
  await page.getByLabel("Сумма, ₽").fill(amount);
  await page
    .getByLabel("Категория", { exact: true })
    .selectOption({ label: category });
  await page.getByLabel("Комментарий", { exact: true }).fill(comment);
  await page
    .getByRole("button", { name: "Сохранить операцию", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
test("полный цикл: категория, доход, расход, редактирование, удаление и повторный вход", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signup(page);
  const email = await page
    .locator(".side-footer span[title]")
    .getAttribute("title");
  await page.getByRole("link", { name: "Категории", exact: true }).click();
  await page
    .getByRole("button", { name: "Новая категория", exact: true })
    .click();
  await page.getByLabel("Название", { exact: true }).fill("Кофейни");
  await page.getByLabel("Цвет", { exact: true }).selectOption("amber");
  await page.getByLabel("Значок", { exact: true }).selectOption("food");
  await page
    .getByRole("button", { name: "Сохранить категорию", exact: true })
    .click();
  await expect(page.getByText("Кофейни", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Обзор", exact: true }).click();
  await add(page, {
    kind: "income",
    amount: "10000",
    category: "Зарплата",
    comment: "Оплата проекта",
  });
  await add(page, {
    amount: "1250,50",
    category: "Кофейни",
    comment: "Встреча за кофе",
  });
  await expect(page.getByTestId("balance")).toContainText("8 749,50");
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });
  await page.getByRole("link", { name: "Операции", exact: true }).click();
  await page
    .getByRole("button", { name: "Редактировать Встреча за кофе", exact: true })
    .click();
  await page.getByLabel("Сумма, ₽").fill("1000");
  await page
    .getByRole("button", { name: "Сохранить операцию", exact: true })
    .click();
  await page.getByLabel("Поиск", { exact: true }).fill("Встреча");
  await expect(page.getByText("Оплата проекта", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Удалить Встреча за кофе", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Удалить операцию", exact: true })
    .click();
  await expect(page.getByText("Встреча за кофе", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  await page.getByRole("link", { name: "Категории", exact: true }).click();
  await page
    .getByRole("button", { name: "Архивировать Кофейни", exact: true })
    .click();
  await page.getByRole("radio", { name: "Архив", exact: true }).click();
  await expect(page.getByText("Кофейни", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Восстановить Кофейни", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Выйти", exact: true })
    .first()
    .click();
  await page.getByLabel("Электронная почта").fill(email!);
  await page.getByLabel("Пароль", { exact: true }).fill("test-password123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await page.getByRole("link", { name: "Обзор", exact: true }).click();
  await expect(page.getByTestId("balance")).toContainText("10 000");
  await page.reload();
  await expect(page.getByTestId("balance")).toContainText("10 000");
  expect(errors).toEqual([]);
});
test("мобильная версия, темная тема и русские ошибки формы", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Электронная почта").fill("valid@example.ru");
  await page.getByLabel("Пароль", { exact: true }).fill("123");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByText("Минимум 8 символов", { exact: true }),
  ).toBeVisible();
  await signup(page);
  await expect(page.locator("html")).toHaveAttribute("class", "dark");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Добавить операцию", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("посещения считаются на загрузку, переходы не создают посещение", async ({
  page,
}) => {
  let visits = 0;
  await page.route("**/api/visits", async (route) => {
    visits++;
    await route.continue();
  });
  await signup(page);
  expect(visits).toBe(1);
  await page.getByRole("link", { name: "Операции", exact: true }).click();
  await page.getByRole("link", { name: "Категории", exact: true }).click();
  expect(visits).toBe(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Категории", exact: true }),
  ).toBeVisible();
  expect(visits).toBe(2);
});
