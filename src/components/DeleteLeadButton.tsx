"use client";

import { deleteLead } from "@/lib/actions";

export function DeleteLeadButton({ id }: { id: string }) {
  return (
    <form
      action={deleteLead}
      onSubmit={(event) => {
        if (!confirm("Excluir este lead e todo o histórico? Não dá para desfazer.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-rose-400 hover:text-rose-300">
        Excluir lead
      </button>
    </form>
  );
}
