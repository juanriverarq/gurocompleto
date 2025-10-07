
import Banner from "/src/assets/images/landingpage/background/slider-group.png";

const Development = () => {
  return (
    <>
      <div className="bg-lightgray dark:bg-darkgray md:py-20 py-12">
                <div className="container">
         

          <div
            className="lg:w-3/5 w-full mx-auto"
            data-aos="fade-up"
            data-aos-duration="500"
          >
            <h2 className="text-center sm:text-4xl text-2xl mt-8 font-bold sm:!leading-[45px]">
              Plataforma Todo-en-Uno & Potenciada por IA para el Sector Asegurador
            </h2>
          </div>
        </div>

        <div className="flex flex-row w-full position-relative overflow-hidden pt-8">
          <div className="slider-group">
            <img src={Banner} alt="Guro Dashboard" className="max-w-max" />
          </div>
          <div className="slider-group">
            <img src={Banner} alt="Guro Dashboard" className="max-w-max" />
          </div>
        </div>
      </div>
    </>
  );
};

export default Development;
