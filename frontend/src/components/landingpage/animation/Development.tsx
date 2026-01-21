
import BannerXs from "/src/assets/images/landingpage/background/slider-group-xs.webp";
import BannerSm from "/src/assets/images/landingpage/background/slider-group-sm.webp";
import BannerLg from "/src/assets/images/landingpage/background/slider-group.webp";

const Development = () => {
  return (
    <>
      <div className="bg-lightgray dark:bg-darkgray md:py-20 py-12">
                <div className="container px-4">
         

          <div
            className="lg:w-3/5 w-full mx-auto"
            data-aos="fade-up"
            data-aos-duration="500"
          >
            <h2 className="text-center sm:text-4xl text-xl mt-8 font-bold sm:!leading-[45px] leading-tight">
              Plataforma Todo-en-Uno & Potenciada por IA para el Sector Asegurador
            </h2>
          </div>
        </div>

        <div className="flex flex-row w-full position-relative overflow-hidden pt-8">
          <div className="slider-group">
            <img 
              src={BannerLg} 
              srcSet={`${BannerXs} 800w, ${BannerSm} 1500w, ${BannerLg} 3693w`}
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 150vw, 100vw"
              alt="Guro Dashboard - Plataforma de gestión de seguros con IA" 
              className="max-w-none w-[1800px] lg:w-[2400px] xl:w-[3000px]" 
              height={400} 
              loading="lazy" 
            />
          </div>
          <div className="slider-group">
            <img 
              src={BannerLg} 
              srcSet={`${BannerXs} 800w, ${BannerSm} 1500w, ${BannerLg} 3693w`}
              sizes="(max-width: 480px) 100vw, (max-width: 768px) 150vw, 100vw"
              alt="Guro Dashboard - Plataforma de gestión de seguros con IA" 
              className="max-w-none w-[1800px] lg:w-[2400px] xl:w-[3000px]" 
              height={400} 
              loading="lazy" 
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Development;
