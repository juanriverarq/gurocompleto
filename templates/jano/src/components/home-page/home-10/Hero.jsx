import HeroSubscribe from "./HeroSubscribe";
import Illustration from "./Illustration";

const Hero = () => {
  return (
    <div className="container">
      <div className="row">
        <div className="col-lg-6 col-md-7">
          <h1 className="hero-heading fw-bold tx-dark">
            We’r Help <br /> a Proteger tu
            <span className="position-relative d-inline-block">Futuro.</span>
          </h1>
          <p className="text-lg mb-60 pt-50 pe-xl-5 lg-pt-30 lg-mb-40">
            Trabajamos con los mejores asesores para brindarte coberturas de calidad.
          </p>

          <HeroSubscribe />

          <div className="pr-info fw-500 fs-20 tx-dark mt-35">
            Over
            <span className="fw-bold text-decoration-underline">
              150,000+ clienteseses
            </span>
            en todo el país.
          </div>
        </div>
      </div>
      {/* End .row */}

      <div className="card-one shapes bg-white">
        <div className="icon rounded-circle position-absolute fs-18 text-white">
          <i className="bi bi-check-lg" />
        </div>
        <h6 className="fw-500 tx-dark mb-15">Ahorra hasta 50% en plan anual.</h6>
        <a href="#" className="more-btn tran3s text-uppercase fw-500 fs-13">
          Ver más
        </a>
      </div>
      {/* End card-one */}

      <Illustration />
      {/* /.illustration-holder */}
    </div>
  );
};

export default Hero;
