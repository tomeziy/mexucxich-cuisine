export function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function matchesSearch(text: string, query: string): boolean {
  if (!query) return true;
  const normalizedText = removeVietnameseTones(text);
  const normalizedQuery = removeVietnameseTones(query);
  return normalizedText.includes(normalizedQuery);
}
