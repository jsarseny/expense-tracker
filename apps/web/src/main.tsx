import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import {
  LayoutDashboard,
  ArrowLeftRight,
  Shapes,
  LogOut,
  ShieldCheck,
  Plus,
} from "lucide-react";
import type { User, Category, Transaction } from "@tracker/shared";
import { api, RequestError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Brand, Failure, Loading } from "@/components/common";
import { TransactionDialog } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dashboard } from "@/pages/dashboard";
import { Transactions } from "@/pages/transactions";
import { Categories } from "@/pages/categories";
import { Auth } from "@/pages/auth";
import "./index.css";
const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (n, e) => !(e instanceof RequestError && e.status < 500) && n < 1,
      staleTime: 15000,
    },
  },
});
// Module scope is intentional: StrictMode remounts must not count as new visits.
void api("/visits", "POST").catch(() => {});
function App() {
  const qc = useQueryClient();
  const user = useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      try {
        return await api<User>("/auth/me");
      } catch (e) {
        if (e instanceof RequestError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60000,
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api<Category[]>("/categories"),
    enabled: !!user.data,
  });
  const [edit, setEdit] = useState<Transaction | null | undefined>();
  useEffect(() => {
    const expired = () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "user" });
      qc.setQueryData(["user"], null);
      setEdit(undefined);
      toast.error("Сессия завершена. Войдите снова.");
    };
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, [qc]);
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", "POST"),
    onSuccess: () => {
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "user" });
      qc.setQueryData(["user"], null);
      setEdit(undefined);
    },
    onError: (e) => toast.error(e.message),
  });
  if (user.isPending)
    return (
      <div className="p-10 max-w-3xl mx-auto">
        <Loading />
      </div>
    );
  if (user.error)
    return (
      <div className="p-10">
        <Failure error={user.error} retry={user.refetch} />
      </div>
    );
  if (!user.data) return <Auth />;
  return (
    <div className="app-shell">
      <aside className="side">
        <Brand />
        <div>
          <p className="eyebrow px-3 mb-3 hidden md:block">Личный кабинет</p>
          <nav className="flex flex-col max-md:flex-row gap-1">
            {[
              { to: "/", label: "Обзор", icon: LayoutDashboard },
              { to: "/transactions", label: "Операции", icon: ArrowLeftRight },
              { to: "/categories", label: "Категории", icon: Shapes },
            ].map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  cn("nav-link", isActive && "active")
                }
              >
                <Icon />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="side-footer mt-auto flex flex-col gap-5">
          <div className="rounded-xl border border-border p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck size={17} />
              <span className="text-xs font-medium">Только ваши финансы</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Личный аккаунт, собственные категории и полная история.
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setEdit(null)}
              disabled={!cats.data}
            >
              <Plus data-icon="inline-start" />
              Новая операция
            </Button>
          </div>
          <Separator />
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs uppercase">
              {user.data.email.slice(0, 2)}
            </div>
            <span className="truncate flex-1 text-xs" title={user.data.email}>
              {user.data.email}
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Выйти"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut />
            </Button>
          </div>
        </div>
        <div className="md:hidden flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate">{user.data.email}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
          >
            <LogOut data-icon="inline-start" />
            Выйти
          </Button>
        </div>
      </aside>
      <main className="main-content">
        {cats.error ? (
          <Failure error={cats.error} retry={cats.refetch} />
        ) : !cats.data ? (
          <Loading />
        ) : (
          <Routes>
            <Route
              path="/"
              element={
                <Dashboard
                  categories={cats.data}
                  onNew={() => setEdit(null)}
                  onEdit={setEdit}
                />
              }
            />
            <Route
              path="/transactions"
              element={
                <Transactions
                  categories={cats.data}
                  onNew={() => setEdit(null)}
                  onEdit={setEdit}
                />
              }
            />
            <Route
              path="/categories"
              element={<Categories categories={cats.data} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>
      {edit !== undefined && cats.data && (
        <TransactionDialog
          value={edit}
          categories={cats.data}
          onClose={() => setEdit(undefined)}
        />
      )}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
      <Toaster
        containerAriaLabel="Уведомления"
        toastOptions={{ closeButtonAriaLabel: "Закрыть уведомление" }}
        theme="dark"
        richColors
        closeButton
        position="bottom-right"
      />
    </QueryClientProvider>
  </React.StrictMode>,
);
