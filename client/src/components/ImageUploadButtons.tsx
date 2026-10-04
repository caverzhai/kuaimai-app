import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera, Image as ImageIcon, Loader2, Upload } from 'lucide-react';

interface ImageUploadButtonsProps {
  onFileSelected: (file: File) => void;
  uploading?: boolean;
  /** 上传中文字，默认"上传中..." */
  uploadingLabel?: string;
  /** 按钮文字，默认"上传付款截图" */
  label?: string;
  /** 是否用整行橙色按钮样式，默认 true */
  primary?: boolean;
  className?: string;
  icon?: ReactNode;
  /** 上传区警示文字，默认"上传假图，立即封号。"；传 null 关闭 */
  warning?: string | null;
}

/**
 * 图片上传按钮组：
 * - 原生 APP：显示"拍照上传"和"相册选择"两个按钮
 * - Web：显示单个"选择图片上传"按钮（浏览器自行弹出相机/相册选择）
 */
export function ImageUploadButtons({
  onFileSelected,
  uploading = false,
  uploadingLabel = '上传中...',
  label = '上传付款截图',
  primary = true,
  className = '',
  icon,
  warning,
}: ImageUploadButtonsProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const isNative = Capacitor.isNativePlatform();

  const makeHandler = (inputRef: React.RefObject<HTMLInputElement | null>) => {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFileSelected(file);
      }
      // 重置 value 以便可以重复选择同一文件
      if (inputRef.current) inputRef.current.value = '';
    };
  };

  const baseBtn =
    'w-full h-11 flex items-center justify-center font-medium rounded-xl transition-colors disabled:opacity-60';
  const primaryBtn = 'bg-orange-500 hover:bg-orange-600 text-white';
  const secondaryBtn = 'bg-white border border-orange-500 text-orange-600 hover:bg-orange-50';

  const renderContent = (withCameraIcon: boolean) => {
    if (uploading) {
      return (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {uploadingLabel}
        </>
      );
    }
    return (
      <>
        {icon ??
          (withCameraIcon ? (
            <Camera className="w-4 h-4 mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          ))}
        {label}
      </>
    );
  };

  const warningText: string | null =
    warning === undefined ? '上传假图，立即封号。' : warning;

  return (
    <div className={className}>
      {warningText && (
        <p className="w-full text-xs text-red-600 font-medium mb-2 text-center">
          {warningText}
        </p>
      )}
      {isNative ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className={`${baseBtn} ${primaryBtn}`}
          >
            {renderContent(true)}
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={uploading}
            className={`${baseBtn} ${secondaryBtn}`}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            从相册选择
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className={`${baseBtn} ${primary ? primaryBtn : secondaryBtn}`}
        >
          {renderContent(false)}
        </button>
      )}

      {/* 拍照 input（仅原生环境使用） */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={makeHandler(cameraInputRef)}
        className="hidden"
      />
      {/* 相册 input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={makeHandler(galleryInputRef)}
        className="hidden"
      />
    </div>
  );
}
