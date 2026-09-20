import { useState, useEffect, useCallback, useRef } from 'react';
import { getCache, setCache } from './cache';

/**
 * 带本地缓存的状态Hook
 * 组件初始化时立即从缓存读取数据作为初始状态，然后后台从服务器更新
 *
 * @param cacheKey 缓存键名
 * @param fetchFn 从服务器获取数据的函数
 * @param initialValue 初始值（缓存不存在时使用）
 * @param options 配置选项
 * @returns [data, loading, error, refresh]
 */
export function useCachedState<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  initialValue: T,
  options: {
    cacheFirst?: boolean; // 是否优先使用缓存（默认true）
    autoRefresh?: boolean; // 是否自动从服务器刷新（默认true）
    refreshInterval?: number; // 自动刷新间隔（毫秒，0表示不自动刷新）
    onError?: (error: Error) => void;
  } = {},
) {
  const {
    cacheFirst = true,
    autoRefresh = true,
    refreshInterval = 0,
    onError,
  } = options;

  // 关键：使用lazy initial state，在组件第一次渲染时就从缓存读取数据
  // 这样页面一显示就有内容，不会白屏
  const [data, setData] = useState<T>(() => {
    if (cacheFirst) {
      try {
        const cached = getCache<T>(cacheKey, true); // ignoreExpired=true，即使过期也先显示
        if (cached !== null) {
          return cached;
        }
      } catch (e) {
        console.warn('读取缓存失败', e);
      }
    }
    return initialValue;
  });

  const [loading, setLoading] = useState<boolean>(!cacheFirst || data === initialValue);
  const [error, setError] = useState<Error | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const refresh = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      setError(null);
      const freshData = await fetchFnRef.current();
      setData(freshData);
      // 写入缓存
      try {
        setCache(cacheKey, freshData);
      } catch (e) {
        console.warn('写入缓存失败', e);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, onError]);

  // 组件挂载后自动从服务器刷新
  useEffect(() => {
    if (autoRefresh) {
      refresh(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 自动刷新间隔
  useEffect(() => {
    if (refreshInterval > 0) {
      const timer = setInterval(() => {
        refresh(false);
      }, refreshInterval);
      return () => clearInterval(timer);
    }
  }, [refreshInterval, refresh]);

  return { data, setData, loading, error, refresh };
}

/**
 * 手动更新缓存数据（不触发服务器请求）
 */
export function updateCacheData<T>(cacheKey: string, data: T) {
  try {
    setCache(cacheKey, data);
  } catch (e) {
    console.warn('更新缓存失败', e);
  }
}
