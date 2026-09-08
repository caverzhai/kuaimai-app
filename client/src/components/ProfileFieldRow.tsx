import { memo, useRef, useState } from 'react';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import { Loader2, Upload, Image as ImageIcon } from 'lucide-react';

interface FieldRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  placeholder?: string;
  maxLength?: number;
  numericOnly?: boolean;
  options?: { value: string; label: string }[];
}

export const FieldRow = memo(function FieldRow({
  icon: Icon,
  label,
  value,
  editing,
  onChange,
  type = 'text',
  textarea = false,
  placeholder,
  maxLength,
  numericOnly = false,
  options,
}: FieldRowProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (numericOnly) {
      val = val.replace(/\D/g, '');
    }
    if (maxLength) {
      val = val.slice(0, maxLength);
    }
    onChange(val);
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        {editing ? (
          textarea ? (
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              rows={3}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 resize-none"
            />
          ) : options ? (
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 bg-white"
            >
              <option value="">请选择</option>
              {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              value={value}
              onChange={handleInputChange}
              placeholder={placeholder}
              maxLength={maxLength}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
            />
          )
        ) : (
          <p className="text-sm text-gray-900 break-words">
            {value || <span className="text-gray-400">未填写</span>}
          </p>
        )}
      </div>
    </div>
  );
});

interface ImageFieldRowProps {
  icon: React.ElementType;
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  required?: boolean;
}

export const ImageFieldRow = memo(function ImageFieldRow({
  icon: Icon,
  label,
  value,
  editing,
  onChange,
  required = false,
}: ImageFieldRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      // 读取文件为 base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });

      // 上传到服务器
      const response = await axiosForBackend.post('/api/upload/image', { base64 });
      if (!response.data.success) {
        throw new Error(response.data.message || '上传失败');
      }

      onChange(response.data.url);
    } catch (err) {
      console.error('图片上传失败', err);
      setUploadError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-b-0">
      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0 mt-0.5">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </p>
        {editing ? (
          <div className="space-y-2">
            {/* 图片预览 */}
            {value && (
              <img
                src={value}
                alt={label}
                className="w-32 h-32 object-cover rounded-lg border border-gray-200"
              />
            )}
            {/* 上传按钮 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 rounded-lg text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {value ? '重新上传' : '从相册选择'}
                </>
              )}
            </button>
            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}
          </div>
        ) : value ? (
          <img
            src={value}
            alt={label}
            className="w-32 h-32 object-cover rounded-lg border border-gray-100"
          />
        ) : (
          <div className="flex items-center gap-2 text-gray-400">
            <ImageIcon className="w-4 h-4" />
            <span className="text-sm">未上传</span>
          </div>
        )}
      </div>
    </div>
  );
});
