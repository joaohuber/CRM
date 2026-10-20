"use client";

import { useActionState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { signIn, type FormState } from "@/lib/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, { error: null });

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink bg-[radial-gradient(ellipse_at_top,rgba(0,89,255,0.18),transparent_60%)] p-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo className="h-12 w-auto" />
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">CRM de vendas</p>
        </div>
        <form action={action} className="card space-y-4 p-6">
          <div>
            <label className="label" htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Senha</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
          {state.error && <p className="text-sm text-rose-400">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}
