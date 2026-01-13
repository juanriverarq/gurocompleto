
import LogoIcon from '/src/assets/images/logos/Logo.svg'
import { Link } from "react-router";

const Logo = () => {
  return (
   <Link to={'/'} className="flex items-center">
      <img src={LogoIcon} alt="Guro Logo" className="h-10 w-auto" width={120} height={40} />
    </Link>
  )
}

export default Logo
