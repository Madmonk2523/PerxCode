import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View, Pressable } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme.js';

export default function ClaimVerificationModal({ visible, onClose, locationName, rewardValue }) {
  const [secondsLeft, setSecondsLeft] = useState(180);
  const [code, setCode] = useState('PERX-0000');

  useEffect(() => {
    if (!visible) return;
    setCode(`PERX-${Math.floor(1000 + Math.random() * 9000)}`);
    setSecondsLeft(180);
    const t = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(t);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [visible]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Show this to staff</Text>
          <Text style={styles.sub}>{locationName}</Text>
          <Text style={styles.perx}>+{rewardValue} PERX</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.timer}>Expires in {mm}:{ss}</Text>

          <Pressable style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 22,
    alignItems: 'center',
  },
  title: { color: '#fff', fontSize: 23, fontWeight: '800' },
  sub: { color: COLORS.textSoft, marginTop: 5 },
  perx: { color: COLORS.accent, fontSize: 19, fontWeight: '800', marginTop: 10 },
  code: {
    marginTop: 16,
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
  },
  timer: { color: '#FBBF24', marginTop: 8, fontWeight: '700' },
  button: {
    marginTop: 18,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: RADIUS.lg,
  },
  buttonText: { color: '#fff', fontWeight: '800' },
});
