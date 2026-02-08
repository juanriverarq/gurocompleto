import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onAnimationFinish: () => void;
}

const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onAnimationFinish }) => {
  const animationRef = useRef<LottieView>(null);

  useEffect(() => {
    if (animationRef.current) {
      animationRef.current.play();
    }
  }, []);

  return (
    <View style={styles.container}>
      <LottieView
        ref={animationRef}
        source={require('../../LOTTIE.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        onAnimationFinish={onAnimationFinish}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#6172FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: width * 1.5,
    height: width * 1.5,
    backgroundColor: 'transparent',
  },
});

export default AnimatedSplash;
