package app.lovable.mats.mesh;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

public class MeshForegroundService extends Service {
  private static final String CHANNEL_ID = "mats_mesh";
  private static final int NOTIFICATION_ID = 4711;

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    String title = intent != null && intent.hasExtra("title") ? intent.getStringExtra("title") : "Red malla activa";
    String body = intent != null && intent.hasExtra("body") ? intent.getStringExtra("body") : "";

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID, "Red malla MATS", NotificationManager.IMPORTANCE_LOW);
      channel.setShowBadge(false);
      NotificationManager manager = getSystemService(NotificationManager.class);
      if (manager != null) manager.createNotificationChannel(channel);
    }

    Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build();

    startForeground(NOTIFICATION_ID, notification);
    // START_STICKY: si Android mata el proceso, el servicio se reinicia solo.
    return START_STICKY;
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
