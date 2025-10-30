import { useEffect } from "react";
import { Flowbite } from "flowbite-react";
import AOS from "aos";
import "aos/dist/aos.css";
import Development from "./animation/Development";
import LoginReg from "./login/LoginReg";
import customTheme from "src/utils/theme/custom-theme";
import Footer from "./footer/Footer";
import AllFeatures from "./features/AllFeatures";
import ClientReviews from "./reviews/ClientReviews";
import ProductDemos from "./productdemos/demos";
import LpHeader from "./header/Header"
import LpBanners from "./banner/banner"
import InsuranceBenefits from "./insurance-benefits/InsuranceBenefits";
import { FAQ } from "../front-pages/homepage/FAQ";
import { Packages } from "../front-pages/homepage/Packages";
import PricingCalculator from "./pricing-calculator/PricingCalculator";

const Landingpage = () => {
  useEffect(() => {
    AOS.init();
  }, []);
  return (
    <>
      <Flowbite theme={{ theme: customTheme }}>
        <div className="landingpage">
          <LpHeader />
          <LpBanners />
          <InsuranceBenefits />
          <ProductDemos />
          <Development />
          <ClientReviews />
          <AllFeatures />
          <PricingCalculator />
          <Packages />
          <FAQ />
          <LoginReg />
          <Footer />
        </div>
      </Flowbite>
    </>
  );
};

export default Landingpage;
