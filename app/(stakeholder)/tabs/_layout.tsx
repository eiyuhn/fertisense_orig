// =============================================================
// File: app/(stakeholder)/tabs/_layout.tsx
// Purpose: Defines the layout and styles for the stakeholder tabs
// =============================================================

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; // NEW: Import safe area hook

export default function StakeholderTabLayout() {
  const insets = useSafeAreaInsets(); // NEW: Get safe area insets

  const tabBarHeight = 60; // Base height for the tab bar items

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          // FIX: Dynamic height to accommodate safe area (gesture bar)
          height: tabBarHeight + insets.bottom + (Platform.OS === 'android' ? 10 : 0), 
          position: 'absolute',
          bottom: 0, // Set bottom to 0, and let padding handle the safe area
          left: 0, // Stretch across the full width
          right: 0,
          backgroundColor: '#fff',
          // FIX: Add padding to the bottom equal to the safe area inset, plus a little buffer
          paddingBottom: insets.bottom + 5, 
          paddingTop: 10,
          borderTopWidth: 0,
          // Re-adding border radius/shadow logic from old styles for aesthetics, 
          // but applying it to the content area using the wrapper styles below
          // We will use the custom styles for the aesthetic container, and these base styles for safe area.
        },
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          switch (route.name) {
            case 'stakeholder-home':
              iconName = 'home';
              break;
            case 'connect-instructions':
              iconName = 'hardware-chip-outline';
              break;
            case 'history':
              iconName = 'time';
              break;
            case 'stakeholder-profile':
              iconName = 'person';
              break;
          }

          return (
            // NEW: We wrap the content in a custom view to apply the aesthetic styles (like rounded corners and margin)
            <View style={styles.iconWrapper}>
              <View style={[styles.iconCircle, focused && styles.focusedCircle]}>
                <Ionicons name={iconName} size={24} color={focused ? '#fff' : '#888'} />
              </View>
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="stakeholder-home" />
      <Tabs.Screen name="connect-instructions" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="stakeholder-profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Removed complex fixed/absolute positioning from tabBar style and moved it to the Tabs options above
  // The styles below are simplified aesthetics and positioning
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
