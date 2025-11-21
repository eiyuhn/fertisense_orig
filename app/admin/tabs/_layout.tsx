import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
// Removed Image, useMemo, and BASE_URL imports as they are no longer needed
// to display the profile icon.
import { Platform, StyleSheet, View } from 'react-native';
import { useAuth } from '../../../context/AuthContext';

export default function AdminTabLayout() {
  // 'user' is still fetched but no longer used for the tab bar icon logic.
  const { user } = useAuth();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarIcon: ({ focused }) => {
          // Non-profile tabs use Ionicons mapping:
          if (route.name !== 'admin-profile') {
            let iconName: keyof typeof Ionicons.glyphMap = 'home';
            switch (route.name) {
              case 'admin-home':
                iconName = 'home';
                break;
              case 'logs':
                iconName = focused ? 'grid' : 'grid-outline';
                break;
              case 'connect-instructions':
                iconName = focused ? 'time' : 'time-outline';
                break;
              default:
                iconName = focused ? 'home' : 'home-outline';
            }
            return (
              <View style={styles.iconWrapper}>
                <View style={[styles.iconCircle, focused && styles.focusedCircle]}>
                  <Ionicons name={iconName} size={24} color={focused ? '#fff' : '#888'} />
                </View>
              </View>
            );
          }

          // ✅ Profile tab is now simplified to always use the Ionicon
          return (
            <View style={styles.iconWrapper}>
              <View style={[styles.iconCircle, focused && styles.focusedCircle]}>
                <Ionicons
                  name={focused ? 'person' : 'person-outline'}
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
      {/* Hidden routes under /tabs */}
      <Tabs.Screen name="farmers" options={{ href: null }} />
      <Tabs.Screen name="prices" options={{ href: null }} />
      <Tabs.Screen name="add-farmer" options={{ href: null }} />
      <Tabs.Screen name="edit-price" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 90,
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 16 : 10,
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