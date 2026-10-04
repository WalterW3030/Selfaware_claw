// [任务42-第1轮] 简体语言包（基准包，key 权威来源）
// 抽取范围：任务39 pages/order、pages/index、pages/history 三页全部界面显示文字
// 含：选单栏 / 标签面板13项 / 分量4类 / 预算 / 忌口15项 / 输入栏 / 屏2卡片(含角标✓/?/⚠固定三句) / 屏3 / 停摆兜底文案 / 首页 / 历史页
// key 对齐要求：zh-Hant、en 两包必须与本包 key 完全一致。

module.exports = {
  // ── 通用 ──
  'common.confirm': '确认',
  'common.cancel': '取消',
  'common.close': '关闭',
  'common.add': '添加',
  'common.done': '完成',
  'common.loading': '加载中…',
  'common.empty': '暂无记录',
  'common.send': '发送',
  'common.retry': '重试',

  // ── 点餐页 order：标题 / 顶部 ──
  'order.pageTitle': '点餐助手',
  'order.newMeal': '新的一餐',
  'order.newMealToast': '已开启新的一餐',

  // ── 选单栏（规格 §二）──
  'order.menuBar.mealPrefix': '餐:',
  'order.menuBar.plus': '+',

  // ── 餐切换选项（规格 §二）──
  'order.meal.breakfast': '早餐',
  'order.meal.lunch': '午餐',
  'order.meal.dinner': '晚餐',
  'order.meal.lateNight': '夜宵',
  'order.meal.afternoonTea': '下午茶',

  // ── [+] 面板 ──
  'order.panel.moreTags': '更多标签',
  'order.panel.portionTitle': '分量（一餐合计≤3道，当前{count}道）',
  'order.panel.portionLimitToast': '一餐合计最多3道',
  'order.panel.budgetTitle': '预算：人均{amount}元以内',
  'order.panel.dietEntry': '忌口管理',
  'order.panel.modeTitle': '分析模式',
  'order.panel.modeFast': '⚡ 快速',
  'order.panel.modeDeep': '🍽 详细',
  'order.panel.langTitle': '语言',
  'order.panel.extraTitle': '加菜 / 已有食物',
  'order.panel.extraPlaceholder': '如：已有一份米饭',

  // ── 13项标签名（规格 §一，逐字）──
  'order.tag.sport_recover': '运动后补充',
  'order.tag.body_recover': '身体恢复',
  'order.tag.group_dining': '多人聚餐',
  'order.tag.drink': '小酌',
  'order.tag.spicy': '吃辣',
  'order.tag.no_spicy': '无辣',
  'order.tag.light': '清淡',
  'order.tag.appetite': '开胃',
  'order.tag.less_oil_sugar': '少油少糖',
  'order.tag.fat_loss': '减脂控卡',
  'order.tag.muscle_gain': '健身增肌',
  'order.tag.cool_down': '解暑',
  'order.tag.warm_stomach': '暖胃',

  // ── 分量四类（规格 §三）──
  'order.portion.staple': '主食',
  'order.portion.main': '主菜',
  'order.portion.snack': '小吃',
  'order.portion.drink': '饮料',

  // ── 忌口15项（规格 §五，逐字）──
  'order.diet.no_spicy_diet': '不吃辣',
  'order.diet.no_cilantro': '不吃香菜',
  'order.diet.no_garlic': '不吃葱蒜',
  'order.diet.halal': '清真（忌猪肉酒精）',
  'order.diet.lactose': '乳糖不耐',
  'order.diet.seafood': '海鲜过敏',
  'order.diet.peanut_nut': '花生坚果过敏',
  'order.diet.gluten': '麸质过敏',
  'order.diet.egg': '鸡蛋过敏',
  'order.diet.soy': '大豆过敏',
  'order.diet.vegetarian': '素食（蛋奶素/纯素）',
  'order.diet.sugar_control': '控糖',
  'order.diet.salt_control': '限盐',
  'order.diet.low_purine': '低嘌呤（痛风）',
  'order.diet.pregnancy': '孕产妇禁忌',

  // ── 忌口弹层 ──
  'order.dietPanel.title': '忌口管理',
  'order.dietPanel.customPlaceholder': '手输补充忌口',
  'order.dietPanel.addedToast': '已添加',

  // ── 输入栏 ──
  'order.input.placeholder': '补充要求（可选）',
  'order.input.needSelectToast': '请先选择或输入',
  'order.input.alreadyTagToast': '已选该标签',
  'order.input.sending': '推荐中…',

  // ── 语言项显示名 ──
  'order.lang.zhHans': '普通话',
  'order.lang.en': 'English',
  'order.lang.yue': '粤语',
  'order.lang.yueBadge': '(播报即将支持)',

  // ── 屏2 推荐结果卡片 ──
  'order.result.expand': '展开完整分析',

  // ── 角标固定三句说明（逐字，Coordinator 2026-09-29 14:49:23 指令）──
  'order.badge.real': '来自真实资料',
  'order.badge.inferred': '结果基于真实资料推断，注意甄别',
  'order.badge.ai': '结果主要来自ai生成信息，注意甄别',

  // ── 停摆态兜底文案（逐字）──
  'order.stall.text': '这类情况我还没学会，先用简单推荐',
  'order.stall.fallbackReason': '简单推荐',
  'order.stall.noResult': '暂无推荐',
  'order.stall.retryHint': '请补充信息后重试',

  // ── 屏3 完整分析四段 ──
  'order.analysis.requirements': '需求清单',
  'order.analysis.matches': '匹配结果',
  'order.analysis.params': '参数记录',
  'order.analysis.limits': '局限声明',
  'order.analysis.confirmAdd': '确认加入本餐',
  'order.analysis.rescreen': '重新筛选',
  'order.analysis.addedToast': '已加入本餐',

  // ── 屏3 参数记录条目 ──
  'order.param.meal': '餐次：{meal}',
  'order.param.mode': '模式：{mode}',
  'order.param.modeFast': '快速',
  'order.param.modeDeep': '详细',
  'order.param.budget': '预算：人均{amount}以内',
  'order.param.diet': '忌口：{diet}',
  'order.param.dietNone': '无',

  // ── 屏3 局限声明（正常态）──
  'order.limit.normal': '推荐结果基于当前候选清单与速查表，具体以实际菜单为准；成分与禁忌请以门店标注为准。',

  // ── 输入栏小块前缀（拼接用）──
  'order.chip.extraPrefix': '已有：',
  'order.chip.portionPrefix': '点{count}道：',
  'order.chip.budgetPrefix': '预算：人均{amount}以内',

  // ── 首页 index ──
  'index.pageTitle': '食知',
  'index.capture': '拍照识别',
  'index.template.recognize': '识图',
  'index.template.copy': '文案',
  'index.template.nutrition': '营养分析',
  'index.recentMeals': '最近餐次',
  'index.recentEmpty': '暂无记录',
  'index.mealDefaultScene': '一餐',
  'index.chatEntry': '自由提问',

  // ── 历史页 history ──
  'history.pageTitle': '历史记录',
  'history.empty': '暂无记录',
  'history.mealDefaultScene': '一餐'
}
