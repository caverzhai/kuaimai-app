package com.kuaimai.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {

    private boolean appUpdateInjected = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 轮询注入原生接口，确保WebView完全初始化后注入
        injectInterfacesWithRetry();
    }

    /**
     * 轮询注入原生接口，最多重试10次，每次间隔300ms
     */
    private void injectInterfacesWithRetry() {
        final int[] retryCount = {0};
        final Handler handler = new Handler();
        final Runnable injectRunnable = new Runnable() {
            @Override
            public void run() {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        WebSettings webSettings = webView.getSettings();
                        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                        webSettings.setJavaScriptEnabled(true);
                        webSettings.setDomStorageEnabled(true);
                        webSettings.setDatabaseEnabled(true);

                        // 注册原生 HTTP 桥接接口
                        webView.addJavascriptInterface(new HttpBridge(), "NativeHttp");
                        // 注册 APP 更新桥接接口
                        webView.addJavascriptInterface(new AppUpdateBridge(), "AppUpdate");

                        appUpdateInjected = true;
                        android.util.Log.d("Kuaimai", "原生接口注入成功，重试次数: " + retryCount[0]);
                        return;
                    }
                } catch (Exception e) {
                    android.util.Log.e("Kuaimai", "注入失败: " + e.getMessage());
                }

                retryCount[0]++;
                if (retryCount[0] < 15) {
                    handler.postDelayed(this, 300);
                } else {
                    android.util.Log.e("Kuaimai", "注入失败，已达最大重试次数");
                }
            }
        };
        handler.post(injectRunnable);
    }

    /**
     * APP 更新桥接接口
     * JavaScript 通过 window.AppUpdate.downloadAndInstall() 调用
     */
    public class AppUpdateBridge {

        @JavascriptInterface
        public String downloadAndInstall(String apkUrl, String versionName) {
            try {
                android.util.Log.d("Kuaimai", "开始下载APK: " + apkUrl + ", 版本: " + versionName);

                // 检查安装权限
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!getPackageManager().canRequestPackageInstalls()) {
                        Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                        intent.setData(Uri.parse("package:" + getPackageName()));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return "{\"success\":false,\"message\":\"请先允许安装未知应用，然后重新点击更新\"}";
                    }
                }

                // 在后台线程下载APK
                final String finalApkUrl = apkUrl;
                final String finalVersionName = versionName;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "正在下载更新...", Toast.LENGTH_LONG).show();
                                }
                            });

                            // 用HttpURLConnection下载APK（追加时间戳参数，避免CDN/网络缓存下载到旧版本）
                            String downloadUrl = finalApkUrl;
                            String cacheSep = downloadUrl.contains("?") ? "&" : "?";
                            downloadUrl = downloadUrl + cacheSep + "t=" + System.currentTimeMillis();
                            URL url = new URL(downloadUrl);
                            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                            connection.setRequestProperty("Cache-Control", "no-cache");
                            connection.setRequestProperty("Pragma", "no-cache");
                            connection.setRequestMethod("GET");
                            connection.setConnectTimeout(30000);
                            connection.setReadTimeout(120000);
                            connection.setInstanceFollowRedirects(true);
                            connection.connect();

                            int responseCode = connection.getResponseCode();
                            if (responseCode != HttpURLConnection.HTTP_OK) {
                                throw new Exception("HTTP错误: " + responseCode);
                            }

                            int contentLength = connection.getContentLength();
                            InputStream inputStream = connection.getInputStream();

                            // 保存到文件
                            String fileName = "kuaimai_update_" + finalVersionName.replace(".", "_") + ".apk";
                            File apkFile = new File(getExternalFilesDir(null), fileName);
                            if (apkFile.exists()) {
                                apkFile.delete();
                            }

                            FileOutputStream outputStream = new FileOutputStream(apkFile);
                            byte[] buffer = new byte[8192];
                            int bytesRead;
                            long totalBytesRead = 0;
                            while ((bytesRead = inputStream.read(buffer)) != -1) {
                                outputStream.write(buffer, 0, bytesRead);
                                totalBytesRead += bytesRead;
                            }
                            outputStream.flush();
                            outputStream.close();
                            inputStream.close();
                            connection.disconnect();

                            android.util.Log.d("Kuaimai", "APK下载完成，大小: " + totalBytesRead + " 字节，文件: " + apkFile.getAbsolutePath());

                            // 下载完成，安装APK
                            installApk(apkFile.getAbsolutePath());

                        } catch (final Exception e) {
                            android.util.Log.e("Kuaimai", "下载失败: " + e.getMessage());
                            runOnUiThread(new Runnable() {
                                @Override
                                public void run() {
                                    Toast.makeText(MainActivity.this, "下载失败: " + e.getMessage() + "，请用浏览器下载", Toast.LENGTH_LONG).show();
                                }
                            });
                            // 降级：用浏览器打开下载链接
                            try {
                                Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(finalApkUrl));
                                browserIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(browserIntent);
                            } catch (Exception ex) {
                                ex.printStackTrace();
                            }
                        }
                    }
                }).start();

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

        @JavascriptInterface
        public boolean isInjected() {
            return true;
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

                if (headersJson != null && !headersJson.isEmpty()) {
                    JSONObject headersObj = new JSONObject(headersJson);
                    java.util.Iterator<String> keys = headersObj.keys();
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

                String reqMethod = method != null ? method.toUpperCase() : "GET";
                if (!reqMethod.equals("GET") && !reqMethod.equals("HEAD") && body != null) {
                    connection.setDoOutput(true);
                    byte[] bodyBytes = body.getBytes("UTF-8");
                    connection.setRequestProperty("Content-Length", String.valueOf(bodyBytes.length));
                    java.io.OutputStream os = connection.getOutputStream();
                    os.write(bodyBytes);
                    os.close();
                }

                int statusCode = connection.getResponseCode();
                String statusMessage = connection.getResponseMessage();

                java.util.Map<String, String> responseHeaders = new java.util.HashMap<>();
                for (java.util.Map.Entry<String, java.util.List<String>> entry : connection.getHeaderFields().entrySet()) {
                    if (entry.getKey() != null && entry.getValue() != null && !entry.getValue().isEmpty()) {
                        responseHeaders.put(entry.getKey(), entry.getValue().get(0));
                    }
                }

                InputStream inputStream;
                if (statusCode >= 400) {
                    inputStream = connection.getErrorStream();
                } else {
                    inputStream = connection.getInputStream();
                }

                String responseBody = "";
                if (inputStream != null) {
                    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                    byte[] data = new byte[8192];
                    int bytesRead;
                    while ((bytesRead = inputStream.read(data, 0, data.length)) != -1) {
                        buffer.write(data, 0, bytesRead);
                    }
                    buffer.flush();
                    responseBody = buffer.toString("UTF-8");
                }

                JSONObject result = new JSONObject();
                result.put("status", statusCode);
                result.put("statusText", statusMessage != null ? statusMessage : "");
                result.put("headers", new JSONObject(responseHeaders));
                result.put("data", responseBody);

                return result.toString();

            } catch (Exception e) {
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
    }
}
