
import CardBox from "src/components/shared/CardBox";
import * as listFeatureData from "../Data";
import { Icon } from "@iconify/react";

const AllFeatures = () => {
  return (
    <>
      <div className="md:py-20 py-12 relative bg-white dark:bg-dark" id="caracteristicas">
        <div className="container">
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
              className="text-center sm:text-4xl text-2xl font-bold sm:!leading-[45px]"
              data-aos="fade-right"
              data-aos-delay="200"
              data-aos-duration="1000"
            >
              Funciones Avanzadas del Software de Seguros Guro
            </h2>
          </div>
          <div className="grid grid-cols-12 gap-[30px] mt-20">
            {listFeatureData.listFeature.map((item, index) => (
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
