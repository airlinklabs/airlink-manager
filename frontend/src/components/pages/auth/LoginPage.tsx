import { FormEvent, useState } from "react";
import { Server } from "lucide-react";
import { useLogin } from "../../../api/auth.ts";
import { Button } from "../../ui/Button.tsx";
import { Input } from "../../ui/Input.tsx";

export function LoginPage() {
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ username, password });
  };

  return (
    <main className="grid min-h-screen bg-[var(--theme-bg)] md:grid-cols-[1fr_26rem]">
      <section className="hidden items-end bg-[var(--theme-bg-secondary)] p-10 md:flex">
        <div>
          <Server className="mb-4 h-10 w-10 text-[var(--theme-accent)]" />
          <h1 className="text-2xl font-semibold text-[var(--theme-text-primary)]">Airlink Panel</h1>
          <p className="mt-2 max-w-md text-sm text-[var(--theme-text-body)]">Secure local control for Linux servers.</p>
        </div>
      </section>
      <section className="flex items-center justify-center p-4">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-bg-card)] p-6 shadow-[var(--shadow-float)]">
          <div className="mb-5 flex items-center gap-2 md:hidden">
            <Server className="h-5 w-5 text-[var(--theme-accent)]" />
            <h1 className="font-semibold">Airlink Panel</h1>
          </div>
          <div className="space-y-3">
            <label className="block space-y-1 text-sm">Username<Input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" /></label>
            <label className="block space-y-1 text-sm">Password<Input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" /></label>
          </div>
          {login.error ? <p className="mt-3 text-sm text-[var(--theme-danger)]">{login.error.message}</p> : null}
          <Button className="mt-5 w-full" disabled={login.isPending}>Log In</Button>
        </form>
      </section>
    </main>
  );
}
