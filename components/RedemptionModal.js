import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheetModal from './BottomSheetModal';

const formatCountdown = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const min = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const sec = String(totalSeconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
};

export default function RedemptionModal({ visible, reward, onClose, onRedeem, redeeming = false }) {
  const [now, setNow] = useState(Date.now());
  const [fullScreenMode, setFullScreenMode] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  useEffect(() => {
    if (!visible) setFullScreenMode(false);
  }, [visible]);

  const remainingMs = useMemo(() => {
    if (!reward?.expiresAt) return 0;
    return Math.max(0, reward.expiresAt - now);
  }, [now, reward]);

  const urgencyColor = remainingMs <= 60_000 ? '#FCA5A5' : '#93C5FD';

  const confirmRedeem = () => {
    Alert.alert(
      'Redeem this PERX now?',
      'Are you sure you are at the store and ready to redeem your PERX? This removes it from your wallet right away.',
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Redeem now',
          style: 'destructive',
          onPress: () => {
            onRedeem?.(reward);
          },
        },
      ]
    );
  };

  const onPressFullScreen = () => {
    setFullScreenMode(true);
  };

  const closeFullScreen = () => setFullScreenMode(false);
  const closeAll = () => {
    setFullScreenMode(false);
    onClose?.();
  };

  const content = (
    <>
      <View style={styles.topRow}>
        <Text style={styles.kicker}>READY TO REDEEM</Text>
        {!fullScreenMode ? (
          <Pressable style={styles.fullScreenBtn} onPress={onPressFullScreen}>
            <Text style={styles.fullScreenBtnText}>Full Screen</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.title, fullScreenMode && styles.titleCompact]}>Redeem Your Reward</Text>
      <Text style={styles.location}>{reward?.locationName || 'PERX Partner'}</Text>

      <View style={[styles.heroCard, fullScreenMode && styles.heroCardCompact]}>
        <Text style={styles.heroLabel}>Current reward value</Text>
        <View style={styles.heroRow}>
          <Text style={styles.currency}>$</Text>
          <Text style={[styles.amountValue, fullScreenMode && styles.amountValueCompact]}>{reward?.reward || 0}</Text>
          <Text style={styles.offText}>OFF</Text>
        </View>
        <Text style={styles.heroHint}>Apply this at checkout before payment is processed.</Text>
      </View>

      <View style={[styles.codeCard, fullScreenMode && styles.codeCardCompact]}>
        <Text style={styles.cashierLabel}>Show this code to staff</Text>
        <Text style={[styles.code, fullScreenMode && styles.codeCompact]}>{reward?.code || 'PERX-0000'}</Text>
        <Text style={[styles.timer, { color: urgencyColor }]}>Expires in {formatCountdown(remainingMs)}</Text>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Location</Text>
          <Text style={styles.infoValue}>{reward?.locationName || 'PERX Partner'}</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Code status</Text>
          <Text style={styles.infoValue}>Active</Text>
        </View>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipTitle}>Quick tips</Text>
        <Text style={styles.tipLine}>1. Open this screen only when you are ready to pay.</Text>
        <Text style={styles.tipLine}>2. Keep the code visible until staff confirms redemption.</Text>
      </View>

      <Pressable
        style={[styles.redeemButton, redeeming && styles.redeemButtonDisabled]}
        onPress={confirmRedeem}
        disabled={redeeming}
      >
        <Text style={styles.redeemButtonText}>{redeeming ? 'Redeeming...' : 'Redeem Reward'}</Text>
      </Pressable>

      {fullScreenMode ? (
        <Pressable style={styles.fullCloseButton} onPress={closeAll}>
          <Text style={styles.fullCloseButtonText}>Close</Text>
        </Pressable>
      ) : null}
    </>
  );

  if (fullScreenMode) {
    return (
      <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={closeFullScreen}>
        <SafeAreaView style={styles.fullRoot}>
          <View style={styles.fullGestureSurface}>
            <View style={styles.fullHeader}>
              <Text style={styles.fullTitle}>Redeem Reward</Text>
              <View style={styles.fullHeaderActions} />
            </View>

            <ScrollView
              style={styles.fullScroll}
              contentContainerStyle={styles.fullContainer}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {content}
            </ScrollView>
          </View>
        </SafeAreaView>
      </Modal>
    );
  }

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      showCloseButton={false}
      onSwipeUp={onPressFullScreen}
      swipeUpDistance={14}
      swipeUpVelocity={340}
    >
      <View style={styles.windowedContainer}>
        {content}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: {
    maxHeight: '100%',
  },
  container: {
    paddingBottom: 16,
  },
  windowedContainer: {
    paddingBottom: 16,
    minHeight: 520,
  },
  containerCompact: {
    paddingBottom: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  fullRoot: {
    flex: 1,
    backgroundColor: '#12131A',
  },
  fullGestureSurface: {
    flex: 1,
  },
  fullHeader: {
    minHeight: 56,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  fullTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  fullHeaderActions: {
    width: 12,
  },
  fullScroll: {
    flex: 1,
  },
  fullContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
  },
  fullScreenBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.55)',
    backgroundColor: 'rgba(37,99,235,0.18)',
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  fullScreenBtnText: {
    color: '#DBEAFE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  closePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  closeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  kicker: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
  },
  titleCompact: {
    fontSize: 26,
    lineHeight: 30,
  },
  location: {
    marginTop: 6,
    color: '#CBD5E1',
    fontSize: 15,
    fontWeight: '600',
  },
  heroCard: {
    marginTop: 16,
    borderRadius: 22,
    backgroundColor: '#17243B',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 16,
    shadowColor: '#0A1830',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 4,
  },
  heroCardCompact: {
    marginTop: 12,
    paddingVertical: 12,
  },
  heroLabel: {
    color: '#BFDBFE',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  heroRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  currency: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 5,
    marginRight: 4,
  },
  amountValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
    lineHeight: 50,
  },
  amountValueCompact: {
    fontSize: 42,
    lineHeight: 44,
  },
  offText: {
    marginLeft: 8,
    marginBottom: 8,
    color: '#DBEAFE',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroHint: {
    marginTop: 6,
    color: '#C7D2FE',
    fontSize: 12,
    lineHeight: 17,
  },
  codeCard: {
    marginTop: 13,
    borderRadius: 20,
    backgroundColor: '#0B0F18',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  codeCardCompact: {
    marginTop: 10,
    paddingVertical: 14,
  },
  cashierLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  code: {
    marginTop: 8,
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  codeCompact: {
    fontSize: 34,
  },
  timer: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  infoCard: {
    marginTop: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  infoRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  infoValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  tipCard: {
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(148,163,184,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tipTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  tipLine: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 17,
  },
  redeemButton: {
    marginTop: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.75)',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redeemButtonDisabled: {
    opacity: 0.7,
  },
  redeemButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  fullCloseButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.7)',
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  fullCloseButtonText: {
    color: '#FCA5A5',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
});
