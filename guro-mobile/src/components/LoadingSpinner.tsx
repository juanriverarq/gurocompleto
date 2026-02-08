import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import LottieView from 'lottie-react-native';

const { width } = Dimensions.get('window');

interface LoadingSpinnerProps {
  size?: number;
  fullScreen?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 150, 
  fullScreen = true 
}) => {
  if (fullScreen) {
    return (
      <View style={styles.fullScreenContainer}>
        <LottieView
          source={require('../../LOTTIE-LOADING-2.json')}
          style={{ width: size, height: size }}
          autoPlay
          loop
        />
      </View>
    );
  }

  return (
    <View style={styles.inlineContainer}>
      <LottieView
        source={require('../../LOTTIE-LOADING-2.json')}
        style={{ width: size, height: size }}
        autoPlay
        loop
      />
    </View>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});

export default LoadingSpinner;
