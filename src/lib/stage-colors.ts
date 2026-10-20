// Classes completas (o Tailwind não gera classes montadas dinamicamente).
const COLORS = {
  slate: { dot: "bg-slate-400", bar: "border-t-slate-400" },
  cyan: { dot: "bg-brand-cyan", bar: "border-t-brand-cyan" },
  blue: { dot: "bg-brand-blue", bar: "border-t-brand-blue" },
  sky: { dot: "bg-sky-400", bar: "border-t-sky-400" },
  amber: { dot: "bg-amber-400", bar: "border-t-amber-400" },
  violet: { dot: "bg-violet-400", bar: "border-t-violet-400" },
  orange: { dot: "bg-orange-400", bar: "border-t-orange-400" },
  emerald: { dot: "bg-emerald-400", bar: "border-t-emerald-400" },
  rose: { dot: "bg-rose-400", bar: "border-t-rose-400" },
  teal: { dot: "bg-teal-400", bar: "border-t-teal-400" },
  pink: { dot: "bg-pink-400", bar: "border-t-pink-400" },
} as const;

export function stageColor(color: string) {
  return COLORS[color as keyof typeof COLORS] ?? COLORS.slate;
}
