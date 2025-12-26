export function normalizeUSPhoneToE164(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  const hasPlus = raw.startsWith("+");
  const digitsOnly = raw.replace(/[^\d]/g, "");

  if (hasPlus) {
    const e164 = "+" + digitsOnly;
    if (/^\+[1-9]\d{7,14}$/.test(e164)) return e164;
    return null;
  }

  if (digitsOnly.length === 10) return "+1" + digitsOnly;
  if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) return "+" + digitsOnly;

  return null;
}

export function formatUSPretty(input: string): string {
  const digits = input.replace(/[^\d]/g, "");
  const d = digits.startsWith("1") && digits.length > 10 ? digits.slice(1) : digits;

  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
}
