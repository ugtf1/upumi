export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '').replace(/^\+/, '');
}

export function phoneLookupCandidates(phone: string) {
  const digits = normalizePhone(phone);
  const candidates = new Set<string>([digits, `+${digits}`]);

  if (digits.startsWith('0') && digits.length === 11) {
    const ng = `234${digits.slice(1)}`;
    candidates.add(ng);
    candidates.add(`+${ng}`);
  }

  if (digits.startsWith('234') && digits.length === 13) {
    candidates.add(`0${digits.slice(3)}`);
  }

  return Array.from(candidates).filter(Boolean);
}

export function toSmsPhone(phone: string) {
  const digits = normalizePhone(phone);
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+234${digits.slice(1)}`;
  if (phone.trim().startsWith('+')) return phone.trim();
  return `+${digits}`;
}
