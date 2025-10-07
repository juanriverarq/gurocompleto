import leader1 from "/src/assets/images/front-pages/team/leader1.png";
import leader2 from "/src/assets/images/front-pages/team/leader2.png";
import leader3 from "/src/assets/images/front-pages/team/leader3.png";
import leader4 from "/src/assets/images/front-pages/team/leader4.png";

const OurTeam = () => {
  const team = [
    {
      img: leader1,
      name: "Dr. Carlos Mendoza",
      position: "CEO & Co-Fundador",
    },
    {
      img: leader2,
      name: "Ing. Ana Rodríguez",
      position: "CTO & Directora de IA",
    },
    {
      img: leader3,
      name: "Lic. Roberto Silva",
      position: "Director de Producto",
    },
    {
      img: leader4,
      name: "Mtra. Elena Vega",
      position: "Directora de Seguros",
    },
  ];
  return (
    <>
      <div className="bg-sky lg:py-24 py-12">
        <div className="container-1218 mx-auto">
          <div className="grid grid-cols-12 gap-30 flex justify-between pb-12">
            <div className="lg:col-span-7 col-span-12">
              <h2 className="sm:text-44 text-3xl font-bold !leading-[48px] text-white">
                Conoce al equipo detrás de Guro
              </h2>
            </div>
            <div className="lg:col-span-5 col-span-12">
              <p className="text-17 leading-[32px] lg:ps-5 text-white opacity-90">
                Expertos en seguros e inteligencia artificial trabajando juntos para revolucionar tu negocio.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-12 gap-30">
            {team.map((item, index) => (
              <div
                className="lg:col-span-3 md:col-span-6 col-span-12"
                key={index}
              >
                <div className="relative group">
                  <img src={item.img} alt="team-member" className="rounded-lg" />
                  <div className="bg-white dark:bg-dark text-center rounded-md py-4 px-3 absolute bottom-3 start-3 end-3 lg:opacity-0 opacity-100 group-hover:opacity-100 transition-[0.5s] shadow-lg">
                    <h5 className="text-lg font-semibold text-darklink dark:text-white">{item.name}</h5>
                    <span className="text-sm text-ld opacity-80">{item.position}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default OurTeam;
