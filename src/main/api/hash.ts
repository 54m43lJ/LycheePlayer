/** QQ 系接口通用的 hash33 算法（g_tk 等令牌）。 */
export function hash33(input: string, seed = 0): number {
  let hash = seed
  for (const char of input) {
    hash = (hash << 5) + hash + char.codePointAt(0)!
  }
  return 2147483647 & hash
}
