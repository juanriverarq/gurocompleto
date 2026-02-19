import { Link } from "react-router-dom";
import { useState } from "react";

const Hero = () => {
  const [inputValue, setInputValue] = useState("");

  const handleFormSubmit = (e) => {
    e.preventDefault();
    // Code for handling form submission
  };

  const content = {
    heading: "Protege tu patrimonio con nuestros expertos",
    subheading:
      "Trabajamos con los mejores asesores para brindarte coberturas de calidad.",
    btnText: "Cotizar Ya",
  };

  return (
    <>
      <h1 className="hero-heading fw-light tx-dark">
        <span className="position-relative">{content.heading}</span>
      </h1>
      <p className="text-lg mb-75 pt-60 lg-mb-40 lg-pt-40">
        {content.subheading}
      </p>
      <div
        className="subscribe-form m-auto"
        data-aos="fade-up"
        data-aos-delay="200"
      >
        <form onSubmit={handleFormSubmit} className="position-relative">
          <input
            type="email"
            placeholder="Ingresa tu nombre o correo"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
          <button type="submit" className="tran3s position-absolute fw-500">
            {content.btnText}
          </button>
        </form>
        <p className="m0 pt-10 fw-500 tx-dark fs-15">
          ¿Ya eres cliente Jano?{" "}
          <Link to="/login" className="text-decoration-underline">
            Iniciar sesión.
          </Link>
        </p>
      </div>
    </>
  );
};

export default Hero;
