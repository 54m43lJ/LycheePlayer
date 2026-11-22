/** 缓存目录与文件名共用的账号作用域；未知字符替换为下划线，空值回退 anonymous。 */
export function safeCacheScope(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '_') || 'anonymous'
}
