# Malla en segundo plano — iOS

iOS no permite foreground services. El escaneo/anuncio BLE continúa en segundo
plano sólo si se declaran las capabilities correspondientes.

## 1. Info.plist (`ios/App/App/Info.plist`)

```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>bluetooth-peripheral</string>
  <string>location</string>
</array>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>MATS usa Bluetooth para formar una red malla y retransmitir alertas de emergencia cuando no hay internet.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>MATS emite alertas de auxilio por Bluetooth hacia dispositivos cercanos.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>MATS comparte tu ubicación en alertas de emergencia, incluso en segundo plano.</string>
```

## 2. Xcode

Signing & Capabilities → Background Modes → marcar
"Uses Bluetooth LE accessories" y "Acts as a Bluetooth LE accessory".

## 3. Límites reales

- En segundo plano, iOS reduce la frecuencia de escaneo y **no permite
  `allowDuplicates`**; los intervalos del duty cycle se alargan solos.
- El anuncio en background va al "overflow area": sólo lo ven otros iPhone con
  la app instalada. Para interoperar con Android, la app debe estar en primer
  plano al emitir.
- El encolado (DTN en IndexedDB) sigue intacto: lo pendiente se emite en cuanto
  la app vuelve a primer plano.
