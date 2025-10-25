import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

export default function GuestTabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
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
              <View style={[styles.iconCircle, focused && styles.focusedCircle]}>
                <Ionicons name={iconName} size={24} color={focused ? '#fff' : '#888'} />
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
  tabBar: {
    height: 90,
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 16 : 0,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 0,
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