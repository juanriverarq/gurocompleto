/**
 * Navigator component with minimap and zoom controls.
 * Dark mode implementation for the JointJS flow editor.
 */
import React from 'react';
import { Icon } from '@iconify/react';

interface NavigatorProps {
  show: boolean;
  zoom: number;
  minimapRef: React.RefObject<HTMLDivElement>;
  onZoomChange: (zoom: number) => void;
  onFitScreen: () => void;
  onFitWidth: () => void;
  onToggleMinimap: () => void;
  onMinimapMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  isPanningMinimap?: boolean;
}

const Navigator: React.FC<NavigatorProps> = ({
  show,
  zoom,
  minimapRef,
  onZoomChange,
  onFitScreen,
  onFitWidth,
  onToggleMinimap,
  onMinimapMouseDown,
  isPanningMinimap,
}) => {
  return (
    <div
      className={`absolute bottom-4 right-4 bg-[#111111] border border-[#1F1F1F] rounded-lg shadow-xl transition-all duration-200 z-10 ${
        show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      {/* Minimap */}
      {show && (
        <div className="relative p-2 border-b border-[#1F1F1F]">
          <div
            ref={minimapRef}
            className="relative bg-[#0A0A0A] rounded"
            style={{ width: '280px', height: '180px', cursor: isPanningMinimap ? 'grabbing' : 'crosshair' }}
            onMouseDown={onMinimapMouseDown}
          >
            {/* Viewport indicator */}
            <div
              data-mm-viewport
              className="absolute border-2 border-[#818CF8] bg-[#818CF8] bg-opacity-10"
              style={{
                boxShadow: '0 0 0 1px rgba(129, 140, 248, 0.3)',
                cursor: isPanningMinimap ? 'grabbing' : 'grab',
              }}
            />
          </div>
          <button
            onClick={onToggleMinimap}
            className="absolute top-1 right-1 p-1 rounded bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
            title="Ocultar minimapa"
          >
            <Icon icon="solar:close-circle-bold" width={12} />
          </button>
        </div>
      )}

      {/* Zoom controls */}
      <div className="p-2 flex items-center gap-2">
        <div className="flex items-center gap-1 bg-[#0A0A0A] border border-[#1F1F1F] rounded-lg p-1">
          <button
            onClick={() => onZoomChange(Math.max(0.25, zoom * 0.8))}
            className="p-1.5 rounded hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white transition-colors"
            title="Reducir zoom"
          >
            <Icon icon="solar:minus-circle-bold" width={14} />
          </button>
          <span className="px-2 text-xs font-medium text-[#F3F4F6] min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(3, zoom * 1.25))}
            className="p-1.5 rounded hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white transition-colors"
            title="Aumentar zoom"
          >
            <Icon icon="solar:add-circle-bold" width={14} />
          </button>
        </div>

        <div className="w-px h-6 bg-[#1F1F1F]" />

        {/* Layout controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={onFitScreen}
            className="p-1.5 rounded hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white transition-colors"
            title="Ajustar a pantalla"
          >
            <Icon icon="solar:maximize-square-bold" width={14} />
          </button>
          <button
            onClick={onFitWidth}
            className="p-1.5 rounded hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white transition-colors"
            title="Ajustar ancho"
          >
            <Icon icon="solar:fit-to-screen-bold" width={14} />
          </button>
        </div>

        {/* Toggle minimap button */}
        {!show && (
          <button
            onClick={onToggleMinimap}
            className="p-1.5 rounded hover:bg-[#1F1F1F] text-[#9CA3AF] hover:text-white transition-colors"
            title="Mostrar minimapa"
          >
            <Icon icon="solar:map-bold" width={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Navigator;
