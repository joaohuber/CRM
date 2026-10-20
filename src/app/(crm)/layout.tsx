import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { NavLinks } from "@/components/NavLinks";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-ink/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/kanban" className="flex items-center gap-2.5" aria-label="Lensi CRM, ir para o funil">
            <BrandLogo className="h-6 w-auto" />
            <span className="rounded-md border border-line-strong px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              CRM
            </span>
          </Link>
          <NavLinks />
          <div className="ml-auto flex items-center gap-3">
            <Link href="/leads/novo" className="btn-primary">
              + Novo lead
            </Link>
            <span className="hidden text-xs text-faint md:inline">{user?.email}</span>
            <form action={signOut}>
              <button type="submit" className="text-sm text-muted hover:text-fg">
                Sair
              </button>
            </form>
          </div>
        </div>
        {/* Filete com o degradê da marca */}
        <div className="h-px bg-linear-to-r from-transparent via-brand-sky/60 to-transparent" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
