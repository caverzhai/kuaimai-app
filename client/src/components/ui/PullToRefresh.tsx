import {
  ReactNode,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';
import { Loader2, ArrowDown } from 'lucide-react';

type PullToRefreshProps = {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  /** 触发刷新的下拉距离阈值（px） */
  threshold?: number;
  /** 是否启用（默认 true；桌面端无触摸时可关闭） */
  enabled?: boolean;
};

/**
 * 移动端下拉刷新：
 * - 仅当内容滚动到顶部（scrollTop<=0）继续向下拉时才生效，不影响正常滚动；
 * - 阻尼 0.5，到达阈值显示“松开立即刷新”；
 * - 刷新期间旧内容始终保留，绝不白屏、不打断。
 */
export function PullToRefresh({
  onRefresh,
  children,
  threshold = 60,
  enabled = true,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(
      'ontouchstart' in window ||
        (navigator as Navigator).maxTouchPoints > 0,
    );
  }, []);

  const getScrollTop = useCallback(() => {
    // 找到最近的可滚动容器（Layout 主内容区），否则用页面滚动
    const el = document.scrollingElement as HTMLElement | null;
    return el ? el.scrollTop : 0;
  }, []);

  const onTouchStart = useCallback(
    (e: TouchEvent) => {
      if (!enabled || refreshing) return;
      if (getScrollTop() <= 2) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = false;
      } else {
        startYRef.current = null;
      }
    },
    [enabled, refreshing, getScrollTop],
  );

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!enabled || refreshing || startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta > 0 && getScrollTop() <= 2) {
        // 进入下拉
        if (!pullingRef.current) pullingRef.current = true;
        const damped = Math.min(delta * 0.5, 100);
        setPullDistance(damped);
        // 阻止页面滚动，使下拉手势不带动页面
        if (e.cancelable) e.preventDefault();
      }
    },
    [enabled, refreshing, getScrollTop],
  );

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    setPullDistance(0);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      startYRef.current = null;
      pullingRef.current = false;
    }
  }, [onRefresh]);

  const onTouchEnd = useCallback(() => {
    if (!enabled || refreshing || startYRef.current === null) {
      setPullDistance(0);
      return;
    }
    if (pullDistance >= threshold) {
      doRefresh();
    } else {
      setPullDistance(0);
    }
    startYRef.current = null;
    pullingRef.current = false;
  }, [enabled, refreshing, pullDistance, threshold, doRefresh]);

  useEffect(() => {
    if (!enabled) return;
    const el = document;
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [enabled, onTouchStart, onTouchMove, onTouchEnd]);

  const indicator = refreshing || pullDistance > 0;
  const canRelease = pullDistance >= threshold;

  return (
    <div
      style={{
        transform: indicator && !refreshing ? `translateY(${pullDistance}px)` : undefined,
        transition: pullingRef.current && !refreshing ? 'none' : 'transform 0.25s ease',
      }}
    >
      <div
        className="flex items-center justify-center overflow-hidden text-xs text-gray-400"
        style={{ height: refreshing ? 40 : pullDistance > 0 ? pullDistance : 0 }}
      >
        {refreshing ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            正在刷新…
          </span>
        ) : (
          <span
            className={`flex items-center gap-1.5 ${canRelease ? 'text-orange-500' : ''}`}
          >
            <ArrowDown
              className={`w-4 h-4 transition-transform ${canRelease ? 'rotate-180' : ''}`}
            />
            {canRelease ? '松开立即刷新' : '下拉刷新'}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
