# FertiSense – IoT-Based Fertilizer Management System Streamlining NPK Recommendations for Rice Farming

**FertiSense** is an IoT-based agricultural application that connects to an ESP32 Access Point with an RS485 Modbus NPK + pH soil sensor to retrieve real-time soil nutrient data. It provides fertilizer recommendations, saves soil history, and supports role-based access (Admin, Stakeholder, Guest) through a React Native + Expo Router mobile application backed by a Node.js + MongoDB REST API.

---

## 🛠 Technology Stack

### Core Framework
* **React Native:** 0.81.5
* **Expo:** 54.0.23 with Expo Router 6.0.14
* **React:** 19.1.0
* **TypeScript:** ~5.9.2
* **Navigation:** Expo Router (file-based routing) + React Navigation 7.x

### State, Storage & Utility Libraries
* **AsyncStorage:** `@react-native-async-storage/async-storage`
* **Axios:** API communication
* **Expo Secure Store:** Secure credential storage
* **NetInfo:** `@react-native-community/netinfo` (Network monitoring)
* **Realm:** `@realm/react` (Local offline storage for future sync capabilities)

### Platform-Specific
* **Android Package:** `com.iannnn.fertisense`
* **Expo Build Properties:** Configure Android build system
* **Expo Dev Client:** For custom development builds
* **File System / Sharing / Print:** Via Expo SDK (image/pdf export features)

### Hardware & Firmware
* **Microcontroller:** ESP32 DOIT DevKit V1 (Wi-Fi Access Point mode)
* **Sensors:** RS485 Modbus 4-in-1 Sensor (N, P, K, pH)
* **Communication:** MAX485 module for ESP32 RS485 communication
* **Firmware:** PlatformIO C++ firmware
* **Local Endpoint:** REST Endpoints served on `http://192.168.4.1`

### Backend & Services
* **Runtime:** Node.js + Express (Custom REST API)
* **Database:** MongoDB Atlas (Cloud database)
* **Authentication:** JWT Authentication
* **Security:** bcrypt for password hashing
* **Recovery:** Twilio (SMS-based password recovery)

### Additional Libraries
* `expo-image`, `expo-image-picker`, `expo-linear-gradient`
* `react-native-vector-icons`
* `react-native-wifi-reborn` (Wi-Fi management for ESP32 AP)
* `react-native-modal`, `react-native-reanimated`
* `react-native-worklets-core`

---

## 📂 Project Structure

```text
fertisense/
├── fertisense-app/             # React Native (Expo) mobile app
│   ├── app/
│   │   ├── _layout.tsx         # Root file-based routing layout
│   │   ├── index.tsx           # App entry screen
│   │   ├── auth/               # Login, register, forgot password
│   │   ├── admin/              # Admin dashboard + farmer mgmt.
│   │   ├── stakeholder/        # Soil reading, history, profile
│   │   ├── guest/              # Guest soil reader (no saving)
│   │   └── connect/            # Connect to ESP32 AP
│   ├── components/             # UI components
│   ├── services/               # axios API services
│   ├── assets/                 # Images and fonts
│   ├── hooks/                  # Custom hooks
│   └── types/                  # TypeScript type definitions
│
├── fertisense-backend/         # Node.js + Express API
│   ├── controllers/
│   ├── routes/
│   ├── models/
│   ├── utils/
│   └── server.js
│
└── esp32-firmware/             # PlatformIO firmware
    ├── src/main.cpp            # RS485 Modbus + WiFi AP code
    ├── include/
    └── platformio.ini

```
---

## Key Features

### 1. RS485 Soil Sensor Reading (ESP32)
Reads N, P, K, pH via Modbus RTU.
* **Baud Rate:** 9600 | 8N1
* **Modbus registers:**
    * Nitrogen → `0x0001`
    * Phosphorus → `0x0002`
    * Potassium → `0x0003`
    * pH → `0x0004`
* Converts raw sensor bytes to human-readable values.
* Serves data via HTTP endpoints.

### 2. ESP32 Access Point Mode
* **SSID:** `ESP32-NPK`
* **IP Address:** `192.168.4.1`
* **Endpoints available offline:**
    * `/npk` – N, P, K values
    * `/all` – N, P, K, pH values
    * `/recommend` – Fertilizer suggestions

### 3. Mobile App Capabilities
* **Connectivity:** Connects to ESP32 Wi-Fi AP.
* **Functionality:** Reads soil nutrient data.
* **Navigation:** Role-based navigation.
* **Data:** Saves readings to backend (stakeholder).
* **Admin:** Admin farmer management.
* **Guest:** Guest mode (no login, no saving).

### 4. Backend REST Features
* JWT authentication.
* Role-based access.
* Farmer management.
* Reading histories per user.
* Fertilizer price management.

---

## Fertisense Communication Flow

1.  **User opens "Connect" screen**
    * App scans Wi-Fi networks (`react-native-wifi-reborn`).
2.  **User connects to ESP32-NPK AP**
    * App switches network context (internet lost temporarily).
3.  **App requests:**
    * `GET http://192.168.4.1/all`
    * `GET http://192.168.4.1/recommend`
4.  **ESP32:**
    * Reads RS485 sensor via Modbus.
    * Parses N, P, K, pH.
    * Returns JSON response.
5.  **Stakeholder:**
    * After reading, app switches back to internet.
    * Saves reading via backend API.
6.  **Admin:**
    * Adds farmers.
    * Updates fertilizer prices.

---

## 📦 Build & Deployment

### Development Build
```bash
npm install
npx expo start
---
```
## Production Build (APK)
eas build --platform android --profile production

## Backend Deployment
cd fertisense-backend
npm install
npm start
