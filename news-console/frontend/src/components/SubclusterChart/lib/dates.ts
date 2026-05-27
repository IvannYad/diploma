export function normalizeDate(raw: string): string {
  if (!raw) return '';
  const m1 = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return raw;
}

const UA_MONTHS: Record<string, string> = {
  'січень': '01', 'лютий': '02', 'березень': '03', 'квітень': '04',
  'травень': '05', 'червень': '06', 'липень': '07', 'серпень': '08',
  'вересень': '09', 'жовтень': '10', 'листопад': '11', 'грудень': '12',
  'січня': '01', 'лютого': '02', 'березня': '03', 'квітня': '04',
  'травня': '05', 'червня': '06', 'липня': '07', 'серпня': '08',
  'вересня': '09', 'жовтня': '10', 'листопада': '11', 'грудня': '12',
  'січ': '01', 'лют': '02', 'бер': '03', 'кві': '04',
  'тра': '05', 'чер': '06', 'лип': '07', 'сер': '08',
  'вер': '09', 'жов': '10', 'лис': '11', 'гру': '12',
};

const EN_MONTHS: Record<string, string> = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12',
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09',
  'oct': '10', 'nov': '11', 'dec': '12',
};

/** When the value has no year, use fallbackYear (article publication year). */
export function normalizeTemporalValue(raw: string, fallbackYear: string): string {
  if (!raw) return '';
  const s = raw.trim();

  const mFull = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (mFull) return `${mFull[3]}-${mFull[2].padStart(2, '0')}-${mFull[1].padStart(2, '0')}`;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const mSlash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mSlash) return `${mSlash[3]}-${mSlash[2].padStart(2, '0')}-${mSlash[1].padStart(2, '0')}`;

  const mMmYyyy = s.match(/^(\d{1,2})\.(\d{4})$/);
  if (mMmYyyy) return `${mMmYyyy[2]}-${mMmYyyy[1].padStart(2, '0')}-01`;

  const mYyyyMm = s.match(/^(\d{4})-(\d{1,2})$/);
  if (mYyyyMm) return `${mYyyyMm[1]}-${mYyyyMm[2].padStart(2, '0')}-01`;

  const mMmSlashYyyy = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (mMmSlashYyyy) return `${mMmSlashYyyy[2]}-${mMmSlashYyyy[1].padStart(2, '0')}-01`;

  const lower = s.toLowerCase();

  for (const [name, mm] of Object.entries(UA_MONTHS)) {
    if (lower.includes(name)) {
      const yearMatch = s.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : fallbackYear;
      // Day digits must not be taken from the year substring.
      const dayMatch = s.replace(/\d{4}/g, '').match(/\b(\d{1,2})\b/);
      const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
      return `${year}-${mm}-${day}`;
    }
  }

  for (const [name, mm] of Object.entries(EN_MONTHS)) {
    if (lower.includes(name)) {
      const yearMatch = s.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : fallbackYear;
      const dayMatch = s.replace(/\d{4}/g, '').match(/\b(\d{1,2})\b/);
      const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
      return `${year}-${mm}-${day}`;
    }
  }

  const qLatin = s.match(/[Qq](\d)\s*(\d{4})?/);
  if (qLatin) {
    const q = parseInt(qLatin[1]);
    const year = qLatin[2] ?? fallbackYear;
    return `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
  }
  const qCyrillic = s.match(/(\d)\s*(?:квартал|кв\.?)/i);
  if (qCyrillic) {
    const q = parseInt(qCyrillic[1]);
    const yearMatch = s.match(/\d{4}/);
    const year = yearMatch ? yearMatch[0] : fallbackYear;
    return `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
  }

  const mYear = s.match(/^(\d{4})$/);
  if (mYear) return `${mYear[1]}-01-01`;

  const mMonthOnly = s.match(/^(\d{1,2})$/);
  if (mMonthOnly) {
    const m = parseInt(mMonthOnly[1]);
    if (m >= 1 && m <= 12) return `${fallbackYear}-${String(m).padStart(2, '0')}-01`;
  }

  // DD.MM without year is day.month in Ukrainian tables, not month.day.
  const mDayMonth = s.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (mDayMonth) {
    return `${fallbackYear}-${mDayMonth[2].padStart(2, '0')}-${mDayMonth[1].padStart(2, '0')}`;
  }

  return '';
}

export function formatDate(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return iso;
}
