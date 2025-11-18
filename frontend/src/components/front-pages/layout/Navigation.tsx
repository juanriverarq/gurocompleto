import { Badge } from "flowbite-react";
import { Link, useLocation } from "react-router";

const FrontNav = [
  {
    menu: "Inicio",
    link: "/",
    badge: false,
  },
  {
    menu: "Funcionalidades",
    link: "#funcionalidades",
    badge: false,
  },
  {
    menu: "Precios",
    link: "/precios",
    badge: false,
  },
];

const Navigation = () => {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <>
      <ul className="flex xl:flex-row flex-col xl:gap-6 gap-6 xl:items-center xl:justify-end justify-center">
        {FrontNav.map((item, index) => (
          <li
            key={index}
            className={`rounded-lg font-semibold text-base py-2.5 px-4 transition-all duration-200 hover:bg-lightprimary hover:text-primary ${pathname == item.link ? 'bg-lightprimary text-primary' : 'text-gray-700 dark:text-white hover:text-primary' }`}
          >
            <Link to={item.link} className="flex gap-3 items-center">
              {item.menu}
              {item.badge == true ? <Badge color={'lightprimary'}>Nuevo</Badge> : null}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};

export default Navigation;
