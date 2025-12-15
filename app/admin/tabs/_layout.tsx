// app/admin/tabs/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';

export default function AdminTabLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // 🎯 FINAL PERFECT LOGIC:
  // ANDROID:
  // - 3-button nav → insets.bottom = 0 → tab bar sits flush at bottom
  // - Gesture nav → insets.bottom > 0 → lift slightly above gesture bar
  //
  // iOS:
  // - Lift above home indicator using insets.bottom
  const bottomOffset =
    Platform.OS === 'ios'
      ? insets.bottom + 6
      : insets.bottom > 0
      ? insets.bottom - 4
      : 0; // <-- PERFECT for 3-button nav (no gray space)

  const tabBarDynamicStyle = {
    bottom: bottomOffset,
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: [styles.tabBar, tabBarDynamicStyle],
        tabBarItemStyle: styles.tabBarItem,

        // ICONS
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          switch (route.name) {
              case 'admin-home':
                iconName = focused ? 'home' : 'home-outline';
                break;

              case 'logs':
                iconName = focused ? 'grid' : 'grid-outline';
                break;

              case 'view-stakeholders':
                iconName = focused ? 'people' : 'people-outline';
                break;

              case 'connect-instructions':
                iconName = focused ? 'time' : 'time-outline';
                break;

              case 'admin-profile':
                iconName = focused ? 'person' : 'person-outline';
                break;

              default:
                iconName = focused ? 'home' : 'home-outline';
            }


          return (
            <View style={styles.iconWrapper}>
              <View
                style={[
                  styles.iconCircle,
                  focused && styles.focusedCircle,
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={24}
                  color={focused ? '#fff' : '#888'}
                />
              </View>
            </View>
          );
        },
      })}
    >
      {/* Visible tabs */}
      <Tabs.Screen name="admin-home" />
      <Tabs.Screen name="logs" />
      <Tabs.Screen name="connect-instructions" />
      <Tabs.Screen name="admin-profile" />
  

      {/* Hidden routes */}
      <Tabs.Screen name="farmers" options={{ href: null }} />
      <Tabs.Screen name="prices" options={{ href: null }} />
      <Tabs.Screen name="add-farmer" options={{ href: null }} />
      <Tabs.Screen name="edit-price" options={{ href: null }} />
      <Tabs.Screen name="view-stakeholders" options={{ href: null }} />

    </Tabs>

      

  );
  
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    height: 70,

    backgroundColor: '#fff',
    borderRadius: 16,

    paddingTop: 10,
    paddingBottom: 10,

    // Shadow
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6,
    elevation: 19,
  },

  tabBarItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  focusedCircle: {
    backgroundColor: '#2e7d32',
  },
});
