import {
  Plane, UtensilsCrossed, Martini, ShoppingCart, Bus, Clapperboard, Shirt,
  HeartPulse, Gift, Zap, House, Dumbbell, Pill, ShieldCheck, Tag, Wallet,
  Repeat, type LucideIcon,
} from 'lucide-react';

/** Nur diese Icons werden gebuendelt. Ein dynamischer Import nach Namen
 *  wuerde die komplette lucide-Bibliothek ins Bundle ziehen - bei einer
 *  App, die offline komplett vorgeladen wird, waeren das ~600 kB fuer
 *  vierzehn Symbole. */
const ICONS: Record<string, LucideIcon> = {
  Plane, UtensilsCrossed, Martini, ShoppingCart, Bus, Clapperboard, Shirt,
  HeartPulse, Gift, Zap, House, Dumbbell, Pill, ShieldCheck, Tag, Wallet, Repeat,
};

export const ICON_CHOICES = Object.keys(ICONS);

export function CategoryIcon({
  name,
  size = 18,
  strokeWidth = 1.75,
}: {
  name: string;
  size?: number | undefined;
  strokeWidth?: number | undefined;
}) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden />;
}
