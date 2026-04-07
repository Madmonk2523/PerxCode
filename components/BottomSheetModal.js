import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = SCREEN_HEIGHT * 0.22;
const DISMISS_VELOCITY = 1150;

export default function BottomSheetModal({
  visible,
  onClose,
  children,
  expandable = false,
  collapsedOffset = SCREEN_HEIGHT * 0.2,
  expandedOffset = 10,
  startExpanded = false,
  expandRequestKey = 0,
  forceFullScreen = false,
  forceFullScreenRatio = 1,
  headerAction = null,
  showCloseButton = true,
  onSwipeUp = null,
  swipeUpDistance = 18,
  swipeUpVelocity = 380,
}) {
  const baseTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const dragTranslateY = useRef(new Animated.Value(0)).current;
  const translateY = useMemo(() => Animated.add(baseTranslateY, dragTranslateY), [baseTranslateY, dragTranslateY]);
  const snapPointRef = useRef(0);
  const normalizedForceRatio = Math.max(0.5, Math.min(1, Number(forceFullScreenRatio) || 1));
  const forceFullScreenSnap = SCREEN_HEIGHT * (1 - normalizedForceRatio);

  const backdropOpacity = useMemo(
    () =>
      translateY.interpolate({
        inputRange: [expandedOffset, collapsedOffset, SCREEN_HEIGHT],
        outputRange: [0.5, 0.42, 0],
        extrapolate: 'clamp',
      }),
    [collapsedOffset, expandedOffset, translateY]
  );

  const onBackdropPress = () => onClose?.();

  useEffect(() => {
    const initialSnap = forceFullScreen
      ? forceFullScreenSnap
      : expandable
        ? (startExpanded ? expandedOffset : collapsedOffset)
        : 0;

    if (visible) {
      snapPointRef.current = initialSnap;
      dragTranslateY.setValue(0);
      Animated.spring(baseTranslateY, {
        toValue: initialSnap,
        useNativeDriver: true,
        damping: 19,
        stiffness: 160,
      }).start();
      return;
    }

    dragTranslateY.setValue(0);
    Animated.timing(baseTranslateY, {
      toValue: SCREEN_HEIGHT,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [
    baseTranslateY,
    collapsedOffset,
    dragTranslateY,
    expandable,
    expandedOffset,
    forceFullScreen,
    forceFullScreenSnap,
    startExpanded,
    visible,
  ]);

  useEffect(() => {
    if (!visible || !expandable) return;
    if (forceFullScreen) return;
    snapPointRef.current = expandedOffset;
    dragTranslateY.setValue(0);
    Animated.spring(baseTranslateY, {
      toValue: expandedOffset,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
    }).start();
  }, [baseTranslateY, dragTranslateY, expandRequestKey, expandable, expandedOffset, forceFullScreen, visible]);

  useEffect(() => {
    if (!visible) return;
    if (!forceFullScreen) return;

    snapPointRef.current = forceFullScreenSnap;
    dragTranslateY.setValue(0);
    Animated.spring(baseTranslateY, {
      toValue: forceFullScreenSnap,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
    }).start();
  }, [baseTranslateY, dragTranslateY, forceFullScreen, forceFullScreenSnap, visible]);

  const onGestureEvent = useMemo(
    () => (event) => {
      const { translationY } = event.nativeEvent;
      const base = snapPointRef.current;
      const minSnap = expandable ? expandedOffset : 0;
      const maxSnap = SCREEN_HEIGHT;
      const proposed = base + translationY;
      const clampedPosition = Math.min(maxSnap, Math.max(minSnap, proposed));
      dragTranslateY.setValue(clampedPosition - base);
    },
    [dragTranslateY, expandable, expandedOffset]
  );

  const onHandlerStateChange = useMemo(
    () => (event) => {
      const { oldState, translationY, velocityY } = event.nativeEvent;
      if (oldState !== State.ACTIVE) return;

      const baseSnap = snapPointRef.current;
      const minSnap = expandable ? expandedOffset : 0;
      const releasedPosition = Math.min(SCREEN_HEIGHT, Math.max(minSnap, baseSnap + translationY));
      baseTranslateY.setValue(releasedPosition);
      dragTranslateY.setValue(0);

      if (translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY) {
        onClose?.();
        return;
      }

      if (!forceFullScreen && !expandable) {
        const shouldSwipeUp = translationY < -Math.max(4, swipeUpDistance) || velocityY < -Math.max(120, swipeUpVelocity);
        if (shouldSwipeUp) {
          onSwipeUp?.();
          Animated.spring(baseTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 18,
            stiffness: 170,
          }).start();
          return;
        }
      }

      if (forceFullScreen) {
        snapPointRef.current = forceFullScreenSnap;
        Animated.spring(baseTranslateY, {
          toValue: forceFullScreenSnap,
          useNativeDriver: true,
          damping: 18,
          stiffness: 170,
        }).start();
        return;
      }

      if (expandable) {
        const midpoint = (collapsedOffset + expandedOffset) / 2;
        const shouldExpand = releasedPosition <= midpoint || translationY < -16 || velocityY < -520;
        const nextSnap = shouldExpand ? expandedOffset : collapsedOffset;
        snapPointRef.current = nextSnap;
        Animated.spring(baseTranslateY, {
          toValue: nextSnap,
          useNativeDriver: true,
          damping: 18,
          stiffness: 170,
        }).start();
        return;
      }

      snapPointRef.current = 0;
      Animated.spring(baseTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 170,
      }).start();
    },
    [
      baseTranslateY,
      collapsedOffset,
      dragTranslateY,
      expandable,
      expandedOffset,
      forceFullScreen,
      forceFullScreenSnap,
      onClose,
      onSwipeUp,
      swipeUpDistance,
      swipeUpVelocity,
    ]
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdropShade, { opacity: backdropOpacity }]}>
          <Pressable style={styles.backdrop} onPress={onBackdropPress} />
        </Animated.View>

        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
          activeOffsetY={[-8, 8]}
          failOffsetX={[-18, 18]}
        >
          <Animated.View
            style={[
              styles.sheet,
              forceFullScreen && styles.sheetFullScreen,
              {
                maxHeight: forceFullScreen
                  ? SCREEN_HEIGHT * normalizedForceRatio
                  : expandable
                    ? SCREEN_HEIGHT * 0.985
                    : SCREEN_HEIGHT * 0.9,
              },
              { transform: [{ translateY }] },
            ]}
          >
            <View style={styles.gestureSurface}>
              <View style={styles.headerRow}>
                <View style={styles.handle} />
                <View style={styles.headerActions}>
                  {headerAction ? <View style={styles.headerActionSlot}>{headerAction}</View> : null}
                  {showCloseButton ? (
                    <Pressable style={styles.closePill} onPress={onClose}>
                      <Animated.Text style={styles.closeText}>Close</Animated.Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {children}
            </View>
          </Animated.View>
        </PanGestureHandler>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#12131A',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingBottom: 18,
    minHeight: 260,
  },
  sheetFullScreen: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    paddingTop: 6,
  },
  gestureSurface: {
    flex: 1,
  },
  headerRow: {
    position: 'relative',
    alignItems: 'center',
    minHeight: 38,
    justifyContent: 'center',
    zIndex: 20,
  },
  handle: {
    alignSelf: 'center',
    marginTop: 4,
    marginBottom: 8,
    width: 42,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  headerActions: {
    position: 'absolute',
    right: 0,
    top: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActionSlot: {
    marginRight: 2,
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
});
