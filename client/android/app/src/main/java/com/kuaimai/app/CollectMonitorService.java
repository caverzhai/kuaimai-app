package com.kuaimai.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.os.Process;
import android.os.SystemClock;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 收款提醒前台服务：
 * 定时轮询 /api/notifications/pending，对 type=collect 的新事件逐笔发出系统通知
 * （待收款：女真人声 + 震动 + 锁屏全屏弹窗 + 角标；待发货/服务中：静默入栏）。
 * 通知按 orderId 打 tag：同一订单只一条，订单发货/完成/取消后由服务端 clearedOrderIds 精确清除。
 * 后台 / 锁屏由「前台服务(dataSync) + AlarmManager 精确唤醒 + 被杀自重启 + 开机自启」多重维持。
 */
public class CollectMonitorService extends android.app.Service {

    static final String PREFS = "kuaimai_collect";
    static final String KEY_TOKEN = "token";
    static final String KEY_LAST_SEQ = "last_seq";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_UNREAD = "unread";
    static final String KEY_RINGED = "ringed_ids";
    static final int MAX_RINGED = 200;

    static final String CH_FG = "kuaimai_fg";
    // v8=收款渠道：渠道声音 + MediaPlayer 主动播放女声（双保险），删除已缓存的 v7
    static final String CH_COLLECT = "kuaimai_collect_v8";
    static final String CH_COLLECT_OLD_1 = "kuaimai_collect_v1";
    static final String CH_COLLECT_OLD_2 = "kuaimai_collect_v2";
    static final String CH_COLLECT_OLD_3 = "kuaimai_collect_v3";
    static final String CH_COLLECT_OLD_4 = "kuaimai_collect_v4";
    static final String CH_COLLECT_OLD_5 = "kuaimai_collect_v5";
    static final String CH_COLLECT_OLD_6 = "kuaimai_collect_v6";
    static final String CH_COLLECT_OLD_7 = "kuaimai_collect_v7";
    static final String CH_SILENT = "kuaimai_collect_silent";
    static final int ID_FG = 1001;
    static final int NOTIFY_BASE = 2000;

    static final String BASE = "https://backend-production-5d79.up.railway.app";
    static final long INTERVAL_MS = 15_000L;

    static final String ACTION_START = "com.kuaimai.app.collect.START";
    static final String ACTION_STOP = "com.kuaimai.app.collect.STOP";
    static final String ACTION_CLEAR = "com.kuaimai.app.collect.CLEAR";
    static final String ACTION_POLL = "com.kuaimai.app.collect.POLL";
    static final String ACTION_REALTIME = "com.kuaimai.app.collect.REALTIME";
    static final String EXTRA_JSON = "realtime_json";

    private static final int PI_FLAGS =
        android.app.PendingIntent.FLAG_UPDATE_CURRENT | android.app.PendingIntent.FLAG_IMMUTABLE;

    private HandlerThread thread;
    private Handler handler;
    private boolean foregroundStarted = false;
    private boolean userStopped = false;
    private android.os.PowerManager.WakeLock wakeLock;
    private android.media.MediaPlayer collectPlayer;
    // 高性能 WiFi 锁：锁屏 / Doze 下保持无线联网，前台服务才能及时轮询到收款、系统才会响铃
    private android.net.wifi.WifiManager.WifiLock wifiLock;

    private final Runnable pollTask = new Runnable() {
        @Override public void run() { poll(); }
    };

    // ---- 供桥接调用 ----
    public static void start(Context c, String token) {
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor e = sp.edit();
        if (token != null && token.length() > 0) e.putString(KEY_TOKEN, token);
        e.putBoolean(KEY_ENABLED, true);
        e.apply();
        Intent i = new Intent(c, CollectMonitorService.class).setAction(ACTION_START);
        ContextCompat.startForegroundService(c, i);
    }

