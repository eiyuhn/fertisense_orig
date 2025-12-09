// app/(guest)/tabs/_layout.tsx  (adjust path if different)
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function GuestTabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60; // base height for items

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          // dynamic height so it never overlaps gesture bar
          height:
            tabBarHeight +
            insets.bottom +
            (Platform.OS === 'android' ? 6 : 0),
          position: 'absolute',
          bottom: 0,          // stick to the bottom, safe area handled by padding
          left: 0,
          right: 0,
          backgroundColor: '#fff',
          paddingBottom: insets.bottom + 5, // space for gesture bar / nav bar
          paddingTop: 10,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowOffset: { width: 0, height: -2 },
          shadowRadius: 4,
          elevation: 10,
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          switch (route.name) {
            case 'guest-home':
              iconName = 'home';
              break;
            case 'connect-instructions':
              iconName = 'hardware-chip-outline';
              break;
          }

          return (
            <View style={styles.iconWrapper}>
              <View
                style={[styles.iconCircle, focused && styles.focusedCircle]}
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
      <Tabs.Screen name="guest-home" />
      <Tabs.Screen name="connect-instructions" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
