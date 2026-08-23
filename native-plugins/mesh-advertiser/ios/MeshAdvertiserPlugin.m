#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Expone la clase Swift MeshAdvertiserPlugin al runtime de Capacitor.
CAP_PLUGIN(MeshAdvertiserPlugin, "MeshAdvertiser",
           CAP_PLUGIN_METHOD(advertise, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stop, CAPPluginReturnPromise);
)
