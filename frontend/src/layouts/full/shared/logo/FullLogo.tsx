

import { Link } from "react-router";
import Logo from "/src/assets/images/logos/Logo.svg";

const FullLogo = () => {
  return (
    <Link to={"/"} className="flex items-center">
      <img src={Logo} alt="Guro Logo" className="h-12 w-auto" />
    </Link>
  );
};

export default FullLogo;
