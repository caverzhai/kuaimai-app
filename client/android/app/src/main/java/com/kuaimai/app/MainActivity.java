package com.kuaimai.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.Manifest;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
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
    private static final int REQ_CAMERA = 1001;
    private String pendingCameraCallback = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 轮询注入原生接口，确保WebView完全初始化后注入
        injectInterfacesWithRetry();
    }

    @Override
    public void onResume() {
        super.onResume();

        // 收款服务原生层兜底：用户已开启则每次回前台直接确保运行
        // （切号 / 服务被系统杀掉 / JS 桥未就绪等情况下，不依赖前端也能立即拉起）
        try {
            android.content.SharedPreferences sp =
                getSharedPreferences(CollectMonitorService.PREFS, Context.MODE_PRIVATE);
            boolean enabled = sp.getBoolean(CollectMonitorService.KEY_ENABLED, false);
            String token = sp.getString(CollectMonitorService.KEY_TOKEN, null);
            if (enabled && token != null && token.length() > 0) {
                CollectMonitorService.start(MainActivity.this, token);
            }
        } catch (Exception ignored) {}

        // 兜底：如果 onCreate 时注入失败（WebView 未就绪），回到前台时重试
        if (!appUpdateInjected) {
            android.util.Log.d("Kuaimai", "onResume 检测到原生接口未注入，重新尝试");
            injectInterfacesWithRetry();
        }
    }

    /**
     * 轮询原生接口注入，最多重试60次，每次间隔500ms（共30秒）
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
                        // 性能优化：缓存策略
                        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
                        webSettings.setAllowFileAccess(true);
                        webSettings.setAllowContentAccess(true);
                        webSettings.setLoadsImagesAutomatically(true);
                        webSettings.setBlockNetworkImage(false);
                        webSettings.setMediaPlaybackRequiresUserGesture(false);
                        // 启用硬件加速
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                            webView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);
                        }

                        // 注册原生 HTTP 桥接接口
                        webView.addJavascriptInterface(new HttpBridge(), "NativeHttp");
                        // 注册 APP 更新桥接接口
                        webView.addJavascriptInterface(new AppUpdateBridge(), "AppUpdate");
                        // 注册权限请求桥接接口
                        webView.addJavascriptInterface(new PermissionBridge(), "NativePermission");
                        // 注册收款提醒前台服务桥接接口
                        webView.addJavascriptInterface(new CollectBridge(), "CollectMonitor");

                        appUpdateInjected = true;
                        android.util.Log.d("Kuaimai", "原生接口注入成功，重试次数: " + retryCount[0]);
                        return;
                    }
                } catch (Exception e) {
                    android.util.Log.e("Kuaimai", "注入失败: " + e.getMessage());
                }

                retryCount[0]++;
                if (retryCount[0] < 60) {
                    handler.postDelayed(this, 500);
                } else {
                    android.util.Log.e("Kuaimai", "注入失败，已达最大重试次数(60次/30秒)");
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

    /**
     * 权限请求桥接接口
     */
    public class PermissionBridge {
        @JavascriptInterface
        public boolean hasCameraPermission() {
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestCameraPermission(final String callbackId) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        notifyPermissionResult(callbackId, true);
                        return;
                    }
                    pendingCameraCallback = callbackId;
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.CAMERA}, REQ_CAMERA);
                }
            });
        }
    }

    private void notifyPermissionResult(final String callbackId, final boolean granted) {
        final WebView wv = getBridge().getWebView();
        if (wv == null) return;
        wv.post(new Runnable() {
            @Override
            public void run() {
                wv.evaluateJavascript(
                        "window.__onNativePermissionResult && window.__onNativePermissionResult('"
                                + callbackId + "'," + granted + ")", null);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CAMERA) {
            boolean granted = grantResults.length > 0
                    && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (pendingCameraCallback != null) {
                notifyPermissionResult(pendingCameraCallback, granted);
                pendingCameraCallback = null;
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

    /**
     * 收款提醒桥接接口：JavaScript 通过 window.CollectMonitor 调用
     */
    public class CollectBridge {
        @JavascriptInterface
        public void start(String token) {
            CollectMonitorService.start(MainActivity.this, token);
        }

        @JavascriptInterface
        public void stop() {
            Intent i = new Intent(MainActivity.this, CollectMonitorService.class)
                    .setAction(CollectMonitorService.ACTION_STOP);
            startService(i);
        }

        @JavascriptInterface
        public void clearAlerts() {
            Intent i = new Intent(MainActivity.this, CollectMonitorService.class)
                    .setAction(CollectMonitorService.ACTION_CLEAR);
            startService(i);
        }

        // SSE 前台实时收款：JS 把通知 JSON 交给服务（ringed 去重后发声 / 震动 / 系统通知）
        @JavascriptInterface
        public void showNow(String json) {
            CollectMonitorService.relayRealtime(MainActivity.this, json);
        }

        @JavascriptInterface
        public boolean isEnabled() {
            return getSharedPreferences(CollectMonitorService.PREFS, 0)
                    .getBoolean(CollectMonitorService.KEY_ENABLED, false);
        }

        @JavascriptInterface
        public void playTest() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    android.content.SharedPreferences sp =
                        getSharedPreferences("kuaimai_collect", android.content.Context.MODE_PRIVATE);
                    String custom = sp.getString("sound_uri", null);
                    Uri s = (custom != null && custom.length() > 0)
                        ? Uri.parse(custom)
                        : Uri.parse("android.resource://" + getPackageName()
                            + "/raw/ai_kuaimai_collect");
                    android.media.Ringtone r = android.media.RingtoneManager.getRingtone(MainActivity.this, s);
                    if (r != null) r.play();
                }
            });
        }

        @JavascriptInterface
        public boolean hasNotifyPermission() {
            if (Build.VERSION.SDK_INT < 33) return true;
            return ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        }

        @JavascriptInterface
        public void requestNotifyPermission() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (Build.VERSION.SDK_INT >= 33) {
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.POST_NOTIFICATIONS}, 2001);
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean isIgnoringBattery() {
            if (Build.VERSION.SDK_INT < 23) return true;
            android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
            return pm.isIgnoringBatteryOptimizations(getPackageName());
        }

        @JavascriptInterface
        public void requestIgnoreBattery() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (Build.VERSION.SDK_INT < 23) return;
                    android.os.PowerManager pm = (android.os.PowerManager) getSystemService(POWER_SERVICE);
                    if (pm.isIgnoringBatteryOptimizations(getPackageName())) return;
                    try {
                        Intent ii = new Intent(
                                android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                Uri.parse("package:" + getPackageName()));
                        startActivity(ii);
                    } catch (Exception e) {
                        try {
                            startActivity(new Intent(
                                    android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
                        } catch (Exception ignored) {}
                    }
                }
            });
        }

        @JavascriptInterface
        public void openAutoStart() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    String[][] list = new String[][]{
                        {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
                        {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
                        {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                        {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"},
                        {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                        {"com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"},
                        {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
                        {"com.meizu.safe", "com.meizu.safe.security.SHOW_APPSEC"},
                        {"com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"}
                    };
                    for (String[] item : list) {
                        try {
                            Intent ii = new Intent();
                            ii.setClassName(item[0], item[1]);
                            ii.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(ii);
                            return;
                        } catch (Exception ignored) {}
                    }
                    startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName())));
                }
            });
        }

        @JavascriptInterface
        public boolean canUseFullScreen() {
            if (Build.VERSION.SDK_INT < 34) return true;
            try {
                return ((android.app.NotificationManager) getSystemService(NOTIFICATION_SERVICE))
                        .canUseFullScreenIntent();
            } catch (Exception e) { return true; }
        }

        @JavascriptInterface
        public void requestFullScreen() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (Build.VERSION.SDK_INT < 34) return;
                    try {
                        startActivity(new Intent(
                            android.provider.Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                            Uri.parse("package:" + getPackageName())));
                    } catch (Exception e) {
                        startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName())));
                    }
                }
            });
        }

        @JavascriptInterface
        public boolean canScheduleExactAlarm() {
            if (Build.VERSION.SDK_INT < 31) return true;
            try {
                return ((android.app.AlarmManager) getSystemService(ALARM_SERVICE)).canScheduleExactAlarms();
            } catch (Exception e) { return true; }
        }

        @JavascriptInterface
        public void requestExactAlarm() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    if (Build.VERSION.SDK_INT < 31) return;
                    try {
                        startActivity(new Intent(
                            android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                            Uri.parse("package:" + getPackageName())));
                    } catch (Exception e) {
                        startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.parse("package:" + getPackageName())));
                    }
                }
            });
        }
    }
}
