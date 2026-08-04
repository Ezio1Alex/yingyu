# 生成 PWA 主屏图标（192/512 PNG），风格与 public/favicon.svg 一致
# 用法: python scripts/make-icons.py
from PIL import Image, ImageDraw, ImageFont
import os

SIZE = 512
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
# 圆角矩形背景（品牌色 indigo #4f46e5，同 favicon）
d.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=102, fill='#4f46e5')

# 白色"英"字居中（用系统中文字体）
font_path = None
for p in ['C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf', 'C:/Windows/Fonts/msyhbd.ttc']:
    if os.path.exists(p):
        font_path = p
        break
if font_path:
    font = ImageFont.truetype(font_path, 360)
    text = '英'
    bbox = d.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((SIZE - w) / 2 - bbox[0], (SIZE - h) / 2 - bbox[1]), text, font=font, fill='white')

img.save('public/icon-512.png')
img.resize((192, 192), Image.LANCZOS).save('public/icon-192.png')
print('生成 public/icon-512.png + public/icon-192.png')
