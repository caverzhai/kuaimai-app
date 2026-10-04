/**
 * 统一解析接口 / 操作错误，返回"明确说明问题 + 下一步怎么做"的中文提示，
 * 避免用户只看到"加载失败 / 操作失败"而不知所措。
 * 兼容 lark-shim（axiosForBackend）封装的错误对象，也兼容标准 axios 错误。
 *
 * @param e catch 到的错误对象（任意类型）
 * @param action 正在执行的动作描述，如"加载订单列表""提交订单""上传图片"，
 *               会拼进提示，让用户知道是哪一步出了问题。
 */
export function getErrorMessage(e: unknown, action = '操作'): string {
  const err = e as any;
  const act = action && action.trim() ? action.trim() : '操作';

  // 1) 优先取后端返回的明确业务消息（NestJS：{ statusCode, message, error }）
  let backendMsg = '';
  const status: number | undefined = err?.response?.status ?? err?.status;
  const data = err?.response?.data;

  if (data) {
    let parsed: any = data;
    // lark-shim 把响应体原样文本放在 response.data
    if (typeof data === 'string') {
      try {
        parsed = JSON.parse(data);
      } catch {
        parsed = null;
      }
    }
    if (parsed?.message) {
      backendMsg = Array.isArray(parsed.message)
        ? parsed.message.join('；')
        : String(parsed.message);
    } else if (parsed?.error?.message) {
      // 全局异常过滤器包装结构：{ error: { code, message, details } }
      backendMsg = String(parsed.error.message);
    } else if (
      typeof data === 'string' &&
      data.trim() &&
      !data.trim().startsWith('<') &&
      !/^https?:\/\//i.test(data.trim())
    ) {
      backendMsg = data.trim();
    }
  }

  // 封装层可能已把后端消息提取到 error.message（排除网络/超时类原生消息）
  if (
    !backendMsg &&
    err?.message &&
    !/network error|failed to fetch|fetch failed|timeout|超时|load failed|networkrequestfailure/i.test(
      String(err.message),
    )
  ) {
    backendMsg = String(err.message);
  }

  if (backendMsg) return backendMsg;

  // 2) 没有后端消息时，按状态码给出明确、可操作的提示
  if (status === 400) {
    return `${act}失败：填写或提交的内容有误，请按页面提示核对后重新提交`;
  }
  if (status === 401) {
    return '登录状态已过期，请重新登录后，再继续刚才的操作';
  }
  if (status === 403) {
    return `${act}失败：您的账号没有执行该操作的权限，请勿操作他人内容`;
  }
  if (status === 404) {
    return `${act}失败：相关内容不存在或已被删除，请返回刷新后重试`;
  }
  if (status === 409) {
    return `${act}失败：内容刚被改动或存在冲突，请刷新获取最新内容后重试`;
  }
  if (status === 413) {
    return `${act}失败：图片或文件过大，请压缩到 720×720 以内后重新上传`;
  }
  if (typeof status === 'number' && status >= 500) {
    return `${act}失败：服务器暂时繁忙或正在维护，请稍等 1～2 分钟后重试；若一直如此请联系平台客服`;
  }

  // 3) 网络 / 超时类（无 HTTP 状态码）
  const m = String(err?.message ?? '');
  if (/timeout|超时/i.test(m)) {
    return `${act}超时：当前网络较慢或服务器响应慢，请切换 Wi-Fi/流量，或到信号好的地方后重试`;
  }
  if (/network error|failed to fetch|fetch failed|load failed|networkrequestfailure|网络|offline/i.test(m)) {
    return '无法连接服务器（网络不通）：请检查手机是否联网，尝试切换 Wi-Fi/流量，或开启飞行模式再关闭后重试';
  }
  return `${act}失败：请检查网络后重试；若多次仍失败，请联系平台客服处理`;
}
