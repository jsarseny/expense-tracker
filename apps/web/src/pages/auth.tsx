import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ArrowUpRight, LoaderCircle } from "lucide-react";
import {
  credentialsSchema,
  type Credentials,
  type User,
} from "@tracker/shared";
import { api } from "@/lib/api";
import { Brand } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldGroup,
} from "@/components/ui/field";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
export function Auth() {
  const [register, setRegister] = useState(false);
  const qc = useQueryClient();
  const form = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: (v: Credentials) =>
      api<User>(register ? "/auth/register" : "/auth/login", "POST", v),
    onSuccess: (u) => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "user" });
      qc.setQueryData(["user"], u);
    },
  });
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="flex flex-col gap-8 mt-32">
          <h1>
            Больше ясности.
            <br />
            <span className="text-primary">
              Меньше лишних
              <br />
              расходов.
            </span>
          </h1>
          <p className="max-w-sm text-muted-foreground leading-relaxed">
            Соберите доходы и расходы в одном месте. Замечайте привычки и
            управляйте своим финансовым потоком.
          </p>
        </div>
      </section>
      <section className="auth-form">
        <div className="auth-card">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="eyebrow mb-4">Личные финансы</div>
          <h2 className="text-3xl font-semibold tracking-tight mb-3">
            {register ? "Начните свой поток" : "С возвращением"}
          </h2>
          <p className="text-muted-foreground mb-9">
            {register
              ? "Создайте аккаунт и добавьте первую операцию."
              : "Войдите, чтобы продолжить управлять финансами."}
          </p>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
            <FieldGroup>
              <Field data-invalid={!!form.formState.errors.email}>
                <FieldLabel htmlFor="email">Электронная почта</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.ru"
                  aria-invalid={!!form.formState.errors.email}
                  {...form.register("email")}
                />
                <FieldError>{form.formState.errors.email?.message}</FieldError>
              </Field>
              <Field data-invalid={!!form.formState.errors.password}>
                <FieldLabel htmlFor="password">Пароль</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="Не менее 8 символов"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register("password")}
                />
                <FieldError>
                  {form.formState.errors.password?.message}
                </FieldError>
              </Field>
              {mutation.error && (
                <Alert variant="destructive">
                  <AlertTitle>Проверьте данные</AlertTitle>
                  <AlertDescription>{mutation.error.message}</AlertDescription>
                </Alert>
              )}
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <LoaderCircle
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <ArrowUpRight data-icon="inline-end" />
                )}
                {mutation.isPending
                  ? "Подождите…"
                  : register
                    ? "Создать аккаунт"
                    : "Войти"}
              </Button>
            </FieldGroup>
          </form>
          <p className="text-sm text-muted-foreground text-center mt-7">
            {register ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"}{" "}
            <button
              className="text-primary hover:underline"
              onClick={() => {
                setRegister(!register);
                mutation.reset();
                form.clearErrors();
              }}
            >
              {register ? "Войти" : "Зарегистрироваться"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