    // SSE 前台实时事件：桥把通知 JSON 交给服务（同时确保服务被拉起 / 保活）
    public static void relayRealtime(Context c, String json) {
        Intent i = new Intent(c, CollectMonitorService.class).setAction(ACTION_REALTIME);
        i.putExtra(EXTRA_JSON, json);
        ContextCompat.startForegroundService(c, i);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createChannels();
        thread = new HandlerThread("collect-poll", Process.THREAD_PRIORITY_BACKGROUND);
        thread.start();
        handler = new Handler(thread.getLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            userStopped = true;
            getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, false).apply();
            cancelAlarm(alarmPollIntent());
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        ensureForeground();
        scheduleAlarm(INTERVAL_MS); // 每次唤起都续上精确闹钟，保证后台链路不断

        if (ACTION_CLEAR.equals(action)) {
            clearAlerts();
            return START_STICKY;
        }

        if (ACTION_REALTIME.equals(action)) {
            final String rtJson = intent.getStringExtra(EXTRA_JSON);
            handler.removeCallbacks(pollTask);
            handler.post(new Runnable() {
                @Override public void run() { handleRealtimeJson(rtJson); }
            });
            return START_STICKY;
        }

        // START / POLL / 系统重建：立即拉一次，随后 Handler + Alarm 双轨周期轮询
        handler.removeCallbacks(pollTask);
        handler.post(pollTask);
        return START_STICKY;
    }

    private void ensureForeground() {
        if (foregroundStarted) return;
        NotificationCompat.Builder fg = new NotificationCompat.Builder(this, CH_FG)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("AI快卖运行中")
            .setContentText("正在为您留意待收款")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE);

        boolean ok = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+：specialUse 维持保活，dataSync 保证 Doze/后台下持续联网轮询
            try {
                startForeground(ID_FG, fg.build(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                        | ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
                ok = true;
            } catch (Exception startEx) {
                // 后台启动前台服务被限制：本次未真正成为前台，安排重试（而非假装成功致进程被杀）
            }
        } else {
            try {
                startForeground(ID_FG, fg.build());
                ok = true;
            } catch (Exception ignored) {}
        }
        if (ok) {
            foregroundStarted = true;
            acquireWifiLock();
        } else if (handler != null) {
            handler.postDelayed(new Runnable() {
                @Override public void run() { ensureForeground(); }
            }, 3_000L);
        }
    }

