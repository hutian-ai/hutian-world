import { Image } from "@/lib/navigation";
import { Terminal } from "lucide-react";
import { cn } from "@hutian-ai/design/lib/utils";

export function RuntimeLogo({
  driverKey,
  className,
}: {
  driverKey: string;
  className?: string;
}) {
  const normalized = driverKey.toLowerCase();
  const src = normalized.startsWith("codex")
    ? "/runtime-logos/openai.svg"
    : normalized === "deepseek-harness" || normalized === "dsh"
      ? "/runtime-logos/deepseek.svg"
      : null;

  if (!src) {
    return <Terminal className={cn("size-4", className)} aria-hidden="true" />;
  }

  return (
    <Image
      src={src}
      width={28}
      height={28}
      alt=""
      aria-hidden="true"
      className={cn("size-5 object-contain", className)}
    />
  );
}
