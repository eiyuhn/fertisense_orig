// app.config.js
export default ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || "development";
  const isProd = profile === "production";

  return {
    ...config,

    name: isProd ? "FertiSense" : "FertiSense Dev",
    slug: "fertisense",
    scheme: "fertisense",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/fertisense-logo.png",

    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
            // allow HTTP to ESP32 (192.168.4.1)
            usesCleartextTraffic: true,
          },
        },
      ],
    ],

    android: {
      package: isProd
        ? "com.iannnn.fertisense"
        : "com.iannnn.fertisense.dev",

      // REQUIRED PERMISSIONS FOR WIFI + NETWORK
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_WIFI_STATE",
        "CHANGE_WIFI_STATE",
        "ACCESS_NETWORK_STATE",
        "INTERNET",
        // 🔴 IMPORTANT FOR ANDROID 13+ WIFI SCAN/CONNECT:
        "NEARBY_WIFI_DEVICES"
      ],
    },

    ios: {
      bundleIdentifier: isProd
        ? "com.iannnn.fertisense"
        : "com.iannnn.fertisense.dev",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
        // If you want HTTP to ESP32 on iOS too, you can add:
        // NSAppTransportSecurity: {
        //   NSAllowsArbitraryLoads: true,
        // },
      },
    },

    extra: {
      eas: {
        projectId: "dd95e93f-f51a-4d97-9db6-35d9c765e290",
      },
    },
  };
};
