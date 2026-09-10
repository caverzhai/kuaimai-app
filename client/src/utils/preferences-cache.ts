import { Preferences } from '@capacitor/preferences';

/**
 * 原生Preferences缓存工具
 * 使用Capacitor Preferences插件进行可靠的持久化存储
 * 同时同步到内存缓存，支持同步快速访问
 */

const PREF_PREFIX = 'kuaimai_cache_';

// 内存缓存（同步访问，快速）
const memoryCache: Map<string, { data: unknown; expireAt: number }> = new Map();

// 标记是否已经从Preferences加载了数据
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 从Preferences加载所有缓存数据到内存
 * 在App启动时调用一次
 */
export async function initPreferencesCache(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 检查是否在Capacitor环境中
      const isCapacitor = (window as any).Capacitor !== undefined;
      if (!isCapacitor) {
        // 网页环境，从localStorage加载到内存
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('kuaimai_cache_')) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const item = JSON.parse(raw);
                const cleanKey = key.replace('kuaimai_cache_', '');
                memoryCache.set(cleanKey, { data: item.data, expireAt: item.expireAt });
              }
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
        isInitialized = true;
        return;
      }

      // Capacitor环境，从Preferences加载
      const keysResult = await Preferences.keys();
      const cacheKeys = keysResult.keys.filter((k) => k.startsWith(PREF_PREFIX));

      for (const key of cacheKeys) {
        try {
          const result = await Preferences.get({ key });
          if (result.value) {
            const item = JSON.parse(result.value);
            const cleanKey = key.replace(PREF_PREFIX, '');
            memoryCache.set(cleanKey, { data: item.data, expireAt: item.expireAt });
            // 同时同步到localStorage，供lazy initial state使用
            try {
              localStorage.setItem('kuaimai_cache_' + cleanKey, result.value);
            } catch (e) {
              // localStorage可能空间不足，忽略
            }
          }
        } catch (e) {
          // 忽略单个键的错误
        }
      }

      isInitialized = true;
      console.log(`[PreferencesCache] 已加载 ${cacheKeys.length} 个缓存项到内存`);
    } catch (e) {
      console.error('[PreferencesCache] 初始化失败', e);
      isInitialized = true; // 标记为已初始化，避免重复尝试
    }
  })();

  return initPromise;
}

/**
 * 从内存缓存同步读取数据（支持lazy initial state）
 * @param ignoreExpired 是否忽略过期时间
 */
export function getFromMemoryCache<T>(key: string, ignoreExpired: boolean = false): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;

  if (ignoreExpired) {
    return item.data as T;
  }

  if (Date.now() > item.expireAt) {
    return null;
  }

  return item.data as T;
}

/**
 * 写入缓存（同时写入内存、localStorage和Preferences）
 */
export async function setPersistentCache<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): Promise<void> {
  const expireAt = Date.now() + ttl;
  const item = { data, expireAt };
  const itemStr = JSON.stringify(item);

  // 1. 写入内存缓存（同步，立即生效）
  memoryCache.set(key, item);

  // 2. 写入localStorage（同步，供lazy initial state使用）
  try {
    localStorage.setItem('kuaimai_cache_' + key, itemStr);
  } catch (e) {
    // localStorage可能空间不足，忽略
  }

  // 3. 写入Preferences（异步，可靠持久化）
  try {
    const isCapacitor = (window as any).Capacitor !== undefined;
    if (isCapacitor) {
      await Preferences.set({
        key: PREF_PREFIX + key,
        value: itemStr,
      });
    }
  } catch (e) {
    console.error('[PreferencesCache] 写入Preferences失败', e);
  }
}

/**
 * 检查是否已初始化
 */
export function isPreferencesCacheInitialized(): boolean {
  return isInitialized;
}
