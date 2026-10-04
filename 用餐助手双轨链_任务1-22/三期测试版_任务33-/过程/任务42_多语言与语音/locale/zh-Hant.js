// [任务42-第1轮] 繁体语言包（按简体包逐条转写，key 与 zh-Hans 完全对齐）
// 转换方式：OpenCC s2t 常用字/词级转换 + 人工校对用词（香港/台湾习惯）
// 说明：本包 key 必须与 locale/zh-Hans.js 一一对应，不得增删 key。

module.exports = {
  // ── 通用 ──
  'common.confirm': '確認',
  'common.cancel': '取消',
  'common.close': '關閉',
  'common.add': '添加',
  'common.done': '完成',
  'common.loading': '載入中…',
  'common.empty': '暫無記錄',
  'common.send': '發送',
  'common.retry': '重試',

  // ── 點餐頁 order：標題 / 頂部 ──
  'order.pageTitle': '點餐助手',
  'order.newMeal': '新的一餐',
  'order.newMealToast': '已開啟新的一餐',

  // ── 選單欄（規格 §二）──
  'order.menuBar.mealPrefix': '餐:',
  'order.menuBar.plus': '+',

  // ── 餐切換選項（規格 §二）──
  'order.meal.breakfast': '早餐',
  'order.meal.lunch': '午餐',
  'order.meal.dinner': '晚餐',
  'order.meal.lateNight': '夜宵',
  'order.meal.afternoonTea': '下午茶',

  // ── [+] 面板 ──
  'order.panel.moreTags': '更多標籤',
  'order.panel.portionTitle': '分量（一餐合計≤3道，當前{count}道）',
  'order.panel.portionLimitToast': '一餐合計最多3道',
  'order.panel.budgetTitle': '預算：人均{amount}元以內',
  'order.panel.dietEntry': '忌口管理',
  'order.panel.modeTitle': '分析模式',
  'order.panel.modeFast': '⚡ 快速',
  'order.panel.modeDeep': '🍽 詳細',
  'order.panel.langTitle': '語言',
  'order.panel.extraTitle': '加菜 / 已有食物',
  'order.panel.extraPlaceholder': '如：已有一份米飯',

  // ── 13項標籤名（規格 §一，逐字）──
  'order.tag.sport_recover': '運動後補充',
  'order.tag.body_recover': '身體恢復',
  'order.tag.group_dining': '多人聚餐',
  'order.tag.drink': '小酌',
  'order.tag.spicy': '吃辣',
  'order.tag.no_spicy': '無辣',
  'order.tag.light': '清淡',
  'order.tag.appetite': '開胃',
  'order.tag.less_oil_sugar': '少油少糖',
  'order.tag.fat_loss': '減脂控卡',
  'order.tag.muscle_gain': '健身增肌',
  'order.tag.cool_down': '解暑',
  'order.tag.warm_stomach': '暖胃',

  // ── 分量四類（規格 §三）──
  'order.portion.staple': '主食',
  'order.portion.main': '主菜',
  'order.portion.snack': '小吃',
  'order.portion.drink': '飲料',

  // ── 忌口15項（規格 §五，逐字）──
  'order.diet.no_spicy_diet': '不吃辣',
  'order.diet.no_cilantro': '不吃香菜',
  'order.diet.no_garlic': '不吃蔥蒜',
  'order.diet.halal': '清真（忌豬肉酒精）',
  'order.diet.lactose': '乳糖不耐',
  'order.diet.seafood': '海鮮過敏',
  'order.diet.peanut_nut': '花生堅果過敏',
  'order.diet.gluten': '麩質過敏',
  'order.diet.egg': '雞蛋過敏',
  'order.diet.soy': '大豆過敏',
  'order.diet.vegetarian': '素食（蛋奶素/純素）',
  'order.diet.sugar_control': '控糖',
  'order.diet.salt_control': '限鹽',
  'order.diet.low_purine': '低嘌呤（痛風）',
  'order.diet.pregnancy': '孕產婦禁忌',

  // ── 忌口彈層 ──
  'order.dietPanel.title': '忌口管理',
  'order.dietPanel.customPlaceholder': '手輸補充忌口',
  'order.dietPanel.addedToast': '已添加',

  // ── 輸入欄 ──
  'order.input.placeholder': '補充要求（可選）',
  'order.input.needSelectToast': '請先選擇或輸入',
  'order.input.alreadyTagToast': '已選該標籤',
  'order.input.sending': '推薦中…',

  // ── 語言項顯示名 ──
  'order.lang.zhHans': '普通話',
  'order.lang.en': 'English',
  'order.lang.yue': '粵語',
  'order.lang.yueBadge': '(播報即將支持)',

  // ── 屏2 推薦結果卡片 ──
  'order.result.expand': '展開完整分析',

  // ── 角標固定三句說明（逐字）──
  'order.badge.real': '來自真實資料',
  'order.badge.inferred': '結果基於真實資料推斷，注意甄別',
  'order.badge.ai': '結果主要來自ai生成資訊，注意甄別',

  // ── 停擺態兜底文案（逐字）──
  'order.stall.text': '這類情況我還沒學會，先用簡單推薦',
  'order.stall.fallbackReason': '簡單推薦',
  'order.stall.noResult': '暫無推薦',
  'order.stall.retryHint': '請補充資訊後重試',

  // ── 屏3 完整分析四段 ──
  'order.analysis.requirements': '需求清單',
  'order.analysis.matches': '匹配結果',
  'order.analysis.params': '參數記錄',
  'order.analysis.limits': '局限聲明',
  'order.analysis.confirmAdd': '確認加入本餐',
  'order.analysis.rescreen': '重新篩選',
  'order.analysis.addedToast': '已加入本餐',

  // ── 屏3 參數記錄條目 ──
  'order.param.meal': '餐次：{meal}',
  'order.param.mode': '模式：{mode}',
  'order.param.modeFast': '快速',
  'order.param.modeDeep': '詳細',
  'order.param.budget': '預算：人均{amount}以內',
  'order.param.diet': '忌口：{diet}',
  'order.param.dietNone': '無',

  // ── 屏3 局限聲明（正常態）──
  'order.limit.normal': '推薦結果基於當前候選清單與速查表，具體以實際菜單為準；成分與禁忌請以門店標註為準。',

  // ── 輸入欄小塊前綴（拼接用）──
  'order.chip.extraPrefix': '已有：',
  'order.chip.portionPrefix': '點{count}道：',
  'order.chip.budgetPrefix': '預算：人均{amount}以內',

  // ── 首頁 index ──
  'index.pageTitle': '食知',
  'index.capture': '拍照識別',
  'index.template.recognize': '識圖',
  'index.template.copy': '文案',
  'index.template.nutrition': '營養分析',
  'index.recentMeals': '最近餐次',
  'index.recentEmpty': '暫無記錄',
  'index.mealDefaultScene': '一餐',
  'index.chatEntry': '自由提問',

  // ── 歷史頁 history ──
  'history.pageTitle': '歷史記錄',
  'history.empty': '暫無記錄',
  'history.mealDefaultScene': '一餐'
}
