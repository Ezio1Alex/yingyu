const words = [
  { word: "apple", phonetic: "/ˈæp.əl/", definition: "n. 苹果", pos: "n", example_en: "I eat an apple every day.", example_cn: "我每天吃一个苹果。", bank: 1 },
  { word: "book", phonetic: "/bʊk/", definition: "n. 书 v. 预订", pos: "n", example_en: "She is reading a book.", example_cn: "她在读一本书。", bank: 1 },
  { word: "cat", phonetic: "/kæt/", definition: "n. 猫", pos: "n", example_en: "The cat is sleeping.", example_cn: "猫在睡觉。", bank: 1 },
  { word: "dog", phonetic: "/dɒɡ/", definition: "n. 狗", pos: "n", example_en: "He walks his dog every morning.", example_cn: "他每天早上遛狗。", bank: 1 },
  { word: "egg", phonetic: "/eɡ/", definition: "n. 蛋；鸡蛋", pos: "n", example_en: "I had an egg for breakfast.", example_cn: "我早餐吃了一个鸡蛋。", bank: 1 },
  { word: "fish", phonetic: "/fɪʃ/", definition: "n. 鱼 v. 钓鱼", pos: "n", example_en: "There are many fish in the lake.", example_cn: "湖里有很多鱼。", bank: 1 },
  { word: "girl", phonetic: "/ɡɜːl/", definition: "n. 女孩；女儿", pos: "n", example_en: "The girl is playing with her friends.", example_cn: "女孩在和朋友们玩。", bank: 1 },
  { word: "house", phonetic: "/haʊs/", definition: "n. 房子；住宅", pos: "n", example_en: "They live in a big house.", example_cn: "他们住在一栋大房子里。", bank: 1 },
  { word: "ice", phonetic: "/aɪs/", definition: "n. 冰；冰淇淋", pos: "n", example_en: "The lake is covered with ice.", example_cn: "湖面覆盖着冰。", bank: 1 },
  { word: "jump", phonetic: "/dʒʌmp/", definition: "v. 跳；跳跃", pos: "v", example_en: "The dog can jump high.", example_cn: "这只狗跳得很高。", bank: 1 },
  { word: "abandon", phonetic: "/əˈbændən/", definition: "v. 放弃；遗弃", pos: "v", example_en: "They had to abandon the plan.", example_cn: "他们不得不放弃这个计划。", bank: 2 },
  { word: "ability", phonetic: "/əˈbɪləti/", definition: "n. 能力；才能", pos: "n", example_en: "She has great ability in music.", example_cn: "她在音乐方面很有才能。", bank: 2 },
  { word: "abroad", phonetic: "/əˈbrɔːd/", definition: "adv. 在国外；到国外", pos: "adv", example_en: "He wants to study abroad.", example_cn: "他想出国留学。", bank: 2 },
  { word: "accept", phonetic: "/əkˈsept/", definition: "v. 接受；承认", pos: "v", example_en: "She accepted the invitation.", example_cn: "她接受了邀请。", bank: 2 },
  { word: "achieve", phonetic: "/əˈtʃiːv/", definition: "v. 达到；取得", pos: "v", example_en: "He achieved his goal.", example_cn: "他实现了自己的目标。", bank: 2 },
  { word: "believe", phonetic: "/bɪˈliːv/", definition: "v. 相信；认为", pos: "v", example_en: "I believe you are right.", example_cn: "我相信你是对的。", bank: 2 },
  { word: "change", phonetic: "/tʃeɪndʒ/", definition: "v. 改变 n. 变化", pos: "v", example_en: "Things have changed a lot.", example_cn: "情况已经发生了很大变化。", bank: 2 },
  { word: "develop", phonetic: "/dɪˈveləp/", definition: "v. 发展；开发；养成", pos: "v", example_en: "The company developed a new product.", example_cn: "这家公司开发了一款新产品。", bank: 2 },
  { word: "education", phonetic: "/ˌedʒuˈkeɪʃn/", definition: "n. 教育；培养", pos: "n", example_en: "Education is very important.", example_cn: "教育非常重要。", bank: 2 },
  { word: "familiar", phonetic: "/fəˈmɪliə/", definition: "adj. 熟悉的；常见的", pos: "adj", example_en: "This place looks familiar to me.", example_cn: "这个地方看起来眼熟。", bank: 2 },
  { word: "government", phonetic: "/ˈɡʌvənmənt/", definition: "n. 政府；治理", pos: "n", example_en: "The government made a new law.", example_cn: "政府制定了一项新法律。", bank: 2 },
  { word: "important", phonetic: "/ɪmˈpɔːtnt/", definition: "adj. 重要的；有重大影响的", pos: "adj", example_en: "This is an important meeting.", example_cn: "这是一个重要的会议。", bank: 2 },
  { word: "knowledge", phonetic: "/ˈnɒlɪdʒ/", definition: "n. 知识；学问", pos: "n", example_en: "Knowledge is power.", example_cn: "知识就是力量。", bank: 2 },
  { word: "language", phonetic: "/ˈlæŋɡwɪdʒ/", definition: "n. 语言", pos: "n", example_en: "She can speak three languages.", example_cn: "她会说三种语言。", bank: 2 },
  { word: "necessary", phonetic: "/ˈnesəsəri/", definition: "adj. 必要的；必需的", pos: "adj", example_en: "It is necessary to practice every day.", example_cn: "每天练习是必要的。", bank: 2 },
  { word: "opportunity", phonetic: "/ˌɒpəˈtjuːnəti/", definition: "n. 机会；时机", pos: "n", example_en: "This is a great opportunity.", example_cn: "这是一个很好的机会。", bank: 2 },
  { word: "practice", phonetic: "/ˈpræktɪs/", definition: "n. 练习 v. 实践", pos: "n", example_en: "Practice makes perfect.", example_cn: "熟能生巧。", bank: 2 },
  { word: "question", phonetic: "/ˈkwestʃən/", definition: "n. 问题 v. 询问", pos: "n", example_en: "Do you have any questions?", example_cn: "你有什么问题吗？", bank: 2 },
  { word: "remember", phonetic: "/rɪˈmembə/", definition: "v. 记住；回忆起", pos: "v", example_en: "Remember to bring your book.", example_cn: "记得带你的书。", bank: 2 },
  { word: "university", phonetic: "/ˌjuːnɪˈvɜːsəti/", definition: "n. 大学", pos: "n", example_en: "She wants to go to university.", example_cn: "她想上大学。", bank: 2 },
]

console.log('-- 本地测试种子数据 (仅用于开发测试)')
console.log()

for (const w of words) {
  const en = w.example_en.replace(/'/g, "''")
  const cn = w.example_cn.replace(/'/g, "''")
  console.log(`INSERT INTO words (word, phonetic, definition, pos, example_en, example_cn, bank_id) VALUES ('${w.word}', '${w.phonetic}', '${w.definition}', '${w.pos}', '${en}', '${cn}', ${w.bank});`)
}

console.log()
console.log(`-- 共 ${words.length} 个测试词汇`)
