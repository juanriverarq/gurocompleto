import React, { useEffect, useRef } from 'react';
import { StyleSheet, Dimensions, ImageBackground } from 'react-native';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

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
    <ImageBackground
      source={require('../../assets/backgrounds/hero-gradient.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <LottieView
        ref={animationRef}
        source={require('../../LOTTIE.json')}
        style={styles.animation}
        autoPlay
        loop={false}
        onAnimationFinish={onAnimationFinish}
      />
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
