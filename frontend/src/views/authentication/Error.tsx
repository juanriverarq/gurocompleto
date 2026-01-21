
import ErrorImg from "/src/assets/images/backgrounds/errorimg.svg";
import { Button } from "flowbite-react";
import { Link } from "react-router";

const Error = () => (
  <>
  <div className="h-screen flex items-center justify-center bg-white dark:bg-darkgray">
    <div className="text-center max-w-lg mx-auto px-4">
      <img src={ErrorImg} alt="error" className="mb-4 mx-auto" />
      <h1 className="text-dark dark:text-white text-4xl mb-4 font-bold">¡Oops!</h1>
      <h6 className="text-xl text-dark dark:text-white mb-2">
        Página no encontrada
      </h6>
      <p className="text-gray-500 dark:text-gray-400 mb-6">
        La página que buscas no existe o fue movida.
      </p>
      <Button
        color={"primary"}
        as={Link}
        to="/"
        className="w-fit mx-auto"
      >
        Volver al inicio
      </Button>
    </div>
  </div>
</>
);

export default Error;
