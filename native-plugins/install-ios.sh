#!/usr/bin/env bash
# Instala el plugin nativo de la malla (BLE advertiser) en el proyecto iOS
# generado por Capacitor y parcha el Info.plist.
# Uso:  bash native-plugins/install-ios.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/ios/App/App"

if [ ! -d "$ROOT/ios" ]; then
  echo "No existe la carpeta ios/. Ejecuta primero: npx cap add ios"
  exit 1
fi

cp "$ROOT/native-plugins/mesh-advertiser/ios/MeshAdvertiserPlugin.swift" "$DEST/"
cp "$ROOT/native-plugins/mesh-advertiser/ios/MeshAdvertiserPlugin.m" "$DEST/"
echo "Plugin copiado en: $DEST"

# Bridging header (necesario para que el .m vea las APIs de Capacitor).
BRIDGE="$DEST/App-Bridging-Header.h"
if [ ! -f "$BRIDGE" ]; then
  printf '#import <Capacitor/Capacitor.h>\n' > "$BRIDGE"
  echo "Creado App-Bridging-Header.h"
fi

node "$ROOT/native-plugins/patch-ios-plist.mjs"

# Añadir los archivos al target de Xcode (si xcodeproj de Ruby está disponible).
if command -v ruby >/dev/null 2>&1 && ruby -e "require 'xcodeproj'" >/dev/null 2>&1; then
  ruby - "$ROOT" <<'RB'
require 'xcodeproj'
root = ARGV[0]
proj_path = File.join(root, 'ios/App/App.xcodeproj')
project = Xcodeproj::Project.open(proj_path)
target = project.targets.find { |t| t.name == 'App' }
group = project.main_group.find_subpath('App', true)
%w[MeshAdvertiserPlugin.swift MeshAdvertiserPlugin.m].each do |name|
  next if group.files.any? { |f| f.display_name == name }
  ref = group.new_file(File.join(root, 'ios/App/App', name))
  target.add_file_references([ref])
  puts "Añadido al target: #{name}"
end
target.build_configurations.each do |c|
  c.build_settings['SWIFT_OBJC_BRIDGING_HEADER'] = 'App/App-Bridging-Header.h'
end
project.save
RB
else
  echo
  echo "AVISO: instala la gema 'xcodeproj' (gem install xcodeproj) o añade a mano en Xcode:"
  echo "  - MeshAdvertiserPlugin.swift"
  echo "  - MeshAdvertiserPlugin.m"
  echo "  - Build Settings → Objective-C Bridging Header = App/App-Bridging-Header.h"
fi

echo
echo "Listo. En Xcode: Signing & Capabilities → Background Modes →"
echo "  'Uses Bluetooth LE accessories' y 'Acts as a Bluetooth LE accessory'."
