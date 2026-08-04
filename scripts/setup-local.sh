#!/bin/bash
# 本地开发环境一键初始化
# 需先下载词库并转换（查看 README 词库章节）
# 或直接使用以下命令转换已下载的数据：
#   python3 scripts/convert_vocab.py --xlsx data/中考大纲词汇.xlsx --bank 1 --youdao data/ChuZhong_2.json --output data/zhongkao.sql
#   python3 scripts/convert_vocab.py --xlsx data/高考大纲词汇表.xlsx --bank 2 --youdao data/GaoZhong_2.json --output data/gaokao.sql
set -e

echo "📦 安装依赖..."
npm install

echo "🗄️  初始化本地 D1 数据库（创建表结构）..."
npx wrangler d1 execute vocab-db --local --file=functions/_db/schema.sql

if [ -f data/zhongkao.sql ] && [ -f data/gaokao.sql ]; then
  echo "📚 导入中考词库（$(wc -l < data/zhongkao.sql) 条）..."
  npx wrangler d1 execute vocab-db --local --file=data/zhongkao.sql
  echo "📚 导入高考词库（$(wc -l < data/gaokao.sql) 条）..."
  npx wrangler d1 execute vocab-db --local --file=data/gaokao.sql
else
  echo "🌱 使用 30 个测试示例词汇..."
  node scripts/seed-local.js > scripts/seed-local.sql
  npx wrangler d1 execute vocab-db --local --file=scripts/seed-local.sql
  echo ""
  echo "⚠️  只导入了 30 个测试词汇。"
  echo "   完整词库需下载并转换，详见 README 词库章节。"
fi

echo "✅ 本地开发环境就绪！"
echo ""
echo "启动方式（需两个终端）："
echo "  终端 1: npm run dev              # 前端 → http://localhost:5173"
echo "  终端 2: npm run dev:api          # 后端 → http://localhost:8788"
echo ""
echo "前端已配置 proxy，浏览器访问 http://localhost:5173 即可使用"
