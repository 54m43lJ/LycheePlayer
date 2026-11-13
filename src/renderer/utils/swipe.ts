/** 横向拖动开始判定与纵向手势仲裁共用的位移阈值。 */
export const SWIPE_START_THRESHOLD = 10

export type SwipeIntent = 'pending' | 'horizontal' | 'vertical'

/**
 * 根据从按下点开始的位移判定手势方向：
 * - 纵向先超过阈值且不弱于横向 → 本次手势交给纵向滚动 / 拖拽；
 * - 横向超过阈值且明确大于纵向 → 锁定横向，之后不再处理纵向位移；
 * - 两者都未超过阈值 → 继续等待。
 */
export function resolveSwipeIntent(
  dx: number,
  dy: number,
  threshold = SWIPE_START_THRESHOLD
): SwipeIntent {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (absY > threshold && absY >= absX) return 'vertical'
  if (absX > threshold && absX > absY) return 'horizontal'
  return 'pending'
}
