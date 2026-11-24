/**
 * 本地筛选的文本归一化：统一全角 / 兼容字符、去除重音与大小写差异，
 * 去掉标点与符号（撇号、连字符、点号等），并把连续空白压成单个空格。
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 宽松匹配：查询按空白拆成多个关键词，全部命中（顺序不限）才算匹配；
 * 空查询或只含标点的查询匹配全部。每个关键词在任一字段内命中即可。
 */
export function matchesSearchQuery(values: readonly string[], query: string): boolean {
  const terms = normalizeSearchText(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalizeSearchText(values.join(' '))
  return terms.every((term) => haystack.includes(term))
}
