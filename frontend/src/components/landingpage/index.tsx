import { useEffect, lazy, Suspense } from "react";
import { Flowbite } from "flowbite-react";
import customTheme from "src/utils/theme/custom-theme";

// Componentes above-the-fold (carga inmediata)
import LpHeader from "./header/Header";
import LpBanners from "./banner/banner";
import AnnouncementBar from "../front-pages/layout/AnnouncementBar";

// Componentes below-the-fold (lazy load)
const InsuranceBenefits = lazy(() => import("./insurance-benefits/InsuranceBenefits"));
const ProductDemos = lazy(() => import("./productdemos/demos"));
const Development = lazy(() => import("./animation/Development"));
const ClientReviews = lazy(() => import("./reviews/ClientReviews"));
const AllFeatures = lazy(() => import("./features/AllFeatures"));
const FAQ = lazy(() => import("../front-pages/homepage/FAQ").then(m => ({ default: m.FAQ })));
const LoginReg = lazy(() => import("./login/LoginReg"));
const Footer = lazy(() => import("./footer/Footer"));

const Landingpage = () => {
  useEffect(() => {
    // Lazy load AOS para no bloquear el render inicial
    import('aos').then((AOS) => {
      import('aos/dist/aos.css');
      AOS.default.init({ once: true, duration: 600 });
    });
  }, []);
  return (
    <>
      <Flowbite theme={{ theme: customTheme }}>
        <div className="landingpage">
          <AnnouncementBar />
          <LpHeader />
          <LpBanners />
          <Suspense fallback={<div className="min-h-[200px]" />}>
            <InsuranceBenefits />
            <ProductDemos />
            <Development />
            <ClientReviews />
            <AllFeatures />
            <FAQ />
            <LoginReg />
            <Footer />
          </Suspense>
        </div>
      </Flowbite>
    </>
  );
};

export default Landingpage;
