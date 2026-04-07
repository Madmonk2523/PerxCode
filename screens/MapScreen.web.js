import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Map is mobile-only</Text>
        <Text style={styles.body}>
          The live map uses native APIs and runs on iOS/Android. Wallet and Profile still work on web.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f6f8fb',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e4e7ec',
    padding: 18,
  },
  title: {
    color: '#101828',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
    color: '#667085',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
