import { useContext, useEffect, useRef } from 'react';
import { CustomizerContext } from '../context/CustomizerContext';

/**
 * Wrapper that forces light mode while mounted.
 * Restores the previous mode on unmount.
 */
const ForceLightMode: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { activeMode, setActiveMode } = useContext(CustomizerContext);
  const previousMode = useRef(activeMode);

  useEffect(() => {
    previousMode.current = activeMode;
    if (activeMode !== 'light') {
      setActiveMode('light');
    }
    return () => {
      // Restore previous mode when leaving these pages
      if (previousMode.current !== 'light') {
        setActiveMode(previousMode.current);
      }
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
};

export default ForceLightMode;
