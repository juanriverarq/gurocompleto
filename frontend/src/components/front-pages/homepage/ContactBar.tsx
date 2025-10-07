import { Link } from "react-router";
import user1 from "/src/assets/images/profile/user-1.jpg";
import user2 from "/src/assets/images/profile/user-13.jpg";

const ContactBar = () => {
  return (
    <>
      <div className="bg-primary md:flex justify-center items-center py-4 px-5">
        <div className="sm:flex gap-4 items-center">
          <div className="flex sm:justify-start items-center justify-center ps-3">
            <div className="-ms-3 h-10 w-10 relative z-5 opacity-50">
              <img
                src={user1}
                className="rounded-full"
                alt="icon"
              />
            </div>
            <div className="-ms-3 h-11 w-11 relative z-5">
              <img
                src={user2}
                className="rounded-full"
                alt="icon"
              />
            </div>
          </div>
          <p className="text-base text-white sm:text-left text-center md:py-0 py-2">
            ¿Listo para transformar tu negocio de seguros con IA? Comienza tu prueba gratuita.
          </p>
          <Link
            to={"/auth/auth1/register"}
            className="text-base font-semibold text-white underline sm:text-left text-center block hover:text-sky-100 transition-colors"
          >
            Comenzar Ahora
          </Link>
        </div>
      </div>
    </>
  );
};

export default ContactBar;
