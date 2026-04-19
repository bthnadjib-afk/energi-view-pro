import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
