import { tool } from 'ai';
import { z } from 'zod';

/** 常见调味料按「每 1 人份」的参考用量（克或毫升），用于按份量换算 */
const SEASONING_PER_SERVING: Record<string, { amount: number; unit: string; note?: string }> = {
  盐: { amount: 2, unit: '克', note: '约 1 小勺' },
  生抽: { amount: 10, unit: '毫升', note: '约 1 瓷勺' },
  老抽: { amount: 5, unit: '毫升', note: '上色用，约半勺' },
  料酒: { amount: 8, unit: '毫升', note: '约 1 勺' },
  糖: { amount: 5, unit: '克', note: '提鲜，可按口味增减' },
  醋: { amount: 5, unit: '毫升', note: '凉拌或酸味菜可加倍' },
  蚝油: { amount: 8, unit: '克', note: '约 1 勺' },
  淀粉: { amount: 5, unit: '克', note: '腌肉或勾芡' },
  姜: { amount: 5, unit: '克', note: '约 2–3 片' },
  蒜: { amount: 10, unit: '克', note: '约 2–3 瓣' },
  葱: { amount: 5, unit: '克', note: '约 1 根' },
  食用油: { amount: 10, unit: '毫升', note: '约 1 勺' },
  香油: { amount: 3, unit: '毫升', note: '出锅前淋少许' },
  白胡椒粉: { amount: 0.5, unit: '克', note: '少许' },
  黑胡椒粉: { amount: 0.5, unit: '克', note: '少许' },
  辣椒: { amount: 2, unit: '个', note: '干辣椒或新鲜小米辣' },
};

/** 按菜品/食材类型给出建议用到的调味料（不全用，模型/用户可取舍） */
const DISH_SEASONING_MAP: Record<string, string[]> = {
  红烧: ['盐', '生抽', '老抽', '料酒', '糖', '姜', '葱', '食用油'],
  清蒸: ['盐', '生抽', '料酒', '姜', '葱', '香油'],
  炒: ['盐', '生抽', '料酒', '糖', '姜', '蒜', '葱', '食用油', '淀粉'],
  凉拌: ['盐', '生抽', '醋', '糖', '蒜', '香油', '辣椒'],
  炖汤: ['盐', '料酒', '姜', '葱'],
  烧烤: ['盐', '生抽', '蚝油', '料酒', '糖', '白胡椒粉', '食用油'],
  家常: ['盐', '生抽', '料酒', '糖', '姜', '蒜', '葱', '食用油'],
};

function detectStyle(dishOrIngredients: string): string[] {
  const text = dishOrIngredients.toLowerCase().replace(/\s/g, '');
  if (/红烧|卤|酱/.test(text)) return DISH_SEASONING_MAP['红烧'];
  if (/蒸|清蒸/.test(text)) return DISH_SEASONING_MAP['清蒸'];
  if (/拌|凉拌/.test(text)) return DISH_SEASONING_MAP['凉拌'];
  if (/炖|汤/.test(text)) return DISH_SEASONING_MAP['炖汤'];
  if (/烤|煎/.test(text)) return DISH_SEASONING_MAP['烧烤'];
  return DISH_SEASONING_MAP['家常'];
}

/**
 * 根据食材/菜品和份量，给出调味料参考用量（做饭 skill）。
 */
export const suggestSeasoningTool = tool({
  description:
    '根据菜品或主要食材和份量（几人份），给出调味料种类与参考用量。当用户问“该放多少盐/酱油”“几人份要多少调料”“这道菜怎么调味”时使用。',
  inputSchema: z.object({
    dish_or_ingredients: z.string().describe('菜品名或主要食材，如：红烧肉、青椒肉丝、排骨500克 土豆2个'),
    servings: z.number().min(1).max(20).default(2).describe('几人份，默认 2 人份'),
    style: z
      .string()
      .optional()
      .describe('口味偏好：清淡、正常、重口，不传则根据菜品自动推断'),
  }),
  execute: async ({ dish_or_ingredients, servings, style }) => {
    const seasoningNames = detectStyle(dish_or_ingredients);
    const scale = style === '清淡' ? 0.8 : style === '重口' ? 1.2 : 1;

    const suggestions = seasoningNames.map((name) => {
      const ref = SEASONING_PER_SERVING[name];
      if (!ref) return { name, amount: '-', unit: '', note: '按口味适量' };
      const amount = Math.round(ref.amount * servings * scale * 10) / 10;
      return {
        name,
        amount: amount.toString(),
        unit: ref.unit,
        note: ref.note ?? '',
      };
    });

    return {
      dish_or_ingredients,
      servings,
      tip: '以上为参考值，可根据口味和咸淡习惯微调。',
      seasonings: suggestions,
    };
  },
});
