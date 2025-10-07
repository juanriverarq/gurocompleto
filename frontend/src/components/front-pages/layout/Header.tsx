import  { useState, useEffect } from "react";
import "flowbite";
import { Button } from "flowbite-react";
import Navigation from "./Navigation";
import MobileMenu from "./MobileMenu";
import FullLogo from "src/layouts/full/shared/logo/FullLogo";
import { Link } from "react-router";

const FrontHeader = () => {
  const [isSticky, setIsSticky] = useState(false);
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsSticky(true);
      } else {
        setIsSticky(false);
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <>
      <header
        className={` top-0 z-50 ${
          isSticky
            ? "bg-white dark:bg-dark shadow-md fixed w-full py-5"
            : "bg-lightgray dark:bg-darkgray lg:py-9 py-5 "
        }`}
      >
       
        <div className="container-1218 mx-auto px-4 flex items-center">
          <div className="flex items-center">
            <FullLogo />
          </div>
          
          <div className="xl:flex hidden flex-1 justify-end items-center gap-8">
            <Navigation />
            <div className="flex gap-3 items-center">
              <Button as={Link} to="/auth/auth1/login" className="font-bold px-6 py-2" color={"light"}>
                Iniciar Sesión
              </Button>
              <Button as={Link} to="/auth/auth1/register" className="font-bold px-6 py-2" color={"primary"}>
                Comenzar Gratis
              </Button>
            </div>
          </div>
          
          <div className="xl:hidden block">
            <MobileMenu/>
          </div>
        </div>
      </header>
    </>
  );
};

export default FrontHeader;
