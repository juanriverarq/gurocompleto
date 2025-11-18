
import { useState } from "react";
import CardBox from "src/components/shared/CardBox";
import * as listFeatureData from "../Data";
import { Icon } from "@iconify/react";

const AllFeatures = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const categories = ["Todos", "Core", "IA", "Comercial", "Marketing", "Integración", "Premium"];

  const filteredFeatures = selectedCategory === "Todos" 
    ? listFeatureData.listFeature 
    : listFeatureData.listFeature.filter((item: any) => item.category === selectedCategory);

  return (
    <>
      <div className="md:py-20 py-12 relative bg-white dark:bg-dark" id="caracteristicas">
        <div className="container px-4">
          <div className="lg:w-2/5 w-full mx-auto text-center">
            <p
              className="text-sm font-medium text-primary uppercase "
              data-aos="fade-left"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Todo lo que necesitas
            </p>
            <h2
              className="text-center sm:text-4xl text-xl font-bold sm:!leading-[45px] leading-tight"
              data-aos="fade-right"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Funciones Avanzadas del Software de Seguros Guro
            </h2>
          </div>

          {/* Filtro por categoría */}
          <div className="flex flex-wrap justify-center gap-3 mt-8 sm:mt-12" data-aos="fade-up" data-aos-delay="300">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 sm:px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  selectedCategory === category
                    ? "bg-primary text-white shadow-lg scale-105"
                    : "bg-lightprimary text-primary hover:bg-primary hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-12 gap-6 sm:gap-[30px] mt-8 sm:mt-12">
            {filteredFeatures.map((item: any, index: number) => (
              <div
                className="xl:col-span-3 lg:col-span-4 md:col-span-6 col-span-12"
                key={index}
                data-aos="fade-up"
                data-aos-delay="200"
                data-aos-duration="1000"
              >
                <CardBox
                  data-aos="fade-up"
                  data-aos-delay="200"
                  data-aos-duration="1000"
                  className="p-4 text-center !shadow-none"
                >
                  <span className="mx-auto">
                    <Icon icon={item.featureicon} height={40} className="text-primary" />
                  </span>
                  <h5 className="font-semibold text-lg text-dark dark:text-white mt-2 ">
                    {item.title}
                  </h5>
                  <p className="text-sm text-ld opacity-90">{item.subtitle}</p>
                </CardBox>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default AllFeatures;
