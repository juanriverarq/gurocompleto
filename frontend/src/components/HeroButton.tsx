import React from 'react';
import { Icon } from '@iconify/react';

interface HeroButtonProps {
  icon?: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const sizeConfig = {
  sm: { height: 'h-9', iconW: 'w-9', iconSize: 'w-3.5 h-3.5', textSize: 'text-[10px] tracking-[0.1em]', pr: 'pr-3.5' },
  md: { height: 'h-10', iconW: 'w-10', iconSize: 'w-4 h-4', textSize: 'text-[11px] tracking-[0.12em]', pr: 'pr-4' },
  lg: { height: 'h-[48px]', iconW: 'w-[48px]', iconSize: 'w-5 h-5', textSize: 'text-[11px] tracking-[0.15em]', pr: 'pr-5' },
};

const HeroButton: React.FC<HeroButtonProps> = ({
  icon = 'solar:add-circle-bold-duotone',
  children,
  onClick,
  className = '',
  size = 'md',
  disabled = false,
}) => {
  const s = sizeConfig[size];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative inline-flex items-center bg-[#0d0d0d] rounded-2xl ${s.height} shadow-lg shadow-black/10 overflow-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <span className={`absolute inset-y-0 left-0 ${s.iconW} group-hover:w-full bg-[#573CFF] rounded-2xl transition-all duration-300 ease-out`} />
      <span className={`relative z-10 flex items-center justify-center ${s.iconW} h-full flex-shrink-0`}>
        <Icon icon={icon} className={`${s.iconSize} text-white`} />
      </span>
      <span className={`relative z-10 ${s.pr} ${s.textSize} font-bold text-white uppercase whitespace-nowrap`}>
        {children}
      </span>
    </button>
  );
};

export default HeroButton;
