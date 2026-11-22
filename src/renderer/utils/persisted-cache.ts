/**
 * 读取 localStorage 中的结构化缓存。
 * 结构与应用当前模型不符、JSON 解析失败时，删除该 key 并返回 null；
 * 调用方按“缓存不存在”重新获取或从空状态开始。
 */
export function readPersistedJson<T>(
  key: string,
  validate: (value: unknown) => value is T
): T | null {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return null
    const parsed: unknown = JSON.parse(text)
    if (validate(parsed)) return parsed
    localStorage.removeItem(key)
    return null
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // localStorage 不可用时只保留当前会话。
    }
    return null
  }
}
