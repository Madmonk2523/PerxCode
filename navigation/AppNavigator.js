import React from 'react';
import { Pressable } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import MapScreen from '../screens/MapScreen';
import WalletScreen from '../screens/WalletScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
  Map: 'map-outline',
  Wallet: 'wallet-outline',
  Profile: 'person-circle-outline',
};

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#0B0B0F',
          borderTopColor: 'rgba(255,255,255,0.1)',
          paddingBottom: 10,
          paddingTop: 8,
          height: 72,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        tabBarButton: (props) => (
          <TouchableWithHaptic {...props} />
        ),
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function TouchableWithHaptic(props) {
  const { onPress, style, children, accessibilityState, accessibilityLabel, testID } = props;
  return (
    <Pressable
      style={style}
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={(e) => {
        Haptics.selectionAsync();
        onPress?.(e);
      }}
    >
      {children}
    </Pressable>
  );
}
