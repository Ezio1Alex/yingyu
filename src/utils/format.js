/**
 * 取随机布尔值（按概率）
 */
export function chance(p) {
  return Math.random() < p
}
