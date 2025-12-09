 //app/(stakeholder)/tabs/_layout.tsx


import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StakeholderTabLayout() {
  const insets = useSafeAreaInsets();

 
  const bottomOffset =
    Platform.OS === 'ios'
      ? insets.bottom + 6
      : insets.bottom > 0
      ? insets.bottom - 4
      : 0;

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
        tabBarIcon: ({ focused }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home-outline';

          switch (route.name) {
            case 'stakeholder-home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'connect-instructions':
              iconName = focused
                ? 'hardware-chip'
                : 'hardware-chip-outline';
              break;
            case 'history':
              iconName = focused ? 'time' : 'time-outline';
              break;
            case 'stakeholder-profile':
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
      <Tabs.Screen name="stakeholder-home" />
      <Tabs.Screen name="connect-instructions" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="stakeholder-profile" />
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
