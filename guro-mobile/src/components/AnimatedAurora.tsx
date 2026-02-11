import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: any;
}

const AnimatedAurora: React.FC<Props> = ({ children, style }) => {
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (val: Animated.Value, duration: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, useNativeDriver: false }),
          Animated.timing(val, { toValue: 0, duration, useNativeDriver: false }),
        ])
      ).start();

    loop(anim1, 6000);
    loop(anim2, 8000);
    loop(anim3, 10000);
  }, []);

  const orb1X = anim1.interpolate({ inputRange: [0, 1], outputRange: ['-20%', '30%'] });
  const orb1Y = anim1.interpolate({ inputRange: [0, 1], outputRange: ['-10%', '20%'] });
  const orb2X = anim2.interpolate({ inputRange: [0, 1], outputRange: ['50%', '10%'] });
  const orb2Y = anim2.interpolate({ inputRange: [0, 1], outputRange: ['10%', '-20%'] });
  const orb3X = anim3.interpolate({ inputRange: [0, 1], outputRange: ['20%', '60%'] });
  const orb3Y = anim3.interpolate({ inputRange: [0, 1], outputRange: ['-30%', '10%'] });

  return (
    <View style={[styles.container, style]}>
      {/* Base dark */}
      <View style={styles.baseBg} />

      {/* Orb 1 — purple */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: 220,
            height: 220,
            backgroundColor: 'rgba(87, 60, 255, 0.35)',
            left: orb1X,
            top: orb1Y,
          },
        ]}
      />

      {/* Orb 2 — blue/teal */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: 180,
            height: 180,
            backgroundColor: 'rgba(22, 205, 199, 0.2)',
            left: orb2X,
            top: orb2Y,
          },
        ]}
      />

      {/* Orb 3 — indigo */}
      <Animated.View
        style={[
          styles.orb,
          {
            width: 200,
            height: 200,
            backgroundColor: 'rgba(99, 91, 255, 0.25)',
            left: orb3X,
            top: orb3Y,
          },
        ]}
      />

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  baseBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1035',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  content: {
    position: 'relative',
    zIndex: 10,
  },
});

export default AnimatedAurora;
