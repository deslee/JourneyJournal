cordova.define('cordova/plugin_list', function(require, exports, module) {
module.exports = [
    {
        "file": "plugins/org.apache.cordova.device/www/device.js",
        "id": "org.apache.cordova.device.device",
        "clobbers": [
            "device"
        ]
    },
    {
        "file": "plugins/org.apache.cordova.device/src/browser/DeviceProxy.js",
        "id": "org.apache.cordova.device.DeviceProxy",
        "runs": true
    }
];
module.exports.metadata = 
// TOP OF METADATA
{
    "org.apache.cordova.inappbrowser": "0.6.0",
    "org.apache.cordova.device": "0.3.0"
}
// BOTTOM OF METADATA
});