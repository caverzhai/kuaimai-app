import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

type PreviewState = { urls: string[]; index: number } | null;

interface ImagePreviewContextValue {
  previewImage: (url: string) => void;
  previewImages: (urls: string[], index?: number) => void;
}

const ImagePreviewContext = createContext<ImagePreviewContextValue | null>(null);

// 任意页面/组件调用该 hook，即可在 App 内全屏预览图片，不跳系统浏览器
export function useImagePreview(): ImagePreviewContextValue {
  const v = useContext(ImagePreviewContext);
  if (!v) throw new Error('useImagePreview 必须在 ImagePreviewProvider 内使用');
  return v;
}

export const ImagePreviewProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PreviewState>(null);
  const [zoom, setZoom] = useState(false);

  const previewImage = useCallback((url: string) => {
    if (url) setState({ urls: [url], index: 0 });
  }, []);

  const previewImages = useCallback((urls: string[], index = 0) => {
    const list = (urls || []).filter(Boolean);
    if (list.length) {
      setState({ urls: list, index: Math.min(Math.max(index, 0), list.length - 1) });
    }
  }, []);

  const close = useCallback(() => setState(null), []);

  const go = useCallback((d: number) => {
    setState((s) => {
      if (!s) return s;
      const n = s.index + d;
      if (n < 0 || n >= s.urls.length) return s;
      return { ...s, index: n };
    });
  }, []);

  // 切换图片时重置缩放
  useEffect(() => {
    setZoom(false);
  }, [state?.index, state?.urls]);

  // 物理/外接键盘：ESC 关闭，方向键切换
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close, go]);

  const currentUrl = state ? state.urls[state.index] : null;

  return (
    <ImagePreviewContext.Provider value={{ previewImage, previewImages }}>
      {children}
      {state && currentUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/95 overflow-auto"
          onClick={close}
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            aria-label="关闭"
            className="fixed top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center z-[210]"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
          >
            <X className="w-6 h-6" />
          </button>

          {/* 多图左右切换 */}
          {state.urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一张"
                disabled={state.index === 0}
                className="fixed left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center z-[210] disabled:opacity-30"
                onClick={(e) => {
                  e.stopPropagation();
                  go(-1);
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                aria-label="下一张"
                disabled={state.index === state.urls.length - 1}
                className="fixed right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center z-[210] disabled:opacity-30"
                onClick={(e) => {
                  e.stopPropagation();
                  go(1);
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <div className="fixed bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm z-[210]">
                {state.index + 1} / {state.urls.length}
              </div>
            </>
          )}

          {/* 图片：双击在“适配屏幕 / 原始尺寸（可滚动查看细节）”间切换 */}
          <div className="min-w-full min-h-full flex">
            <img
              key={currentUrl}
              src={currentUrl}
              alt="图片预览"
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setZoom((z) => !z);
              }}
              className={
                'm-auto block select-none ' +
                (zoom
                  ? 'max-w-none max-h-none cursor-zoom-out'
                  : 'max-w-[100vw] max-h-[100vh] object-contain cursor-zoom-in')
              }
            />
          </div>
        </div>
      )}
    </ImagePreviewContext.Provider>
  );
};

export default ImagePreviewProvider;
