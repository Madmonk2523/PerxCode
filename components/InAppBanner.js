import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

export default function InAppBanner({ message }) {
  const y = useRef(new Animated.Value(-40)).current;
  const o = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.sequence([
      Animated.parallel([
        Animated.timing(y, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]),
      Animated.delay(1800),
      Animated.parallel([
        Animated.timing(y, { toValue: -40, duration: 180, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
  }, [message, o, y]);

  return (
    <Animated.View style={[styles.wrap, { opacity: o, transform: [{ translateY: y }] }]}> 
      <View style={styles.card}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 108, left: 16, right: 16, zIndex: 50 },
  card: {
    backgroundColor: 'rgba(37,99,235,0.92)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  text: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
