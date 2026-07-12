import type { CustomerData } from '../_data/types';

export const BANNED_WORDS = [
  '完全',
  '完璧',
  '絶対',
  '日本一',
  '抜群',
  '特選',
  '厳選',
  '最高',
  '最高級',
  '格安',
  '破格',
  '激安',
  'バーゲンセール',
  '完売',
  '大人気',
  '残りわずか',
] as const;

export function assertNoBannedWords(value: string | string[] | undefined, context: string): void {
  if (value === undefined) {
    return;
  }

  const values = Array.isArray(value) ? value : [value];

  for (const text of values) {
    for (const word of BANNED_WORDS) {
      if (text.includes(word)) {
        throw new Error(`[禁止用語検出] ${context}に禁止用語「${word}」が含まれています: "${text}"`);
      }
    }
  }
}

export function validateCustomerData(customer: CustomerData): void {
  assertNoBannedWords(customer.company, `${customer.slug}: company`);
  assertNoBannedWords(customer.catchCopy, `${customer.slug}: catchCopy`);
  assertNoBannedWords(customer.companyDescription, `${customer.slug}: companyDescription`);

  customer.properties.forEach((property) => {
    assertNoBannedWords(property.title, `${customer.slug}/${property.id}: title`);
    assertNoBannedWords(property.description, `${customer.slug}/${property.id}: description`);
    assertNoBannedWords(property.tags, `${customer.slug}/${property.id}: tags`);
  });
}
