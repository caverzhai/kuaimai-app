package com.kuaimai.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.core.content.ContextCompat;

/**
 * 开机 / 应用更新后自动重启收款提醒服务（仅当用户此前已开启且 token 仍在）。
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {

            SharedPreferences sp = context.getSharedPreferences(
                    CollectMonitorService.PREFS, Context.MODE_PRIVATE);
            boolean enabled = sp.getBoolean(CollectMonitorService.KEY_ENABLED, false);
            String token = sp.getString(CollectMonitorService.KEY_TOKEN, null);

            if (enabled && token != null && token.length() > 0) {
                Intent svc = new Intent(context, CollectMonitorService.class)
                        .setAction(CollectMonitorService.ACTION_START);
                ContextCompat.startForegroundService(context, svc);
            }
        }
    }
}
