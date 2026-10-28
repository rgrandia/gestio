import { Building2, CalendarOff, House, Plane, TreePalm } from "lucide-react";
import type { TipusDia } from "@/lib/calendari";

const ICONES = { oficina: Building2, teletreball: House, fora: Plane, vacances: TreePalm, festiu: CalendarOff };

export function IconaDia({ tipus, className = "icona-petita" }: { tipus: TipusDia; className?: string }) {
  const I = ICONES[tipus];
  return <I className={className} aria-hidden />;
}
