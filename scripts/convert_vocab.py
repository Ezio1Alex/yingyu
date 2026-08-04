"""
合并 lilinji/English（单词+音标+释义）+ 有道词库（例句）→ 完整单词 SQL

用法:
    python scripts/convert_vocab.py --xlsx data/中考大纲词汇.xlsx --bank 1 --youdao data/ChuZhong_2.json
    python scripts/convert_vocab.py --xlsx data/高考大纲词汇表.xlsx --bank 2 --youdao data/GaoZhong_2.json

需要先解压有道词库:
    unzip -p data/ChuZhong_2.zip > data/ChuZhong_2.json
    unzip -p data/GaoZhong_2.zip > data/GaoZhong_2.json
"""

import json
import re
import os
import sys
import openpyxl
from datetime import datetime


def load_youdao(json_path):
    """加载有道词库，按单词建立索引"""
    index = {}
    with open(json_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            item = json.loads(line)
            word = item.get('headWord', '').lower().strip()
            content = item.get('content', {}).get('word', {}).get('content', {})

            # 提取例句
            sentences = []
            for s in content.get('sentence', {}).get('sentences', []):
                en = s.get('sContent', '').strip()
                cn = s.get('sCn', '').strip()
                if en and cn:
                    sentences.append((en, cn))

            index[word] = {
                'sentences': sentences,
            }
    print(f'  有道词库: {len(index)} 个词', file=sys.stderr)
    return index


def parse_pos_and_def(text):
    """从释义中解析词性和纯释义"""
    text = text.strip().replace('\n', ' ').replace('\r', '')
    pos_pattern = r'^([a-zA-Z]+\.(?:[a-zA-Z]+\.)?)\s*(.*)'
    m = re.match(pos_pattern, text)
    if m:
        pos = m.group(1).strip().rstrip('.')
        definition = m.group(2).strip()
        return pos, definition

    # 尝试在释义中找词性标记
    pos_match = re.match(r'^([a-zA-Z]+)\.', text)
    if pos_match:
        return pos_match.group(1), text[len(pos_match.group(0)):].strip()
    return '', text


def escape_sql(s):
    return s.replace("'", "''") if s else ''


def convert(xlsx_path, bank_id, youdao_json_path, output_path=None):
    print(f'加载有道词库...', file=sys.stderr)
    youdao = load_youdao(youdao_json_path)

    print(f'读取 xlsx...', file=sys.stderr)
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.active

    bank_name = '中考' if bank_id == 1 else '高考'
    lines = []
    count = 0
    matched = 0  # 有道例句匹配数

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue  # 跳过表头

        word = str(row[0]).strip() if row[0] else ''
        uk_phonetic = str(row[1]).strip() if len(row) > 1 and row[1] else ''
        us_phonetic = str(row[2]).strip() if len(row) > 2 and row[2] else ''
        definition = str(row[3]).strip() if len(row) > 3 and row[3] else ''

        if not word or not definition:
            continue

        # 音标去括号
        phonetic = uk_phonetic.strip('[]')
        uk_clean = uk_phonetic.strip('[]')
        us_clean = us_phonetic.strip('[]')

        # 解析词性和释义
        pos, pure_def = parse_pos_and_def(definition)

        # 从有道词典查找例句
        example_en = ''
        example_cn = ''
        word_lower = word.lower().strip()
        if word_lower in youdao and youdao[word_lower]['sentences']:
            example_en, example_cn = youdao[word_lower]['sentences'][0]
            matched += 1
        # 试试不带标点的
        elif word_lower.rstrip('.,!?;:') in youdao:
            alt = word_lower.rstrip('.,!?;:')
            if youdao[alt]['sentences']:
                example_en, example_cn = youdao[alt]['sentences'][0]
                matched += 1

        lines.append(
            f"INSERT INTO words (word, phonetic, uk_phonetic, us_phonetic, definition, pos, example_en, example_cn, bank_id) "
            f"VALUES ('{escape_sql(word)}', '{escape_sql(phonetic)}', '{escape_sql(uk_clean)}', '{escape_sql(us_clean)}', "
            f"'{escape_sql(definition)}', '{escape_sql(pos)}', '{escape_sql(example_en)}', '{escape_sql(example_cn)}', {bank_id});"
        )
        count += 1

    output = '\n'.join(lines)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'-- {os.path.basename(xlsx_path)} → {count} 个词 (bank_id={bank_id})\n')
            f.write(f'-- 生成时间: {datetime.now().strftime("%Y-%m-%d %H:%M")}\n')
            f.write(f'-- 有例句: {matched}/{count}\n\n')
            f.write(output)
            f.write(f'\n\n-- 共 {count} 个词汇, {matched} 个有例句\n')

    print(f'✅ {bank_name}: {count} 个词, {matched} 个匹配到例句', file=sys.stderr)
    return count


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='合并 lilinji xlsx + 有道例句 → SQL')
    parser.add_argument('--xlsx', required=True, help='lilinji xlsx 文件')
    parser.add_argument('--bank', type=int, required=True, choices=[1, 2])
    parser.add_argument('--youdao', required=True, help='有道 JSON 文件（解压后的 NDJSON）')
    parser.add_argument('--output', default=None, help='输出 SQL 文件')
    args = parser.parse_args()

    convert(args.xlsx, args.bank, args.youdao, args.output)
