export function sm2(score, ease, gap, reps) {
  if (score >= 3) {
    if (reps === 0) gap = 1
    else if (reps === 1) gap = 6
    else gap = Math.round(gap * ease)
    reps += 1
  } else {
    reps = 0
    gap = 1
  }
  ease = ease + (0.1 - (5 - score) * (0.08 + (5 - score) * 0.02))
  ease = Math.max(1.3, ease)
  // 学习阶段：成功回忆 0 次=learning，1-3 次=reviewing，>=4 次=known
  const stage = reps >= 4 ? 'known' : (reps >= 1 ? 'reviewing' : 'learning')
  return { ease, gap, reps, stage }
}
export function calcNextReview(today, gap) {
  const d = new Date(today)
  d.setDate(d.getDate() + gap)
  return d.toISOString().split('T')[0]
}
