// app/admin/tabs/_layout.tsx
import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const green = '#0d5213';
const lightGreen = '#c8e6c9';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: green,
          borderTopColor: green,
          height: 64,
          paddingTop: 6,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: lightGreen,
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
      }}
    >
      <Tabs.Screen
        name="admin-home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: 'Farmer Logs',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'reader' : 'reader-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="connect-instructions"
        options={{
          title: 'Connect',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'wifi' : 'wifi-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin-profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
      {/* Hidden routes living under /tabs */}
      <Tabs.Screen name="farmers" options={{ href: null }} />
      <Tabs.Screen name="prices" options={{ href: null }} />
      <Tabs.Screen name="add-farmer" options={{ href: null }} />
      <Tabs.Screen name="edit-price" options={{ href: null }} />
    </Tabs>
  );
}
