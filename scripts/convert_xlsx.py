"""
lilinji/English xlsx → 完整单词 SQL（含自动生成例句）

用法:
    python scripts/convert_xlsx.py --input data/中考大纲词汇.xlsx --bank 1 --output data/zhongkao.sql
    python scripts/convert_xlsx.py --input data/高考大纲词汇表.xlsx --bank 2 --output data/gaokao.sql
"""

import openpyxl
import re
import html
import sys
import os

# ===== 例句模板（按词性） =====
SENTENCE_TEMPLATES = {
    'n': [
        ("The {word} is very important in daily life.", "{word}在日常生活中非常重要。"),
        ("She has a good {word} for this job.", "她做这项工作有很好的{word}。"),
        ("We need to improve our {word}.", "我们需要提高我们的{word}。"),
        ("The {word} of the company is growing.", "公司的{word}正在增长。"),
        ("He showed great {word} during the meeting.", "他在会议中展现了出色的{word}。"),
        ("This {word} is widely used in many fields.", "这种{word}在许多领域被广泛使用。"),
        ("{word} is an important part of our life.", "{word}是我们生活的重要组成部分。"),
        ("They discussed the {word} at the meeting.", "他们在会议上讨论了{word}。"),
    ],
    'v': [
        ("You should {word} your goals step by step.", "你应该一步一步地{word}你的目标。"),
        ("They decided to {word} the plan.", "他们决定{word}这个计划。"),
        ("She {word}s every morning to stay healthy.", "她每天早上{word}以保持健康。"),
        ("We need to {word} this problem quickly.", "我们需要尽快{word}这个问题。"),
        ("He tried to {word} his parents' expectations.", "他试图{word}父母的期望。"),
        ("The company will {word} a new product next month.", "公司下个月将{word}一款新产品。"),
        ("Please {word} the instructions carefully.", "请仔细{word}这些说明。"),
        ("They {word}ed the project ahead of schedule.", "他们提前{word}了这个项目。"),
    ],
    'adj': [
        ("This is a very {word} {tool} for students.", "这是一个对学生来说非常{word}的{tool}。"),
        ("The {tool} looks {word} and beautiful.", "这个{tool}看起来{word}又漂亮。"),
        ("She feels {word} about her future.", "她对未来感到{word}。"),
        ("It is {word} to learn a second language.", "学习第二语言是很{word}的。"),
        ("The weather is {word} today.", "今天天气很{word}。"),
        ("He gave a {word} speech at the ceremony.", "他在典礼上做了一个{word}的演讲。"),
        ("This book is {word} for beginners.", "这本书对初学者来说{word}。"),
        ("We had a {word} time at the party.", "我们在聚会上度过了{word}的时光。"),
    ],
    'adv': [
        ("She speaks English very {word}.", "她英语说得非常{word}。"),
        ("He {word} finished his homework.", "他{word}完成了作业。"),
        ("The team worked {word} together.", "团队{word}地合作。"),
        ("We should {word} consider this suggestion.", "我们应该{word}考虑这个建议。"),
        ("They arrived {word} at the station.", "他们{word}到达了车站。"),
        ("She {word} accepted the invitation.", "她{word}接受了邀请。"),
    ],
    'pron': [
        ("{word} is a common word in English.", "{word}是英语中的常用词。"),
        ("Please give {word} to me.", "请把{word}给我。"),
        ("{word} is important to remember this rule.", "{word}记住这条规则很重要。"),
    ],
    'prep': [
        ("The book is {word} the desk.", "书在桌子{word}。"),
        ("We'll meet {word} 3 o'clock.", "我们{word}三点见面。"),
        ("She went {word} the store.", "她{word}商店走去。"),
    ],
    'conj': [
        ("You can stay {word} you can leave.", "你可以留下{word}你可以离开。"),
        ("{word} it rains, we'll stay at home.", "{word}下雨，我们就待在家里。"),
    ],
    'num': [
        ("There are {word} students in the class.", "班上有{word}个学生。"),
        ("Please turn to page {word}.", "请翻到第{word}页。"),
    ],
    'art': [
        ("{word} is used before a noun.", "{word}用在名词前面。"),
    ],
    'int': [
        ("{word}! What a surprise!", "{word}！真是惊喜！"),
    ],
    'vt': [
        ("You should {word} the rules carefully.", "你应该仔细{word}这些规则。"),
        ("She {word}s her work every day.", "她每天{word}她的工作。"),
        ("They {word}ed the new method.", "他们{word}了新方法。"),
    ],
    'vi': [
        ("The company {word}s well in this area.", "公司在这个领域{word}良好。"),
        ("Things will {word} over time.", "事情会随着时间{word}。"),
    ],
    'aux': [
        ("{word} is used to form questions.", "{word}用来构成疑问句。"),
        ("You {word} pay attention in class.", "你{word}在课堂上注意听讲。"),
    ],
    'abbr': [
        ("{word} stands for something in English.", "{word}是英语中某个词的缩写。"),
    ],
}

FALLBACK_TEMPLATES = [
    ("{word} is a useful word in English.", "{word}是英语中的一个有用词汇。"),
    ("Please remember the word {word}.", "请记住{word}这个词。"),
    ("We learned the word {word} today.", "我们今天学了{word}这个词。"),
    ("Can you use {word} in a sentence?", "你能用{word}造句吗？"),
]

