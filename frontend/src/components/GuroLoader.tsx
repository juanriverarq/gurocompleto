import Lottie from 'lottie-react';
import loaderAnimation from '../assets/LOTTIE-LOADING-2.json';

interface GuroLoaderProps {
  size?: number;
  message?: string;
  fullScreen?: boolean;
}

const GuroLoader = ({ size = 120, message }: GuroLoaderProps) => {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        backgroundImage: 'url(https://framerusercontent.com/images/6vqDsl7xtgechRbMSo6yAkGE.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'bottom center',
        backgroundRepeat: 'no-repeat',
        transform: 'rotate(180deg)',
      }}
    >
      <div style={{ transform: 'rotate(180deg)' }}>
        <div className="bg-white rounded-full p-6 shadow-2xl">
          <div className="flex flex-col items-center justify-center gap-2">
            <Lottie
              animationData={loaderAnimation}
              loop
              autoplay
              style={{ width: size, height: size }}
            />
            {message && (
              <p
                className="text-sm font-medium text-gray-400 tracking-[-0.01em]"
                style={{ fontFamily: "'General Sans', sans-serif" }}
              >
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuroLoader;
