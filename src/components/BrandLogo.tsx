import Image from "next/image";

/** Logo Lensi (PNG com fundo transparente, feita para fundos escuros). */
export function BrandLogo({ className = "h-7 w-auto" }: { className?: string }) {
  return (
    <Image src="/brand/lensi-logo.png" alt="Lensi" width={970} height={376} priority className={className} />
  );
}