NOUN_TOOLS = ["book", "tool", "skill", "thing", "subject", "task", "job", "method"]


def parse_pos_and_def(text):
    """从释义中解析词性和纯释义"""
    text = text.strip()
    # 匹配词性前缀：n./v./adj./adv./prep./conj./pron./num./art./int./vt./vi./aux./abbr.
    pos_pattern = r'^([a-zA-Z]+\.[a-zA-Z]*\.?)\s*(.*)'
    m = re.match(pos_pattern, text)
    if m:
        pos = m.group(1).strip().rstrip('.')  # "n", "vt", "adj" 等
        definition = m.group(2).strip()
        return pos, definition
    return '', text


def generate_sentence(word, pos):
    """根据词性生成例句"""
    # 确定词性分组
    pos_lower = pos.lower().strip('.')

    templates = SENTENCE_TEMPLATES.get(pos_lower, [])
    if not templates:
        # 尝试模糊匹配
        for key in SENTENCE_TEMPLATES:
            if pos_lower.startswith(key) or key.startswith(pos_lower):
                templates = SENTENCE_TEMPLATES[key]
                break

    if not templates:
        # 检查第一个字母
        if word[0] in 'aeiou':
            first_letter_noun = 'an'
        else:
            first_letter_noun = 'a'
        templates = FALLBACK_TEMPLATES

    import random
    en_template, cn_template = random.choice(templates)

    # 替换模板中的变量
    if '{tool}' in en_template:
        tool = random.choice(NOUN_TOOLS)
        en_sentence = en_template.format(word=word, tool=tool)
        cn_sentence = cn_template.format(word=word, tool=tool)
    else:
        en_sentence = en_template.format(word=word)
        cn_sentence = cn_template.format(word=word)

    # 动词时态处理：如果是 v 打头，确保例句中的动词形式合适
    # 对于一般现在时第三人称单数
    if pos_lower in ('v', 'vt', 'vi') and word.endswith('s'):
        pass  # 保持原形

    # 替换 {word}s 形式的模板动词变位
    en_sentence = en_sentence.replace('{word}s', word + ('es' if word.endswith(('s','x','ch','sh','o')) else 's'))
    en_sentence = en_sentence.replace('{word}ed', word + ('ied' if word.endswith('y') and len(word)>2 and word[-2] not in 'aeiou' else 'ed'))
    en_sentence = en_sentence.replace('{word}ing', word + ('ing' if word.endswith('e') else word[-1] + 'ing' if len(word)==1 else 'ing'))

    return en_sentence, cn_sentence


def escape_sql(s):
    """转义 SQL 字符串"""
    return s.replace("'", "''")


def convert_xlsx(input_path, bank_id, output_path=None):
    """转换 xlsx 为 SQL"""
    wb = openpyxl.load_workbook(input_path, read_only=True)
    ws = wb.active

    lines = []
    count = 0

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue  # 跳过表头

        word = str(row[0]).strip() if row[0] else ''
        uk_phonetic = str(row[1]).strip() if len(row) > 1 and row[1] else ''
        us_phonetic = str(row[2]).strip() if len(row) > 2 and row[2] else ''
        definition = str(row[3]).strip() if len(row) > 3 and row[3] else ''

        if not word or not definition:
            continue

        # 解析词性和释义
        pos, pure_def = parse_pos_and_def(definition)
        # 如果词性解析失败，从整段释义中提取第一个词性标记
        if not pos:
            pos_match = re.match(r'^([a-zA-Z]+)\.', definition)
            if pos_match:
                pos = pos_match.group(1)

        # 使用英式音标（优先），没有则用美式
        phonetic = uk_phonetic if uk_phonetic else us_phonetic

        # 生成例句
        example_en, example_cn = generate_sentence(word, pos)

        lines.append(
            f"INSERT INTO words (word, phonetic, uk_phonetic, us_phonetic, definition, pos, example_en, example_cn, bank_id) "
            f"VALUES ('{escape_sql(word)}', '{escape_sql(phonetic)}', '{escape_sql(uk_phonetic)}', '{escape_sql(us_phonetic)}', "
            f"'{escape_sql(definition)}', '{escape_sql(pos)}', '{escape_sql(example_en)}', '{escape_sql(example_cn)}', {bank_id});"
        )
        count += 1

    output = '\n'.join(lines)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(f'-- {os.path.basename(input_path)} → {count} 个词 (bank_id={bank_id})\n')
            f.write(f'-- 生成时间: {__import__("datetime").datetime.now().strftime("%Y-%m-%d %H:%M")}\n\n')
            f.write(output)
            f.write(f'\n\n-- 共 {count} 个词汇\n')
        print(f'✅ 转换完成: {count} 个词 → {output_path}')
    else:
        print(output)

    return count


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='转换 lilinji xlsx 词库为 SQL')
    parser.add_argument('--input', required=True, help='输入的 xlsx 文件路径')
    parser.add_argument('--bank', type=int, required=True, choices=[1, 2], help='词库ID (1=中考, 2=高考)')
    parser.add_argument('--output', default=None, help='输出的 SQL 文件路径')
    args = parser.parse_args()

    convert_xlsx(args.input, args.bank, args.output)
