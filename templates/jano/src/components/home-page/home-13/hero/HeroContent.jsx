import { Link } from "react-router-dom";

const HeroContent = () => {
  return (
    <>
      <h1 className="hero-heading fw-normal text-white font-recoleta">
        Encuentra tu sejano{" "}
        <span className="position-relative">
          ideal <img src="/images/shape/shape_114.svg" alt="img" />
        </span>
        en un solo clic.
      </h1>
      <p className="sub-text mt-20 mb-45 lg-mb-30">
        Convierte tu tranquilidad en prioridad hoy
        <span className="text-white"> 3x mejor</span> revenue than other
        market.
      </p>
      <div className="d-lg-flex align-items-center">
        <Link
          to="/contact/contact-v1"
          className="demo-btn fw-500 tran3s d-inline-flex align-items-center mb-25 me-4"
        >
          <span>Solicita tu cotización</span>
          <img src="/images/icon/icon_91.svg" alt="img" className="ms-3" />
        </Link>
        <div className="mb-25 text-white signIn-btn">
          ¿Ya eres cliente Jano? <Link to="/login">Sign in</Link>
        </div>
      </div>
      <h2 className="fw-normal text-white mt-60 mb-5 lg-mt-40">A+ Calificación</h2>
      <p className="fs-18 opacity-50 text-white">
        Calificación promedio de 4.8, líderes en sejanos.
      </p>
    </>
  );
};

export default HeroContent;
