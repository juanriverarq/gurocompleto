import  { useState, useRef } from "react";
import Slider from "react-slick";
import { Icon } from "@iconify/react";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import React from "react";
import review1 from "/src/assets/images/profile/user-2.jpg";
import review2 from "/src/assets/images/profile/user-3.jpg";
import review3 from "/src/assets/images/profile/user-4.jpg";
import quotesSvg from "/src/assets/images/front-pages/background/quotes.svg"

const userReview = [
  {
    img: review1,
    title: "María González",
    subtitle: "Directora Comercial, Seguros del Pacífico",
    review:
      "Guro transformó completamente nuestra operación. En 6 meses incrementamos nuestras ventas cruzadas en un 45% y reducimos el tiempo de procesamiento de pólizas en un 70%. El asistente IA es como tener un experto disponible las 24 horas.",
  },
  {
    img: review2,
    title: "Carlos Mendoza",
    subtitle: "Agente Independiente de Seguros",
    review:
      "Como agente independiente, Guro me permite competir con las grandes aseguradoras. La lectura automática de documentos me ahorra 3 horas diarias, y las sugerencias de ventas cruzadas han duplicado mis ingresos por cliente.",
  },
  {
    img: review3,
    title: "Ana Ruiz",
    subtitle: "CEO, Corredora Seguros Metropolitana",
    review:
      "La implementación de Guro fue sorprendentemente sencilla. En solo 2 semanas estábamos operando completamente. Nuestros clientes están fascinados con la rapidez de respuesta y la precisión en el procesamiento de sus solicitudes.",
  },
];

const ClientReviews = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = userReview.length;

  // Create a reference for the slider
  const sliderRef = useRef<Slider | null>(null);

  const settings = {
    className: "center",
    infinite: true,
    centerPadding: "60px",
    slidesToShow: 1,
    swipeToSlide: true,
    dots: false,
    arrows: false, // Disable default arrows to use custom ones
    beforeChange: ( newIndex: React.SetStateAction<number>) =>
      setCurrentSlide(newIndex),
  };

  return (
    <div className="lg:pt-24 pt-14 pb-14 dark:bg-dark">
      <div className="container-1218 mx-auto">
        <div className="grid grid-cols-12 gap-30 flex items-center">
          <div className="lg:col-span-5 col-span-12">
            <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-darklink dark:text-white">
              Lo que dicen nuestros clientes
            </h2>
            <p className="text-17 leading-[32px] sm:py-6 text-ld opacity-80">
              Profesionales del sector seguros que ya están transformando sus negocios con Guro.
            </p>
            {/* Custom Arrow & Counter Container */}
            <div className="flex  items-center md:mt-0 mt-4  gap-4 custom-controls">
              <PrevArrow
                onClick={() =>
                  sliderRef.current && sliderRef.current.slickPrev()
                }
              />
              <span className="counter text-15 font-medium text-ld opacity-80">
                {currentSlide + 1} / {totalSlides}
              </span>
              <NextArrow
                onClick={() =>
                  sliderRef.current && sliderRef.current.slickNext()
                }
              />
            </div>
          </div>
          <div className="lg:col-span-7 col-span-12">
            <div className="slider-container client-reviews lg:ps-6">
              <Slider ref={sliderRef} {...settings}>
                {userReview.map((item, index) => (
                  <div key={index}>
                    <p className="sm:text-2xl text-xl text-ld">{item.review}</p>
                    <div className="flex justify-between pt-10">
                      <div className="flex gap-4 items-center">
                        <img
                          src={item.img}
                          alt="review"
                          className="h-14 w-14 rounded-full"
                        />
                        <div>
                          <h6 className="text-xl font-bold mb-1">
                            {item.title}
                          </h6>
                          <p className="text-15 font-medium text-ld opacity-50">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>
                      <div className="ms-auto">
                        <span className="h-12 w-12 rounded-full bg-primary flex justify-center items-center">
                          <img
                            src={quotesSvg}
                            alt="icon"
                            height={20}
                            width={20}
                            style={{ width: "auto", height: "auto" }}
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </Slider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Custom next arrow component
const NextArrow = ({ onClick }: { onClick: () => void }) => {
  return (
    <div
      className="custom-arrow bg-lightgray dark:bg-darkgray rounded-full flex justify-center items-center cursor-pointer h-8 w-8 rtl:scale-x-[-1]"
      onClick={onClick}
    >
      <Icon
        icon="tabler:chevron-right"
        className="text-ld opacity-80 text-xl"
      />
    </div>
  );
};

// Custom previous arrow component
const PrevArrow = ({ onClick }: { onClick: () => void }) => {
  return (
    <div
      className="custom-arrow bg-lightgray dark:bg-darkgray rounded-full flex justify-center items-center cursor-pointer h-8 w-8 rtl:scale-x-[-1]"
      onClick={onClick}
    >
      <Icon
        icon="tabler:chevron-left"
        className="text-ld opacity-80 text-xl "
      />
    </div>
  );
};

export default ClientReviews;
