import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string): string {
  const hasPlus = value.trimStart().startsWith('+');
  const digits = value.replace(/\D/g, '');
  if (hasPlus) {
    // International (+41, +33…): max 15 digits (E.164), groupes de 2
    const d = digits.slice(0, 15);
    return '+' + d.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
  }
  // Numéro français : max 10 chiffres, groupes de 2
  return digits.slice(0, 10).replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
