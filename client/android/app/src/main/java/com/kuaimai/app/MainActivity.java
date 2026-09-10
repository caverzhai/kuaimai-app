package com.kuaimai.app;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

public class MainActivity extends BridgeActivity {

    private long downloadId = -1;
    private String apkFilePath = null;
    private BroadcastReceiver downloadReceiver = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 立即注册原生HTTP桥接接口（必须在页面加载前注册）
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings webSettings = webView.getSettings();
                webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                webSettings.setJavaScriptEnabled(true);
                webSettings.setDomStorageEnabled(true);
                webSettings.setDatabaseEnabled(true);

                // 注册原生 HTTP 桥接接口，完全绕过 WebView 的 CORS 限制
                webView.addJavascriptInterface(new HttpBridge(), "NativeHttp");
                // 注册 APP 更新桥接接口
                webView.addJavascriptInterface(new AppUpdateBridge(), "AppUpdate");
            }
        } catch (Exception e) {
            // 忽略配置错误
        }

        // 注册下载完成广播接收器（用成员变量持有，防止被GC回收）
        try {
            downloadReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    try {
                        long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                        if (id == downloadId && apkFilePath != null) {
                            // 检查下载是否成功
                            DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                            DownloadManager.Query query = new DownloadManager.Query();
                            query.setFilterById(id);
                            android.database.Cursor cursor = downloadManager.query(query);
                            if (cursor.moveToFirst()) {
                                int status = cursor.getInt(cursor.getColumnIndex(DownloadManager.COLUMN_STATUS));
                                cursor.close();
                                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                                    installApk(apkFilePath);
                                } else {
                                    runOnUiThread(() -> {
                                        Toast.makeText(MainActivity.this, "下载失败，请重试", Toast.LENGTH_LONG).show();
                                    });
                                }
                            } else {
                                cursor.close();
                                installApk(apkFilePath);
                            }
                        }
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            };
            registerReceiver(downloadReceiver, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    /**
     * APP 更新桥接接口
     * JavaScript 通过 window.AppUpdate.downloadAndInstall() 调用
     */
    public class AppUpdateBridge {

        @JavascriptInterface
        public String downloadAndInstall(String apkUrl, String versionName) {
            try {
                // 检查安装权限
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!getPackageManager().canRequestPackageInstalls()) {
                        // 跳转到安装权限设置页面
                        Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return "{\"success\":false,\"message\":\"请先允许安装未知应用\"}";
                    }
                }

                // 创建下载请求
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(apkUrl));
                request.setTitle("快卖 APP 更新");
                request.setDescription("正在下载版本 " + versionName);
                request.setMimeType("application/vnd.android.package-archive");
                request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);

                // 设置保存路径
                String fileName = "kuaimai_" + versionName.replace(".", "_") + ".apk";
                File apkFile = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName);
                apkFilePath = apkFile.getAbsolutePath();
                request.setDestinationUri(Uri.fromFile(apkFile));

                // 如果文件已存在，先删除
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                // 开始下载
                DownloadManager downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                downloadId = downloadManager.enqueue(request);

                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this, "开始下载更新...", Toast.LENGTH_LONG).show();
                });

                return "{\"success\":true,\"message\":\"开始下载\"}";
            } catch (Exception e) {
                e.printStackTrace();
                return "{\"success\":false,\"message\":\"" + e.getMessage() + "\"}";
            }
        }

        @JavascriptInterface
        public String getCurrentVersion() {
            try {
                String versionName = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
                int versionCode = getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
                return "{\"versionName\":\"" + versionName + "\",\"versionCode\":" + versionCode + "}";
            } catch (Exception e) {
                return "{\"versionName\":\"unknown\",\"versionCode\":0}";
            }
        }
    }

    private void installApk(String filePath) {
        try {
            File apkFile = new File(filePath);
            if (!apkFile.exists()) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "安装文件不存在", Toast.LENGTH_LONG).show();
                });
                return;
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                // Android 7.0+ 使用 FileProvider
                Uri apkUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    apkFile
                );
                intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                intent.setDataAndType(Uri.fromFile(apkFile), "application/vnd.android.package-archive");
            }

            startActivity(intent);
        } catch (Exception e) {
            e.printStackTrace();
            runOnUiThread(() -> {
                Toast.makeText(this, "安装失败: " + e.getMessage(), Toast.LENGTH_LONG).show();
            });
        }
    }

    /**
     * 原生 HTTP 桥接接口
     * JavaScript 通过 window.NativeHttp.request() 调用
     * 完全通过原生层发起请求，不存在 CORS 限制
     */
    public class HttpBridge {

        @JavascriptInterface
        public String request(String urlStr, String method, String headersJson, String body) {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(urlStr);
                connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod(method != null ? method.toUpperCase() : "GET");
                connection.setConnectTimeout(30000);
                connection.setReadTimeout(30000);
                connection.setInstanceFollowRedirects(true);

                // 设置请求头
                if (headersJson != null && !headersJson.isEmpty()) {
                    JSONObject headersObj = new JSONObject(headersJson);
                    Iterator<String> keys = headersObj.keys();
                    while (keys.hasNext()) {
                        String key = keys.next();
                        String value = headersObj.optString(key, "");
                        if (!key.equalsIgnoreCase("Content-Length") &&
                            !key.equalsIgnoreCase("Host") &&
                            !key.equalsIgnoreCase("Connection")) {
                            connection.setRequestProperty(key, value);
                        }
                    }
                }

                // 处理请求体
                String reqMethod = method != null ? method.toUpperCase() : "GET";
                if (!reqMethod.equals("GET") && !reqMethod.equals("HEAD") && body != null) {
                    connection.setDoOutput(true);
                    byte[] bodyBytes = body.getBytes("UTF-8");
                    connection.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
                    OutputStream os = connection.getOutputStream();
                    os.write(bodyBytes);
                    os.close();
                }

                int statusCode = connection.getResponseCode();
                String statusMessage = connection.getResponseMessage();

                // 获取响应头
                Map<String, String> responseHeaders = new HashMap<>();
                for (Map.Entry<String, java.util.List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty()) {
                        responseHeaders.put(entry.getKey(), entry.getValue().get(0));
                    }
                }

                // 获取响应体
                InputStream inputStream;
                if (statusCode >= 400) {
                    inputStream = connection.getErrorStream();
                } else {
                    inputStream = connection.getInputStream();
                }

                String responseBody = "";
                if (inputStream != null) {
                    responseBody = readAll(inputStream);
                }

                // 构造响应 JSON
                JSONObject result = new JSONObject();
                result.put("status", statusCode);
                result.put("statusText", statusMessage != null ? statusMessage : "");
                result.put("headers", new JSONObject(responseHeaders));
                result.put("data", responseBody);

                return result.toString();

            } catch (Exception e) {
                // 返回错误响应
                try {
                    JSONObject errorResult = new JSONObject();
                    errorResult.put("status", 0);
                    errorResult.put("statusText", "Network Error");
                    errorResult.put("headers", new JSONObject());
                    errorResult.put("data", "{\"message\":\"" + e.getMessage() + "\"}");
                    return errorResult.toString();
                } catch (Exception ex) {
                    return "{\"status\":0,\"statusText\":\"Error\",\"headers\":{},\"data\":\"{}\"}";
                }
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }

        private String readAll(InputStream inputStream) throws IOException {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
                buffer.write(data, 0, bytesRead);
            }
            buffer.flush();
            return buffer.toString("UTF-8");
        }
    }
}
