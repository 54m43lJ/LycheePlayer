export const PAGE_JUMP_THRESHOLD = 120

/** 按滚动位置判断是否显示顶部 / 底部跳转按钮。 */
export function jumpVisibility(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  threshold = PAGE_JUMP_THRESHOLD
): { top: boolean; bottom: boolean } {
  return {
    top: scrollTop > threshold,
    bottom: scrollTop + clientHeight < scrollHeight - threshold
  }
}
