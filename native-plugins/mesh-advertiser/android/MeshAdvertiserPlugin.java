package app.lovable.mats.mesh;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * BLE advertiser for the MATS mesh.
 *
 * Copy this file into android/app/src/main/java/app/lovable/mats/mesh/ and register it
 * in MainActivity: registerPlugin(MeshAdvertiserPlugin.class);
 *
 * Required manifest permissions:
 *   BLUETOOTH_ADVERTISE (API 31+), BLUETOOTH_CONNECT, BLUETOOTH_SCAN
 */
@CapacitorPlugin(name = "MeshAdvertiser")
public class MeshAdvertiserPlugin extends Plugin {

    private static final int MANUFACTURER_ID = 0xFFFF;

    private BluetoothLeAdvertiser advertiser;
    private AdvertiseCallback callback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @PluginMethod
    public void advertise(PluginCall call) {
        String dataHex = call.getString("dataHex");
        int durationMs = call.getInt("durationMs", 1500);
        if (dataHex == null) {
            call.reject("dataHex requerido");
            return;
        }

        if (advertiser == null) {
            BluetoothManager manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
            if (adapter == null || !adapter.isEnabled()) {
                call.reject("Bluetooth apagado");
                return;
            }
            advertiser = adapter.getBluetoothLeAdvertiser();
        }
        if (advertiser == null) {
            call.reject("Este dispositivo no soporta emisión BLE");
            return;
        }

        stopInternal();

        AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(Math.min(durationMs, 180000))
                .build();

        AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addManufacturerData(MANUFACTURER_ID, hexToBytes(dataHex))
                .build();

        callback = new AdvertiseCallback() {
            @Override
            public void onStartFailure(int errorCode) {
                call.reject("advertise error " + errorCode);
            }

            @Override
            public void onStartSuccess(AdvertiseSettings settingsInEffect) {
                handler.postDelayed(() -> {
                    stopInternal();
                    call.resolve(new JSObject());
                }, durationMs);
            }
        };

        try {
            advertiser.startAdvertising(settings, data, callback);
        } catch (SecurityException e) {
            call.reject("Falta permiso BLUETOOTH_ADVERTISE");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    private void stopInternal() {
        if (advertiser != null && callback != null) {
            try {
                advertiser.stopAdvertising(callback);
            } catch (SecurityException ignored) {
            }
        }
        callback = null;
    }

    private static byte[] hexToBytes(String hex) {
        int len = hex.length() / 2;
        byte[] out = new byte[len];
        for (int i = 0; i < len; i++) {
            out[i] = (byte) Integer.parseInt(hex.substring(i * 2, i * 2 + 2), 16);
        }
        return out;
    }
}