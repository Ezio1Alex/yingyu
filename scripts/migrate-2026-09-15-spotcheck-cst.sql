-- 一次性迁移：spot_checks.checked_at 由 UTC 统一为东八区（2026-09-15）
--
-- 背景
--   这一列历史上靠 schema 默认的 datetime('now')（UTC）写入，查询时再 datetime(checked_at,'+8 hours')
--   转回东八区；而 review_log.reviewed_at / word_learning.started_at 等列一直存东八区。
--   同一个库里两套时区约定混用，改查询时漏掉一次转换就会差 8 小时（实测踩过）。
--   现统一为东八区，代码里改为显式写入 nowCN()，查询不再做转换。
--
-- 为什么用 id 上界
--   部署新代码（写东八区）与本迁移之间有几分钟窗口。若窗口内有新的抽查写入，那条已经是东八区，
--   再 +8 小时就永远错了。用「迁移时刻的 MAX(id)」精确圈定历史行，新行 id 更大自然被排除。
--   本文件生成时线上 MAX(id) = 67。
--
-- 幂等
--   UPDATE 以 schema_migrations 里的标记为前置条件，重复执行不会二次 +8 小时。
--   ⚠️ 顺序必须是 UPDATE 在前、INSERT 在后。
--
-- 执行
--   npx wrangler d1 execute vocab-db --remote --file=scripts/migrate-2026-09-15-spotcheck-cst.sql

-- 自包含：不依赖 schema.sql 已经跑过
CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

UPDATE spot_checks
SET checked_at = datetime(checked_at, '+8 hours')
WHERE id <= 67
  AND (SELECT COUNT(*) FROM schema_migrations WHERE id = '2026-09-15-spotcheck-cst') = 0;

INSERT OR IGNORE INTO schema_migrations (id, applied_at)
VALUES ('2026-09-15-spotcheck-cst', datetime('now', '+8 hours'));
