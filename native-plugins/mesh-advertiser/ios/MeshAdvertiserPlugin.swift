import Foundation
import Capacitor
import CoreBluetooth

/**
 * BLE advertiser for the MATS mesh (iOS).
 *
 * Copy into ios/App/App/ and register in a bridge header / Package.swift.
 * Info.plist needs:
 *   NSBluetoothAlwaysUsageDescription
 *   UIBackgroundModes -> bluetooth-peripheral, bluetooth-central
 *
 * NOTE: iOS does not expose manufacturer-specific data in advertisements.
 * Payloads travel inside a 128-bit service UUID slot, which the scanner side
 * also understands. Background advertising is throttled by iOS: expect the
 * mesh to be slower (but functional) with the screen locked.
 */
@objc(MeshAdvertiserPlugin)
public class MeshAdvertiserPlugin: CAPPlugin, CBPeripheralManagerDelegate {

    private var manager: CBPeripheralManager?
    private var pendingCall: CAPPluginCall?
    private var pendingData: String?
    private var pendingDuration: Int = 1500

    @objc func advertise(_ call: CAPPluginCall) {
        guard let dataHex = call.getString("dataHex") else {
            call.reject("dataHex requerido")
            return
        }
        pendingCall = call
        pendingData = dataHex
        pendingDuration = call.getInt("durationMs") ?? 1500

        if manager == nil {
            manager = CBPeripheralManager(delegate: self, queue: nil)
        } else {
            startAdvertising()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        manager?.stopAdvertising()
        call.resolve()
    }

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn {
            startAdvertising()
        } else {
            pendingCall?.reject("Bluetooth no disponible")
            pendingCall = nil
        }
    }

    private func startAdvertising() {
        guard let manager = manager, manager.state == .poweredOn,
              let hex = pendingData, let call = pendingCall else { return }

        manager.stopAdvertising()
        // Pack the payload into a synthetic 128-bit service UUID.
        let padded = String((hex + String(repeating: "0", count: 32)).prefix(32))
        let uuidString = "\(padded.prefix(8))-\(padded.dropFirst(8).prefix(4))-\(padded.dropFirst(12).prefix(4))-\(padded.dropFirst(16).prefix(4))-\(padded.dropFirst(20).prefix(12))"
        guard let uuid = UUID(uuidString: uuidString) else {
            call.reject("payload inválido para iOS")
            pendingCall = nil
            return
        }

        manager.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [CBUUID(nsuuid: uuid)]])

        let deadline = DispatchTime.now() + .milliseconds(pendingDuration)
        DispatchQueue.main.asyncAfter(deadline: deadline) { [weak self] in
            self?.manager?.stopAdvertising()
            call.resolve()
            self?.pendingCall = nil
        }
    }
}