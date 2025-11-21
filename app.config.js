// app.config.js
export default ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || "development";
  const isProd = profile === "production";

  return {
    // keep whatever Expo already puts in config
    ...config,

    // basic app info
    name: isProd ? "FertiSense" : "FertiSense Dev",
    slug: "fertisense",
    scheme: "fertisense",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/fertisense-logo.png",

    // ✅ ONLY expo-build-properties here for now
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            minSdkVersion: 24,
          },
        },
      ],
    ],

    

    android: {
      // prod vs dev package so you can have 2 apps installed
      package: isProd
        ? "com.iannnn.fertisense"      // production
        : "com.iannnn.fertisense.dev", // dev
    },

    ios: {
      bundleIdentifier: isProd
        ? "com.iannnn.fertisense"
        : "com.iannnn.fertisense.dev",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },

    

    extra: {
      eas: {
        projectId: "dd95e93f-f51a-4d97-9db6-35d9c765e290",
      },
    },
  };
};
