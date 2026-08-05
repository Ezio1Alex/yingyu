-- ===== 词库 =====
CREATE TABLE IF NOT EXISTS words (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  word        TEXT NOT NULL,
  phonetic    TEXT,
  uk_phonetic TEXT,
  us_phonetic TEXT,
  definition  TEXT NOT NULL,
  pos         TEXT,
  example_en  TEXT,
  example_cn  TEXT,
  bank_id     INTEGER NOT NULL DEFAULT 2,  -- 1=中考, 2=高考
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_words_bank ON words(bank_id);

-- ===== 词库静态信息（每词库 1 行，存导入时的总词数）=====
-- 让聚合统计免于反复 COUNT 整个 words 表（免费额度读取大头）
CREATE TABLE IF NOT EXISTS banks (
  id          INTEGER PRIMARY KEY,   -- 1=中考, 2=高考
  name        TEXT NOT NULL DEFAULT '',
  total_words INTEGER NOT NULL DEFAULT 0
);

-- ===== 用户 =====
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  grade         TEXT DEFAULT '高中',
  bank_id       INTEGER DEFAULT 2,
  words_per_day INTEGER DEFAULT 20,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ===== 学习记录（替代 progress）=====
-- stage: 'learning' 刚学完 / 'reviewing' 稳定复习 / 'known' 已掌握(reps>=5)
CREATE TABLE IF NOT EXISTS word_learning (
  user_id     TEXT NOT NULL,
  word_id     INTEGER NOT NULL,
  stage       TEXT NOT NULL DEFAULT 'learning',
  next_review TEXT,               -- YYYY-MM-DD，到期待复习
  ease        REAL DEFAULT 2.5,   -- SM2 参数（内部保留）
  gap         INTEGER DEFAULT 1,  -- 间隔天数（原名 interval）
  reps        INTEGER DEFAULT 0,  -- 成功回忆次数
  started_at  TEXT DEFAULT (datetime('now')),
  reviewed_at TEXT,               -- 最近复习时间
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_wl_review ON word_learning(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_wl_stage  ON word_learning(user_id, stage);

-- ===== 复习日志（替代 reviews + streaks）=====
-- type: 'learning' 新学 / 'recall' 回忆 / 'spelling' 拼写强化
-- 每日统计/连续打卡/日历均从此表聚合，无需单独 streaks 表
CREATE TABLE IF NOT EXISTS review_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  word_id     INTEGER NOT NULL,
  stage       TEXT NOT NULL,      -- 做题时的阶段快照
  type        TEXT NOT NULL DEFAULT 'recall',
  score       INTEGER NOT NULL,   -- SM2 0-5
  correct     INTEGER NOT NULL,   -- score >= 3
  reviewed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rl_user_date ON review_log(user_id, date(reviewed_at));
CREATE INDEX IF NOT EXISTS idx_rl_word      ON review_log(user_id, word_id);

-- ===== 收藏 =====
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id    TEXT NOT NULL,
  word_id    INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, word_id)
);

-- ===== 家长抽查 =====
CREATE TABLE IF NOT EXISTS spot_checks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  total_words INTEGER DEFAULT 20,
  correct     INTEGER DEFAULT 0,
  note        TEXT,
  client_id   TEXT,                -- 前端抽查会话唯一标识（幂等去重）
  checked_at  TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sc_client ON spot_checks(client_id);

CREATE TABLE IF NOT EXISTS spot_check_items (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  check_id  INTEGER NOT NULL,
  word_id   INTEGER NOT NULL,
  category  TEXT,
  result    INTEGER NOT NULL,
  FOREIGN KEY (check_id) REFERENCES spot_checks(id)
);
