package com.kuaimai.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * 把收款人声从应用资源复制到系统「通知铃声」目录(Notifications)，
 * 通过 MediaStore 取得跨版本、锁屏由系统进程可读的稳定 content://media 地址。
 * 通知渠道用该地址发声，避免应用资源 ID/URI 在更新或锁屏后失效。
 */
public final class RingtoneInstaller {

    public static final String FILE_NAME = "ai_kuaimai_collect.ogg";
    public static final String TITLE = "AI快卖收款";
    private static final String MIME = "audio/ogg";

    private RingtoneInstaller() {}

    /** 应在后台线程调用；返回通知铃声 content URI，失败返回 null。 */
    public static Uri ensure(Context ctx) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                return ensureMediaStore(ctx);
            }
            return ensureLegacy(ctx);
        } catch (Exception e) {
            return null;
        }
    }

    // ---- Android 10+：MediaStore 写入 Notifications，应用写入自有条目无需存储权限 ----
    private static Uri ensureMediaStore(Context ctx) throws Exception {
        ContentResolver cr = ctx.getContentResolver();
        Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String relPath = Environment.DIRECTORY_NOTIFICATIONS + "/";

        Uri existing = findExisting(cr, collection, relPath);
        if (existing != null) return existing;

        ContentValues v = new ContentValues();
        v.put(MediaStore.Audio.Media.DISPLAY_NAME, FILE_NAME);
        v.put(MediaStore.Audio.Media.TITLE, TITLE);
        v.put(MediaStore.Audio.Media.MIME_TYPE, MIME);
        v.put(MediaStore.Audio.Media.RELATIVE_PATH, relPath);
        v.put(MediaStore.Audio.Media.IS_NOTIFICATION, 1);
        v.put(MediaStore.Audio.Media.IS_RINGTONE, 0);
        v.put(MediaStore.Audio.Media.IS_ALARM, 0);
        v.put(MediaStore.Audio.Media.IS_PENDING, 1);

        Uri item = cr.insert(collection, v);
        if (item == null) return null;
        try {
            OutputStream os = cr.openOutputStream(item);
            copyRaw(ctx, os);
        } catch (Exception writeEx) {
            cr.delete(item, null, null);
            return null;
        }
        ContentValues done = new ContentValues();
        done.put(MediaStore.Audio.Media.IS_PENDING, 0);
        cr.update(item, done, null, null);
        return item;
    }

    private static Uri findExisting(ContentResolver cr, Uri collection, String relPath) {
        String sel = MediaStore.Audio.Media.RELATIVE_PATH + "=? AND "
                + MediaStore.Audio.Media.DISPLAY_NAME + "=?";
        String[] args = { relPath, FILE_NAME };
        Cursor c = null;
        try {
            c = cr.query(collection,
                    new String[]{ MediaStore.Audio.Media._ID }, sel, args, null);
            if (c != null && c.moveToFirst()) {
                long id = c.getLong(0);
                return Uri.withAppendedPath(collection, String.valueOf(id));
            }
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.close();
        }
        return null;
    }

    // ---- Android 9-：写公共 Notifications 目录（需 WRITE_EXTERNAL_STORAGE）+ 媒体扫描 ----
    private static Uri ensureLegacy(Context ctx) throws Exception {
        File dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_NOTIFICATIONS);
        if (!dir.exists()) dir.mkdirs();
        File f = new File(dir, FILE_NAME);
        if (!f.exists() || f.length() == 0) {
            FileOutputStream fos = new FileOutputStream(f);
            copyRaw(ctx, fos);
        }
        final CountDownLatch latch = new CountDownLatch(1);
        final Uri[] out = { null };
        MediaScannerConnection.scanFile(ctx.getApplicationContext(),
                new String[]{ f.getAbsolutePath() },
                new String[]{ MIME },
                new MediaScannerConnection.OnScanCompletedListener() {
                    @Override public void onScanCompleted(String path, Uri uri) {
                        out[0] = uri;
                        latch.countDown();
                    }
                });
        latch.await(5, TimeUnit.SECONDS);
        return out[0];
    }

    private static void copyRaw(Context ctx, OutputStream os) throws Exception {
        InputStream is = ctx.getResources().openRawResource(R.raw.ai_kuaimai_collect);
        byte[] buf = new byte[4096];
        int n;
        try {
            while ((n = is.read(buf)) > 0) os.write(buf, 0, n);
        } finally {
            is.close();
            os.flush();
            os.close();
        }
    }
}
