import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { buildInventory, loadWallet, redeemWalletLocation } from '../services/demoModeService';
import RedemptionModal from '../components/RedemptionModal';
import { auth } from '../services/firebase';

const DEMO_ALLOWED_EMAIL = 'chasemallor@gmail.com';

function formatTime(ms) {
  if (!ms) return 'Just now';
  const date = new Date(ms);
  return date.toLocaleString();
}

function InventoryRow({ item, onUseReward }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowAccent} />
      <View style={styles.rowLeft}>
        <Text style={styles.rowKicker}>PARTNER LOCATION</Text>
        <Text style={styles.rowTitle}>{item.locationName}</Text>
        <Text style={styles.rowSub}>Usable only at {item.locationName}</Text>
      </View>

      <View style={styles.rowRight}>
        <Text style={styles.rowAmountLabel}>PERX</Text>
        <Text style={styles.rowAmount}>{item.quantity}</Text>
        <TouchableOpacity style={styles.useBtn} onPress={() => onUseReward(item)} activeOpacity={0.85}>
          <Text style={styles.useBtnText}>Use Reward</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HistoryRow({ item, kind }) {
  const title = item?.locationName || 'Unknown location';
  const amount = Number(item?.reward || 0);
  const timestamp = kind === 'redeemed' ? item?.redeemedAt : item?.expiredAt;

  return (
    <View style={styles.historyRow}>
      <View style={styles.historyLeft}>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={styles.historyTime}>{formatTime(timestamp)}</Text>
      </View>
      <Text style={[styles.historyAmount, kind === 'redeemed' ? styles.historyAmountRedeemed : styles.historyAmountExpired]}>
        {kind === 'redeemed' ? `-$${amount}` : `$${amount}`}
      </Text>
    </View>
  );
}

