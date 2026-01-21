import { useState } from "react";
import { Icon } from "@iconify/react";
import { Link } from "react-router";

const AnnouncementBar = () => {
  // State to control the visibility of the div
  const [isVisible, setIsVisible] = useState(true);

  // Function to toggle the visibility
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  return (
    <>
      {isVisible && (
        <div className="bg-sky py-2 overflow-hidden relative before:absolute before:left-0 before:lg:inline-block before:hidden before:content-[''] before:bg-[url('/src/assets/images/front-pages/background/left-shape.png')] before:bg-no-repeat before:bg-contain before:top-0 before:w-[325px] before:h-[50px] after:absolute after:end-1/4 after:lg:inline-block after:hidden after:content-[''] after:bg-[url('/src/assets/images/front-pages/background/right-shape.png')] after:bg-no-repeat after:bg-contain after:top-0 after:w-[325px] after:h-[50px]">
          <div className="flex justify-center gap-2 sm:gap-4 items-center px-12 sm:px-4 relative z-10">
            <Link
              to="/comenzar"
              className="hidden sm:inline-block py-1 px-2 rounded-[8px] bg-lightbtn text-xs font-bold text-white hover:bg-primary transition-colors whitespace-nowrap"
            >
              7 DÍAS GRATIS
            </Link>
            <p className="text-xs sm:text-13 font-medium text-white opacity-90 text-center">
              <span className="sm:hidden">¡7 días gratis!</span>
              <span className="hidden sm:inline">¡Prueba Guro gratis! Revoluciona tu negocio de seguros con IA</span>
            </p>
            <Link 
              to="/comenzar" 
              className="text-xs font-bold text-white underline hover:text-secondary transition-colors whitespace-nowrap z-20"
            >
              <span className="sm:hidden">Probar →</span>
              <span className="hidden sm:inline">Comenzar ahora →</span>
            </Link>
          </div>
          <button 
            onClick={toggleVisibility} 
            className="absolute end-2 sm:end-4 top-1/2 -translate-y-1/2 z-30 p-1"
            aria-label="Cerrar"
          >
            <Icon
              icon="solar:close-circle-outline"
              className="text-secondary hover:text-white transition-colors"
              height={20}
            />
          </button>
        </div>
      )}
    </>
  );
};

export default AnnouncementBar;
