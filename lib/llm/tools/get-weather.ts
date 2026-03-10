import { tool } from 'ai';
import { z } from 'zod';

const QWEATHER_KEY = process.env.QWEATHER_API_KEY;
const QWEATHER_HOST = process.env.QWEATHER_API_HOST || 'api.qweather.com'; // 未配置 Host 时用公共域名（2026 年起可能停用）

/** 和风天气：城市搜索 + 实时天气，原生支持中文 */
async function fetchWeatherQWeather(city: string): Promise<{ city: string; temp: number; desc: string }> {
  const name = city.trim();
  const geoUrl = `https://${QWEATHER_HOST}/geo/v2/city/lookup?location=${encodeURIComponent(name)}&range=cn&number=1`;
  const geoRes = await fetch(geoUrl, {
    headers: { 'X-QW-Api-Key': QWEATHER_KEY! },
    signal: AbortSignal.timeout(5000),
  });
  if (!geoRes.ok) {
    return { city: name, temp: 0, desc: `查询失败：${geoRes.status}` };
  }
  const geoData = (await geoRes.json()) as {
    code?: string;
    location?: Array<{ name: string; id: string }>;
  };
  const first = geoData.location?.[0];
  if (!first || geoData.code !== '200') {
    return { city: name, temp: 0, desc: `未找到城市：${name}` };
  }
  const weatherUrl = `https://${QWEATHER_HOST}/v7/weather/now?location=${first.id}`;
  const weatherRes = await fetch(weatherUrl, {
    headers: { 'X-QW-Api-Key': QWEATHER_KEY! },
    signal: AbortSignal.timeout(5000),
  });
  if (!weatherRes.ok) {
    return { city: first.name, temp: 0, desc: `天气接口异常：${weatherRes.status}` };
  }
  const weatherData = (await weatherRes.json()) as {
    code?: string;
    now?: { temp?: string; text?: string };
  };
  const now = weatherData.now;
  if (weatherData.code !== '200' || !now) {
    return { city: first.name, temp: 0, desc: '暂无实时天气数据' };
  }
  const temp = Number(now.temp) || 0;
  const desc = now.text || '—';
  return { city: first.name, temp, desc };
}

/** 中文城市名 → 英文名（Open-Meteo 地理编码对中文支持差） */
const CITY_ZH_TO_EN: Record<string, string> = {
  北京: 'Beijing', 上海: 'Shanghai', 广州: 'Guangzhou', 深圳: 'Shenzhen', 杭州: 'Hangzhou',
  成都: 'Chengdu', 武汉: 'Wuhan', 西安: "Xi'an", 南京: 'Nanjing', 重庆: 'Chongqing',
  天津: 'Tianjin', 苏州: 'Suzhou', 郑州: 'Zhengzhou', 长沙: 'Changsha', 沈阳: 'Shenyang',
  青岛: 'Qingdao', 宁波: 'Ningbo', 东莞: 'Dongguan', 无锡: 'Wuxi', 厦门: 'Xiamen',
  济南: 'Jinan', 哈尔滨: 'Harbin', 福州: 'Fuzhou', 大连: 'Dalian', 昆明: 'Kunming',
  合肥: 'Hefei', 石家庄: 'Shijiazhuang', 南昌: 'Nanchang', 长春: 'Changchun',
  太原: 'Taiyuan', 南宁: 'Nanning', 贵阳: 'Guiyang', 兰州: 'Lanzhou', 海口: 'Haikou',
  乌鲁木齐: 'Urumqi', 银川: 'Yinchuan', 西宁: 'Xining', 拉萨: 'Lhasa', 呼和浩特: 'Hohhot',
  香港: 'Hong Kong', 澳门: 'Macau', 台北: 'Taipei', 高雄: 'Kaohsiung', 台中: 'Taichung',
};

function weatherCodeToDesc(code: number): string {
  const map: Record<number, string> = {
    0: '晴', 1: '大部晴朗', 2: '局部多云', 3: '多云', 45: '雾', 48: '雾凇',
    51: '毛毛雨', 53: '毛毛雨', 55: '毛毛雨', 61: '小雨', 63: '中雨', 65: '大雨',
    71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒', 80: '阵雨', 81: '阵雨', 82: '强阵雨',
    85: '阵雪', 86: '强阵雪', 95: '雷暴', 96: '雷暴伴小冰雹', 99: '雷暴伴大冰雹',
  };
  return map[code] ?? `天气代码 ${code}`;
}

/** Open-Meteo：无 key，需英文城市名或内置映射 */
async function fetchWeatherOpenMeteo(city: string): Promise<{ city: string; temp: number; desc: string }> {
  const searchName = CITY_ZH_TO_EN[city.trim()] ?? city;
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchName)}&count=1`,
    { signal: AbortSignal.timeout(5000) }
  );
  const geoData = (await geoRes.json()) as {
    results?: Array<{ latitude: number; longitude: number; name: string }>;
  };
  const first = geoData.results?.[0];
  if (!first) {
    return { city, temp: 0, desc: `未找到城市：${city}` };
  }
  const forecastRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${first.latitude}&longitude=${first.longitude}&current=temperature_2m,weather_code`,
    { signal: AbortSignal.timeout(5000) }
  );
  const forecast = (await forecastRes.json()) as {
    current?: { temperature_2m?: number; weather_code?: number };
  };
  const temp = forecast.current?.temperature_2m ?? 0;
  const code = forecast.current?.weather_code ?? 0;
  return { city: first.name, temp, desc: weatherCodeToDesc(code) };
}

async function fetchWeather(city: string): Promise<{ city: string; temp: number; desc: string }> {
  if (QWEATHER_KEY) {
    return fetchWeatherQWeather(city);
  }
  return fetchWeatherOpenMeteo(city);
}

/** 查询指定城市天气（优先和风天气-中文，未配置 key 时用 Open-Meteo） */
export const getWeatherTool = tool({
  description: '查询指定城市的当前天气（温度与天气现象）。当用户问某地天气时使用。支持中文城市名，如：北京、上海、深圳。',
  inputSchema: z.object({
    city: z.string().describe('城市名称，如：北京、上海、深圳'),
  }),
  execute: async ({ city }) => fetchWeather(city),
});
