package app.lovable.mats.mesh;

import android.content.Intent;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Mantiene vivo el escaneo BLE y el encolado de mensajes de la malla con la
 * pantalla apagada mediante un Foreground Service.
 *
 * AndroidManifest.xml (dentro de <application>):
 *   <service
 *     android:name="app.lovable.mats.mesh.MeshForegroundService"
 *     android:foregroundServiceType="connectedDevice"
 *     android:exported="false" />
 *
 * Permisos (fuera de <application>):
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />
 *   <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
 *   <uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
 *   <uses-permission android:name="android.permission.BLUETOOTH_ADVERTISE" />
 *   <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
 */
@CapacitorPlugin(name = "MeshForegroundService")
public class MeshForegroundServicePlugin extends Plugin {

  @PluginMethod
  public void start(PluginCall call) {
    Intent intent = new Intent(getContext(), MeshForegroundService.class);
    intent.putExtra("title", call.getString("title", "Red malla activa"));
    intent.putExtra("body", call.getString("body", "Retransmitiendo alertas cercanas"));
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      getContext().startForegroundService(intent);
    } else {
      getContext().startService(intent);
    }
    call.resolve();
  }

  @PluginMethod
  public void stop(PluginCall call) {
    getContext().stopService(new Intent(getContext(), MeshForegroundService.class));
    call.resolve();
  }
}
