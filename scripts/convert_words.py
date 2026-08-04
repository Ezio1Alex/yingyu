import sys
import json

"""
Convert Youdao NDJSON word list to app standard JSON format.

Usage:
    python scripts/convert_words.py --input ChuZhong_2.json --output data/zhongkao_words.json --bank 1
    python scripts/convert_words.py --input GaoZhong_2.json --output data/gaokao_words.json --bank 2
"""

def convert(input_path, output_path, bank_id):
    with open(input_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    words = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        item = json.loads(line)

        word_data = item.get('content', {}).get('word', {})
        content = word_data.get('content', {})

        head_word = content.get('wordHead') or item.get('headWord', '')

        trans_list = content.get('trans', [])
        definition = ''
        pos = ''
        if trans_list:
            t = trans_list[0]
            pos = t.get('pos', '')
            cn = t.get('tranCn', '')
            definition = f'{pos} {cn}'.strip()

        sentences = content.get('sentence', {}).get('sentences', [])
        example_en = ''
        example_cn = ''
        if sentences:
            s = sentences[0]
            example_en = s.get('sContent', '')
            example_cn = s.get('sCn', '')

        # 提取音标
        phonetic = content.get('phone') or content.get('usphone') or ''
        if phonetic:
            phonetic = f'/{phonetic}/'

        words.append({
            'word': head_word,
            'phonetic': phonetic,
            'definition': definition or '待补充',
            'definition': definition or '待补充',
            'pos': pos,
            'example_en': example_en,
            'example_cn': example_cn,
            'bank_id': bank_id,
        })

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    print(f'✅ 转换完成: {len(words)} 个词 → {output_path}')

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python convert_words.py --input <file> --output <file> --bank <1|2>')
        sys.exit(1)

    input_path = None
    output_path = None
    bank_id = 2

    args = sys.argv[1:]
    for i, arg in enumerate(args):
        if arg == '--input' and i + 1 < len(args):
            input_path = args[i + 1]
        elif arg == '--output' and i + 1 < len(args):
            output_path = args[i + 1]
        elif arg == '--bank' and i + 1 < len(args):
            bank_id = int(args[i + 1])

    if not input_path or not output_path:
        print('请提供 --input 和 --output 参数')
        sys.exit(1)

    convert(input_path, output_path, bank_id)
