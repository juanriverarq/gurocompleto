import React from 'react';
import { View, StyleSheet, Dimensions, ImageBackground } from 'react-native';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');
const LOTTIE_SIZE = width * 1.5;

interface LoadingSpinnerProps {
  size?: number;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size, 
  fullScreen = true 
}) => {
  if (fullScreen) {
    return (
      <ImageBackground
        source={require('../../assets/backgrounds/hero-gradient.png')}
        style={styles.fullScreenContainer}
        resizeMode="cover"
      >
        <LottieView
          source={require('../../LOTTIE.json')}
          style={styles.animation}
          autoPlay
          loop
        />
      </ImageBackground>
    );
  }

  const inlineSize = size || 150;
  return (
    <View style={styles.inlineContainer}>
      <LottieView
        source={require('../../LOTTIE-LOADING-2.json')}
        style={{ width: inlineSize, height: inlineSize }}
        autoPlay
        loop
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animation: {
    width: LOTTIE_SIZE,
    height: LOTTIE_SIZE,
    backgroundColor: 'transparent',
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default LoadingSpinner;
