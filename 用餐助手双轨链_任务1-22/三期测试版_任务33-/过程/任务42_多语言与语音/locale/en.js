// [任务42-第1轮] 英文语言包（按简体包逐条翻译，key 与 zh-Hans 完全对齐）
// 说明：本包 key 必须与 locale/zh-Hans.js 一一对应，不得增删 key。
// 界面文案量少（约百条），人工翻译。

module.exports = {
  // ── 通用 ──
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.add': 'Add',
  'common.done': 'Done',
  'common.loading': 'Loading…',
  'common.empty': 'No records',
  'common.send': 'Send',
  'common.retry': 'Retry',

  // ── 点餐页 order：标题 / 顶部 ──
  'order.pageTitle': 'Order Assistant',
  'order.newMeal': 'New Meal',
  'order.newMealToast': 'New meal started',

  // ── 选单栏（规格 §二）──
  'order.menuBar.mealPrefix': 'Meal:',
  'order.menuBar.plus': '+',

  // ── 餐切换选项（规格 §二）──
  'order.meal.breakfast': 'Breakfast',
  'order.meal.lunch': 'Lunch',
  'order.meal.dinner': 'Dinner',
  'order.meal.lateNight': 'Late Night',
  'order.meal.afternoonTea': 'Afternoon Tea',

  // ── [+] 面板 ──
  'order.panel.moreTags': 'More Tags',
  'order.panel.portionTitle': 'Portions (max 3 per meal, current {count})',
  'order.panel.portionLimitToast': 'Up to 3 dishes per meal',
  'order.panel.budgetTitle': 'Budget: within ¥{amount} per person',
  'order.panel.dietEntry': 'Dietary Restrictions',
  'order.panel.modeTitle': 'Analysis Mode',
  'order.panel.modeFast': '⚡ Fast',
  'order.panel.modeDeep': '🍽 Detailed',
  'order.panel.langTitle': 'Language',
  'order.panel.extraTitle': 'Add Dish / Existing Food',
  'order.panel.extraPlaceholder': 'e.g. Already have a bowl of rice',

  // ── 13项标签名（规格 §一，逐字）──
  'order.tag.sport_recover': 'Post-workout',
  'order.tag.body_recover': 'Recovery',
  'order.tag.group_dining': 'Group Dining',
  'order.tag.drink': 'Drinks',
  'order.tag.spicy': 'Spicy',
  'order.tag.no_spicy': 'No Spicy',
  'order.tag.light': 'Light',
  'order.tag.appetite': 'Appetizing',
  'order.tag.less_oil_sugar': 'Less Oil & Sugar',
  'order.tag.fat_loss': 'Fat Loss',
  'order.tag.muscle_gain': 'Muscle Gain',
  'order.tag.cool_down': 'Cooling',
  'order.tag.warm_stomach': 'Warming',

  // ── 分量四类（规格 §三）──
  'order.portion.staple': 'Staple',
  'order.portion.main': 'Main',
  'order.portion.snack': 'Snack',
  'order.portion.drink': 'Drink',

  // ── 忌口15项（规格 §五，逐字）──
  'order.diet.no_spicy_diet': 'No Spicy',
  'order.diet.no_cilantro': 'No Cilantro',
  'order.diet.no_garlic': 'No Scallion/Garlic',
  'order.diet.halal': 'Halal (no pork/alcohol)',
  'order.diet.lactose': 'Lactose Intolerant',
  'order.diet.seafood': 'Seafood Allergy',
  'order.diet.peanut_nut': 'Peanut/Nut Allergy',
  'order.diet.gluten': 'Gluten Allergy',
  'order.diet.egg': 'Egg Allergy',
  'order.diet.soy': 'Soy Allergy',
  'order.diet.vegetarian': 'Vegetarian (lacto-ovo/vegan)',
  'order.diet.sugar_control': 'Sugar Control',
  'order.diet.salt_control': 'Low Sodium',
  'order.diet.low_purine': 'Low Purine (Gout)',
  'order.diet.pregnancy': 'Pregnancy Restrictions',

  // ── 忌口弹层 ──
  'order.dietPanel.title': 'Dietary Restrictions',
  'order.dietPanel.customPlaceholder': 'Enter other restrictions',
  'order.dietPanel.addedToast': 'Added',

  // ── 输入栏 ──
  'order.input.placeholder': 'Additional requests (optional)',
  'order.input.needSelectToast': 'Please select or type something',
  'order.input.alreadyTagToast': 'Tag already selected',
  'order.input.sending': 'Recommending…',

  // ── 语言项显示名 ──
  'order.lang.zhHans': 'Mandarin',
  'order.lang.en': 'English',
  'order.lang.yue': 'Cantonese',
  'order.lang.yueBadge': '(Voice coming soon)',

  // ── 屏2 推荐结果卡片 ──
  'order.result.expand': 'View Full Analysis',

  // ── 角标固定三句说明（逐字）──
  'order.badge.real': 'From real sources',
  'order.badge.inferred': 'Inferred from real sources, please verify',
  'order.badge.ai': 'Mainly AI-generated, please verify',

  // ── 停摆态兜底文案（逐字）──
  'order.stall.text': "I haven't learned this case yet, using a simple recommendation first",
  'order.stall.fallbackReason': 'Simple recommendation',
  'order.stall.noResult': 'No recommendation',
  'order.stall.retryHint': 'Please add more info and retry',

  // ── 屏3 完整分析四段 ──
  'order.analysis.requirements': 'Requirements',
  'order.analysis.matches': 'Matches',
  'order.analysis.params': 'Parameters',
  'order.analysis.limits': 'Limitations',
  'order.analysis.confirmAdd': 'Add to This Meal',
  'order.analysis.rescreen': 'Re-filter',
  'order.analysis.addedToast': 'Added to this meal',

  // ── 屏3 参数记录条目 ──
  'order.param.meal': 'Meal: {meal}',
  'order.param.mode': 'Mode: {mode}',
  'order.param.modeFast': 'Fast',
  'order.param.modeDeep': 'Detailed',
  'order.param.budget': 'Budget: within ¥{amount} per person',
  'order.param.diet': 'Restrictions: {diet}',
  'order.param.dietNone': 'None',

  // ── 屏3 局限声明（正常态）──
  'order.limit.normal': 'Recommendations are based on the current candidate list and lookup tables; please refer to the actual menu. Ingredients and restrictions are subject to store labeling.',

  // ── 输入栏小块前缀（拼接用）──
  'order.chip.extraPrefix': 'Have: ',
  'order.chip.portionPrefix': '{count} dish(es): ',
  'order.chip.budgetPrefix': 'Budget: within ¥{amount} per person',

  // ── 首页 index ──
  'index.pageTitle': 'ShiZhi',
  'index.capture': 'Photo Recognition',
  'index.template.recognize': 'Image',
  'index.template.copy': 'Copy',
  'index.template.nutrition': 'Nutrition',
  'index.recentMeals': 'Recent Meals',
  'index.recentEmpty': 'No records',
  'index.mealDefaultScene': 'Meal',
  'index.chatEntry': 'Ask Freely',

  // ── 历史页 history ──
  'history.pageTitle': 'History',
  'history.empty': 'No records',
  'history.mealDefaultScene': 'Meal'
}