    private void createChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);

        NotificationChannel fgCh = new NotificationChannel(CH_FG, "运行状态", NotificationManager.IMPORTANCE_MIN);
        fgCh.setShowBadge(false);
        fgCh.setSound(null, null);
        nm.createNotificationChannel(fgCh);

        // 清理所有历史 collect 渠道（v1-v7），保证 v8 声音首次创建即生效
        nm.deleteNotificationChannel(CH_COLLECT_OLD_1);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_2);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_3);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_4);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_5);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_6);
        nm.deleteNotificationChannel(CH_COLLECT_OLD_7);

        // 全新 v8：声音 = res/raw 资源名 URI（同时在弹通知时用 MediaPlayer 主动播放，双保险）
        nm.createNotificationChannel(buildCollectChannel(CH_COLLECT, collectSoundUri()));

        // 静默渠道（待发货/服务中、错过收款窗口补达）：IMPORTANCE_LOW，无声 / 无震，仅入栏 / 角标
        nm.deleteNotificationChannel(CH_SILENT);
        NotificationChannel silentCh =
            new NotificationChannel(CH_SILENT, "待发货/服务中", NotificationManager.IMPORTANCE_LOW);
        silentCh.setSound(null, null);
        silentCh.enableVibration(false);
        silentCh.setShowBadge(false); // 静默“待发货”不计角标，角标只数待收款（v7）
        silentCh.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(silentCh);
    }

    private NotificationChannel buildCollectChannel(String channelId, Uri sound) {
        NotificationChannel ch = new NotificationChannel(channelId, "待收款提醒", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("有人向您付款、等待您确认时提醒");
        AudioAttributes aa = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build();
        ch.setSound(sound, aa);
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{0, 500, 250, 500});
        ch.setShowBadge(true);
        ch.enableLights(true);
        ch.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        return ch;
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void poll() {
        acquireWakeLock();
        SharedPreferences sp = prefs();
        String token = sp.getString(KEY_TOKEN, null);
        long lastSeq = sp.getLong(KEY_LAST_SEQ, 0L);

        if (token == null || token.length() == 0) {
            // 不停止、不禁用：保持前台保活，退避 30s 后重读 token（前端登录 / 启动 / 心跳会写入最新 token）
            scheduleNext(30_000L);
            return;
        }

        HttpURLConnection conn = null;
        try {
            URL u = new URL(BASE + "/api/notifications/pending?after=" + lastSeq);
            conn = (HttpURLConnection) u.openConnection();
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);

            int code = conn.getResponseCode();
            if (code == 401 || code == 403) {
                // token 临时失效：不停止、不禁用，保持前台保活，退避 30s 后用最新 token 重试
                // （前端重新登录 / token 刷新会经 start() 写入新 token；切号场景下服务也不会彻底死掉）
                scheduleNext(30_000L);
                return;
            }
            if (code != 200) { scheduleNext(); return; }

            String body = readAll(conn.getInputStream());
            JSONObject json = new JSONObject(body);
            JSONArray arr = json.optJSONArray("notifications");
            JSONArray cleared = json.optJSONArray("clearedOrderIds");
            long maxSeq = lastSeq;
            Set<String> ringed = loadRinged(sp);
            List<JSONObject> ringItems = new ArrayList<JSONObject>();
            List<JSONObject> silentItems = new ArrayList<JSONObject>();
            int liveCount = 0;

            if (arr != null) {
                for (int k = 0; k < arr.length(); k++) {
                    JSONObject n = arr.getJSONObject(k);
                    long seq = n.optLong("seq", 0L);
                    if (seq > maxSeq) maxSeq = seq;
                    if (!"collect".equals(n.optString("type", "system"))) continue;

                    String orderId = orderIdOf(n);
                    boolean silent = n.optBoolean("silent", false);
                    if (!silent) liveCount++; // 角标口径：当前待收款笔数

                    boolean already = orderId.length() > 0 && ringed.contains(orderId);
                    if (!already && orderId.length() > 0) {
                        ringed.add(orderId);
                        if (silent) silentItems.add(n); // 错过 live：静默补达
                        else ringItems.add(n);          // 新待收款：响铃
                    } else if (already && silent) {
                        silentItems.add(n); // live→silent：更新为静默“待发货/服务中”，不响
                    }
                    // 注意：不在此 ack。服务端需持续跟踪到订单 dead，发货/完成时才能回传清除信号
                }
            }

            // 已发货/完成/取消：精确取消该订单通知、移出 ringed
            if (cleared != null) {
                for (int k = 0; k < cleared.length(); k++) {
                    String tag = cleared.optString(k, "");
                    if (tag.length() == 0) continue;
                    NotificationManagerCompat.from(this).cancel(tag, NOTIFY_BASE);
                    ringed.remove(tag);
                }
            }

            SharedPreferences.Editor ed = sp.edit();
            if (maxSeq > lastSeq) ed.putLong(KEY_LAST_SEQ, maxSeq);
            ed.putInt(KEY_UNREAD, liveCount); // 角标始终对齐服务端真实待收款数
            saveRinged(ed, ringed);
            ed.apply();

            for (JSONObject n : ringItems) {
                showCollectNotification(orderIdOf(n), liveCount, n.optString("body", ""));
            }
            for (JSONObject n : silentItems) {
                showSilentNotification(orderIdOf(n), n.optString("body", ""));
            }
        } catch (Exception e) {
            // 网络 / 解析异常：静默，下轮重试
        } finally {
            if (conn != null) conn.disconnect();
            releaseWakeLock();
            scheduleNext();
        }
    }

    private String orderIdOf(JSONObject n) {
        String nId = n.optString("id", "");
        try {
            JSONObject pl = n.optJSONObject("payload");
            if (pl != null && pl.optString("orderId", "").length() > 0) return pl.optString("orderId");
        } catch (Exception ignored) {}
        return nId;
    }

    private void showCollectNotification(String tag, int unread, String line) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_COLLECT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("AI快卖·请您收款")
            .setContentText(line != null && line.length() > 0 ? line : "您有一笔待收款，点开处理")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(
                (line != null && line.length() > 0 ? line : "您有一笔待收款")
                    + "\n累计待处理 " + unread + " 笔，点开即可确认"))
            .setNumber(unread)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(openAppIntent())
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        // 不使用全屏 Intent：锁屏时它会直接拉起 Activity（被锁屏 Keyguard 挡住），系统转而把发声
        // 交给该 Activity，渠道声音被吞，表现为“开屏有声、锁屏无声”。统一用高优先级横幅通知
        // （与微信 / 支付宝到账提醒同款）：锁屏时系统会亮屏、弹横幅并播放渠道声音，稳定可靠。

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            b.setSound(collectSoundUri());
            b.setVibrate(new long[]{0, 500, 250, 500});
        }
        try {
            NotificationManagerCompat.from(this).notify(tag, NOTIFY_BASE, b.build());
        } catch (Exception ignored) {}
        // 声音统一由通知渠道播放：锁屏 / Doze 下系统投递通知时也会响（最可靠），
        // 不再用 MediaPlayer 主动播放，避免“渠道音 + 主动播放”两次声音。
    }

    // 静默补达：无声 / 无震动 / 不弹横幅，仅入通知栏与角标（待发货 / 服务中 / 错过收款窗口）
    private void showSilentNotification(String tag, String line) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_SILENT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("AI快卖·待发货/服务中")
            .setContentText(line != null && line.length() > 0 ? line : "有一笔订单待处理，点开查看")
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setContentIntent(openAppIntent())
            .setVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        try {
            NotificationManagerCompat.from(this).notify(tag, NOTIFY_BASE, b.build());
        } catch (Exception ignored) {}
    }

    // 人声 URI：res/raw 资源名（系统进程可直接读取本应用资源，无需存储权限，跨版本稳定）
    private Uri collectSoundUri() {
        return Uri.parse("android.resource://" + getPackageName() + "/raw/ai_kuaimai_collect");
    }

    // 主动播放女真人声（主力，不依赖系统渠道是否自动响）：MediaPlayer 直接播 res/raw
    private void playCollectSound() {
        // 先释放上一个未播完的，避免两声叠加
        if (collectPlayer != null) {
            try { collectPlayer.reset(); collectPlayer.release(); } catch (Exception ignored) {}
            collectPlayer = null;
        }
        final android.media.MediaPlayer mp = new android.media.MediaPlayer();
        try {
            AudioAttributes aa = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                .build();
            mp.setAudioAttributes(aa);
            android.content.res.AssetFileDescriptor afd =
                getResources().openRawResourceFd(R.raw.ai_kuaimai_collect);
            mp.setDataSource(afd.getFileDescriptor(), afd.getStartOffset(), afd.getLength());
            afd.close();
            mp.setLooping(false);
            mp.setOnCompletionListener(new android.media.MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(android.media.MediaPlayer p) {
                    try { p.release(); } catch (Exception ignored) {}
                    if (collectPlayer == p) collectPlayer = null;
                }
            });
            mp.setOnErrorListener(new android.media.MediaPlayer.OnErrorListener() {
                @Override public boolean onError(android.media.MediaPlayer p, int what, int extra) {
                    try { p.release(); } catch (Exception ignored) {}
                    if (collectPlayer == p) collectPlayer = null;
                    return true;
                }
            });
            mp.prepare();
            collectPlayer = mp;
            mp.start();
        } catch (Exception e) {
            try { mp.release(); } catch (Exception ignored) {}
        }
    }

    private android.app.PendingIntent openAppIntent() {
        Intent i = new Intent(this, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return android.app.PendingIntent.getActivity(this, 0, i, PI_FLAGS);
    }

    private void clearAlerts() {
        // 清除当前所有通知（含收款类），角标清零；ringed 去重记忆保留，避免旧单重新响
        NotificationManagerCompat.from(this).cancelAll();
        prefs().edit().putInt(KEY_UNREAD, 0).apply();
    }

    // Doze / 锁屏被 AlarmManager 唤醒后，持有 CPU 直到本轮拉取、发通知完成
    private void acquireWakeLock() {
        try {
            android.os.PowerManager pm =
                (android.os.PowerManager) getSystemService(POWER_SERVICE);
            wakeLock = pm.newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "kuaimai:collectpoll");
            wakeLock.acquire(30_000L);
        } catch (Exception ignored) {}
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Exception ignored) {}
    }

    // 锁屏 / Doze 下保持高性能 WiFi，前台服务轮询不被断网（前台期间常驻，略增耗电）
    private void acquireWifiLock() {
        try {
            if (wifiLock == null) {
                android.net.wifi.WifiManager wm =
                    (android.net.wifi.WifiManager) getSystemService(WIFI_SERVICE);
                wifiLock = wm.createWifiLock(
                    android.net.wifi.WifiManager.WIFI_MODE_FULL_HIGH_PERF, "kuaimai:wifi");
                wifiLock.setReferenceCounted(false);
            }
            if (!wifiLock.isHeld()) wifiLock.acquire();
        } catch (Exception ignored) {}
    }

    private void releaseWifiLock() {
        try {
            if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        } catch (Exception ignored) {}
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // 用户从最近任务划掉 App：1 秒后自动拉起服务（非主动停止时）
        if (!userStopped) scheduleAlarm(1_000L);
        super.onTaskRemoved(rootIntent);
    }

    // ---- AlarmManager：Doze / 后台下的精确兜底唤醒 ----
    private android.app.PendingIntent alarmPollIntent() {
        Intent i = new Intent(this, CollectMonitorService.class).setAction(ACTION_POLL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return android.app.PendingIntent.getForegroundService(this, 0, i, PI_FLAGS);
        }
        return android.app.PendingIntent.getService(this, 0, i, PI_FLAGS);
    }

    private void scheduleAlarm(long delayMs) {
        try {
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            android.app.PendingIntent pi = alarmPollIntent();
            long at = SystemClock.elapsedRealtime() + delayMs;
            boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
            if (exact) {
                am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            } else {
                am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            }
        } catch (Exception ignored) {}
    }

    private void cancelAlarm(android.app.PendingIntent pi) {
        try {
            ((AlarmManager) getSystemService(ALARM_SERVICE)).cancel(pi);
        } catch (Exception ignored) {}
    }

    // 已提醒过的订单（去重），保序加载
    private Set<String> loadRinged(SharedPreferences sp) {
        Set<String> set = new LinkedHashSet<String>();
        String raw = sp.getString(KEY_RINGED, "");
        if (raw == null || raw.length() == 0) return set;
        for (String s : raw.split(",")) {
            if (s.length() > 0) set.add(s);
        }
        return set;
    }

    // 保存去重集合，超过上限时丢弃最旧的（FIFO）
    private void saveRinged(SharedPreferences.Editor ed, Set<String> ringed) {
        if (ringed.size() > MAX_RINGED) {
            int remove = ringed.size() - MAX_RINGED;
            java.util.Iterator<String> it = ringed.iterator();
            while (remove-- > 0 && it.hasNext()) {
                it.next();
                it.remove();
            }
        }
        StringBuilder sb = new StringBuilder();
        for (String s : ringed) {
            if (sb.length() > 0) sb.append(',');
            sb.append(s);
        }
        ed.putString(KEY_RINGED, sb.toString());
    }

    private void scheduleNext() {
        scheduleNext(INTERVAL_MS);
    }

    // 退避调度：delayMs 可大于常规间隔（token 失效 / 网络异常时降低频率，但服务保持运行）
    private void scheduleNext(long delayMs) {
        if (handler == null) return;
        handler.removeCallbacks(pollTask);
        handler.postDelayed(pollTask, delayMs);
        scheduleAlarm(delayMs); // 双轨：Handler（前台）+ Alarm（后台/Doze 兜底）
    }

    private static String readAll(InputStream is) throws Exception {
        StringBuilder sb = new StringBuilder();
        BufferedReader br = new BufferedReader(new InputStreamReader(is, "UTF-8"));
        String line;
        while ((line = br.readLine()) != null) sb.append(line).append('\n');
        return sb.toString();
    }

    // 确认某条 collect 已送达（POST ack）。失败静默，下轮 unacked 兜底
    private void postAck(String notificationId) {
        if (notificationId == null || notificationId.length() == 0) return;
        HttpURLConnection c = null;
        try {
            URL u = new URL(BASE + "/api/notifications/ack/" + notificationId);
            c = (HttpURLConnection) u.openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Authorization", "Bearer " + prefs().getString(KEY_TOKEN, ""));
            c.setConnectTimeout(8000);
            c.setReadTimeout(8000);
            c.getResponseCode();
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
    }

    // 处理 SSE 前台实时下发的 collect（ringed 去重，与轮询共用同一集合，保证只响一次）
    private void handleRealtimeJson(String json) {
        if (json == null || json.length() == 0) { scheduleNext(); return; }
        acquireWakeLock();
        try {
            JSONObject n = new JSONObject(json);
            String orderId = orderIdOf(n);
            boolean silent = n.optBoolean("silent", false);

            SharedPreferences sp = prefs();
            Set<String> ringed = loadRinged(sp);
            boolean already = orderId.length() > 0 && ringed.contains(orderId);
            if (!already && orderId.length() > 0) {
                ringed.add(orderId);
                SharedPreferences.Editor ed = sp.edit();
                saveRinged(ed, ringed);
                if (silent) {
                    showSilentNotification(orderId, n.optString("body", ""));
                } else {
                    int unread = sp.getInt(KEY_UNREAD, 0) + 1;
                    ed.putInt(KEY_UNREAD, unread);
                    showCollectNotification(orderId, unread, n.optString("body", ""));
                }
                ed.apply();
            }
            // 不 ack：服务端需跟踪到订单 dead 才自动确认，保证发货/完成时能清除通知
        } catch (Exception ignored) {
        } finally {
            releaseWakeLock();
            scheduleNext();
        }
    }

    @Override
    public void onDestroy() {
        if (collectPlayer != null) {
            try { collectPlayer.reset(); collectPlayer.release(); } catch (Exception ignored) {}
            collectPlayer = null;
        }
        releaseWifiLock();
        if (handler != null) handler.removeCallbacks(pollTask);
        if (thread != null) thread.quitSafely();
        // 非用户主动关闭时，2 秒后自动拉起服务（START_STICKY 之外的双保险）
        if (!userStopped) {
            try {
                AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
                Intent i = new Intent(this, CollectMonitorService.class).setAction(ACTION_START);
                android.app.PendingIntent pi = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? android.app.PendingIntent.getForegroundService(this, 1, i, PI_FLAGS)
                    : android.app.PendingIntent.getService(this, 1, i, PI_FLAGS);
                long at = SystemClock.elapsedRealtime() + 2_000L;
                boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
                if (exact) am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
                else am.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, at, pi);
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
