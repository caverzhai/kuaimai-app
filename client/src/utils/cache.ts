/**
 * 本地数据缓存工具
 * 用于APP启动时快速显示缓存数据，后台再从服务器更新
 * 同时写入localStorage和Capacitor Preferences（原生存储，确保持久化）
 */

import { Preferences } from '@capacitor/preferences';

const CACHE_PREFIX = 'kuaimai_cache_';
const PREF_PREFIX = 'kuaimai_cache_';
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 默认缓存5分钟

interface CacheItem<T> {
  data: T;
  timestamp: number;
  expireAt: number;
}

/**
 * 保存数据到本地缓存
 * 同时写入localStorage（同步，快速）和Capacitor Preferences（异步，可靠持久化）
 */
export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
  try {
    const now = Date.now();
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      expireAt: now + ttl,
    };
    const itemStr = JSON.stringify(item);

    // 1. 写入localStorage（同步，立即生效，供lazy initial state使用）
    try {
      localStorage.setItem(CACHE_PREFIX + key, itemStr);
    } catch (e) {
      console.warn('localStorage写入失败', e);
    }

    // 2. 异步写入Capacitor Preferences（原生存储，确保APP重启后数据不丢失）
    // fire-and-forget，不阻塞同步流程
    (async () => {
      try {
        const isCapacitor = (window as any).Capacitor !== undefined;
        if (isCapacitor) {
          await Preferences.set({
            key: PREF_PREFIX + key,
            value: itemStr,
          });
        }
      } catch (e) {
        console.warn('Preferences写入失败', e);
      }
    })();
  } catch (e) {
    // 缓存失败（可能是存储空间不足），静默忽略
    console.warn('缓存保存失败', e);
  }
}

/**
 * 从本地缓存读取数据
 * @param ignoreExpired 是否忽略过期时间（即使过期也返回缓存数据，用于先显示再后台更新）
 * @returns 缓存数据，如果没有缓存返回null
 */
export function getCache<T>(key: string, ignoreExpired: boolean = false): T | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;

    const item = JSON.parse(raw) as CacheItem<T>;

    // 如果忽略过期时间，直接返回缓存数据
    if (ignoreExpired) {
      return item.data;
    }

    // 检查是否过期
    const now = Date.now();
    if (now > item.expireAt) {
      return null;
    }

    return item.data;
  } catch (e) {
    return null;
  }
}

/**
 * 检查缓存是否存在（不管是否过期）
 */
export function hasCache(key: string): boolean {
  return localStorage.getItem(CACHE_PREFIX + key) !== null;
}

/**
 * 检查缓存是否过期
 */
export function isCacheExpired(key: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return true;
    const item = JSON.parse(raw) as CacheItem<unknown>;
    return Date.now() > item.expireAt;
  } catch {
    return true;
  }
}

/**
 * 删除指定缓存
 */
export function removeCache(key: string): void {
  localStorage.removeItem(CACHE_PREFIX + key);
}

/**
 * 清除所有缓存
 */
export function clearAllCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

/**
 * 带缓存的数据加载函数
 * 先从缓存读取（立即显示），然后从服务器获取最新数据（更新显示和缓存）
 *
 * @param cacheKey 缓存键名
 * @param fetchFn 从服务器获取数据的函数
 * @param onData 数据更新回调（会调用两次：第一次缓存数据，第二次服务器数据）
 * @param ttl 缓存过期时间
 * @param skipCache 是否跳过缓存（强制从服务器获取）
 */
export async function loadWithCache<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  onData: (data: T, fromCache: boolean) => void,
  ttl: number = DEFAULT_CACHE_TTL,
  skipCache: boolean = false,
): Promise<void> {
  // 先从缓存读取
  if (!skipCache) {
    const cachedData = getCache<T>(cacheKey);
    if (cachedData !== null) {
      onData(cachedData, true);
    }
  }

  // 从服务器获取最新数据
  try {
    const freshData = await fetchFn();
    onData(freshData, false);
    setCache(cacheKey, freshData, ttl);
  } catch (error) {
    // 服务器获取失败，如果有缓存就用缓存，没有就抛出错误
    if (!skipCache && hasCache(cacheKey)) {
      // 已经在上面返回了缓存数据
      console.warn('从服务器获取数据失败，使用缓存数据', error);
    } else {
      throw error;
    }
  }
}