export default function WalletScreen() {
  const isDemoUser = (auth.currentUser?.email || '').trim().toLowerCase() === DEMO_ALLOWED_EMAIL;
  const [wallet, setWallet] = useState({ balance: 0, claims: [], redemptions: [], expiredClaims: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReward, setSelectedReward] = useState(null);
  const [redeeming, setRedeeming] = useState(false);
  const animatedBalance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!isDemoUser) {
      setWallet({ balance: 0, claims: [], redemptions: [], expiredClaims: [] });
      animatedBalance.setValue(0);
      return;
    }

    const next = await loadWallet();
    setWallet(next);
    Animated.timing(animatedBalance, {
      toValue: Number(next.balance || 0),
      duration: 320,
      useNativeDriver: false,
    }).start();
  }, [animatedBalance, isDemoUser]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const inventory = useMemo(() => buildInventory(wallet.claims), [wallet.claims]);
  const redeemed = useMemo(() => (Array.isArray(wallet.redemptions) ? wallet.redemptions : []), [wallet.redemptions]);
  const expired = useMemo(() => (Array.isArray(wallet.expiredClaims) ? wallet.expiredClaims : []), [wallet.expiredClaims]);

  const consumeLocationRewards = useCallback(
    async (locationId) => {
      if (!locationId) return;
      const next = await redeemWalletLocation(locationId);
      setWallet(next);
      Animated.timing(animatedBalance, {
        toValue: Number(next.balance || 0),
        duration: 280,
        useNativeDriver: false,
      }).start();
    },
    [animatedBalance]
  );

  const onRedeemReward = useCallback(
    async (reward) => {
      if (!reward?.locationId || redeeming) return;
      setRedeeming(true);
      try {
        await consumeLocationRewards(reward.locationId);
        setSelectedReward(null);
      } finally {
        setRedeeming(false);
      }
    },
    [consumeLocationRewards, redeeming]
  );

  const onCloseRedemption = useCallback(async () => {
    const locationId = selectedReward?.locationId;
    setSelectedReward(null);
    if (!locationId || redeeming) return;

    setRedeeming(true);
    try {
      await consumeLocationRewards(locationId);
    } finally {
      setRedeeming(false);
    }
  }, [consumeLocationRewards, redeeming, selectedReward]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.heading}>Wallet</Text>
        <Text style={styles.caption}>
          {isDemoUser ? 'Inventory of your PERX by location' : 'Live wallet activates for business-backed rewards'}
        </Text>
      </View>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total PERX</Text>
        <Animated.Text style={styles.balanceValue}>{animatedBalance}</Animated.Text>
        <Text style={styles.balanceUnit}>Across all locations</Text>
      </View>

      <View style={styles.noticeCard}>
        <Text style={styles.noticeText}>
          {isDemoUser
            ? "Each location's PERX is only usable at that specific location."
            : 'Demo inventory is hidden on this account.'}
        </Text>
      </View>

      <Text style={styles.section}>Inventory</Text>

      <FlatList
        data={inventory}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InventoryRow
            item={item}
            onUseReward={(entry) => {
              const claim = (entry.claims || [])[0] || null;
              if (!claim) return;
              Alert.alert(
                'Ready to redeem?',
                'Are you sure you are at the store and ready to redeem your PERX?',
                [
                  { text: 'Not yet', style: 'cancel' },
                  {
                    text: 'Continue',
                    onPress: () => setSelectedReward(claim),
                  },
                ]
              );
            }}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563EB" />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No inventory yet</Text>
            <Text style={styles.emptyBody}>Claim rewards on the map to populate this inventory.</Text>
          </View>
        }
        ListFooterComponent={
          <View>
            <Text style={styles.section}>Redeemed</Text>
            {redeemed.length ? (
              <View style={styles.historyCard}>
                {redeemed.slice(0, 10).map((item) => (
                  <HistoryRow key={item.id} item={item} kind="redeemed" />
                ))}
              </View>
            ) : (
              <View style={styles.subtleEmpty}>
                <Text style={styles.subtleEmptyText}>No redeemed PERX yet.</Text>
              </View>
            )}

            <Text style={styles.section}>Expired</Text>
            {expired.length ? (
              <View style={styles.historyCard}>
                {expired.slice(0, 10).map((item) => (
                  <HistoryRow key={item.id} item={item} kind="expired" />
                ))}
              </View>
            ) : (
              <View style={styles.subtleEmpty}>
                <Text style={styles.subtleEmptyText}>No expired PERX right now.</Text>
              </View>
            )}
          </View>
        }
      />

      <RedemptionModal
        visible={!!selectedReward}
        reward={selectedReward}
        onClose={onCloseRedemption}
        onRedeem={onRedeemReward}
        redeeming={redeeming}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B0B0F' },
  header: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  heading: { color: '#fff', fontSize: 30, fontWeight: '800' },
  caption: { color: '#B6BCC8', marginTop: 4, fontSize: 14, lineHeight: 20 },

  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 22,
    alignItems: 'center',
    backgroundColor: '#131620',
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.5)',
  },
  balanceLabel: { color: '#B6BCC8', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 52, fontWeight: '800', lineHeight: 58, marginTop: 4 },
  balanceUnit: { color: '#93C5FD', fontWeight: '700', letterSpacing: 0.4 },

  noticeCard: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.35)',
  },
  noticeText: { color: '#DBEAFE', fontSize: 12, lineHeight: 17 },

  section: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 20,
    color: '#E2E8F0',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1.1,
  },
  list: { paddingHorizontal: 20, paddingBottom: 24 },

  row: {
    backgroundColor: '#101622',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.2)',
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  rowAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#60A5FA',
  },
  rowLeft: { flex: 1, paddingRight: 10, paddingLeft: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowKicker: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  rowTitle: { color: '#fff', fontWeight: '800', fontSize: 16, marginTop: 3 },
  rowSub: { color: '#A8B2C5', marginTop: 3, fontSize: 12, lineHeight: 16 },
  rowAmountLabel: {
    color: '#86EFAC',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
  },
  rowAmount: { color: '#22C55E', fontWeight: '900', fontSize: 30, lineHeight: 34, marginBottom: 7 },

  useBtn: {
    borderRadius: 999,
    backgroundColor: '#2563EB',
    borderWidth: 1,
    borderColor: 'rgba(191,219,254,0.6)',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  useBtnText: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 0.2 },

  empty: {
    backgroundColor: '#101622',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(147,197,253,0.22)',
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTitle: { color: '#fff', fontWeight: '700', fontSize: 17 },
  emptyBody: { color: '#9CA3AF', textAlign: 'center', marginTop: 8, fontSize: 13 },

  historyCard: {
    borderRadius: 16,
    backgroundColor: '#0F1522',
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    overflow: 'hidden',
    marginBottom: 14,
  },
  historyRow: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyLeft: {
    flex: 1,
  },
  historyTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
  },
  historyTime: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: 11,
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: '900',
  },
  historyAmountRedeemed: {
    color: '#22C55E',
  },
  historyAmountExpired: {
    color: '#F59E0B',
  },
  subtleEmpty: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(148,163,184,0.1)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  subtleEmptyText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
});
