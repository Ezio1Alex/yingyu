-- ============================================================
-- 迁移到 v2 记忆表（word_learning + review_log）
-- 用法: npx wrangler d1 execute vocab-db --remote --file=scripts/migrate-v2.sql
-- 旧表 progress/reviews/streaks 数据迁移后即删除
-- 注意: streaks 的每日统计完全可由 reviews 推导，故直接删除无数据损失
-- ============================================================

-- 1. 建新表（幂等）
CREATE TABLE IF NOT EXISTS word_learning (
  user_id     TEXT NOT NULL,
  word_id     INTEGER NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'learning',
  next_review TEXT,
  ease        REAL DEFAULT 2.5,
  gap         INTEGER DEFAULT 1,
  reps        INTEGER DEFAULT 0,
  started_at  TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_wl_review ON word_learning(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_wl_stage  ON word_learning(user_id, stage);

CREATE TABLE IF NOT EXISTS review_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  word_id     INTEGER NOT NULL,
  stage       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'recall',
  score       INTEGER NOT NULL,
  correct     INTEGER NOT NULL,
  reviewed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rl_user_date ON review_log(user_id, date(reviewed_at));
CREATE INDEX IF NOT EXISTS idx_rl_word      ON review_log(user_id, word_id);

-- 2. 迁移 progress → word_learning
INSERT OR IGNORE INTO word_learning
  (user_id, word_id, stage, next_review, ease, gap, reps, started_at, reviewed_at)
SELECT
  user_id, word_id,
  CASE WHEN mastered = 1 THEN 'known'
       WHEN today_new = 1 THEN 'learning'
       ELSE 'reviewing' END,
  next_review, ease, interval, reps, created_at, updated_at
FROM progress;

-- 3. 迁移 reviews → review_log
--    quiz_type 映射: new_learning→learning, typing→spelling, recall→recall
--    stage 快照: 新学=learning, 其余=reviewing
INSERT INTO review_log (user_id, word_id, stage, type, score, correct, reviewed_at)
SELECT
  user_id, word_id,
  CASE WHEN quiz_type = 'new_learning' THEN 'learning' ELSE 'reviewing' END,
  CASE WHEN quiz_type = 'new_learning' THEN 'learning'
       WHEN quiz_type = 'typing' THEN 'spelling'
       ELSE 'recall' END,
  score, CASE WHEN score >= 3 THEN 1 ELSE 0 END, reviewed_at
FROM reviews;

-- 4. 删除旧表（数据已迁移，streaks 可由 review_log 推导）
DROP TABLE IF EXISTS progress;
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS streaks;
