import { Icon } from "@iconify/react";
import { Dropdown } from "flowbite-react";

const Notifications = () => {
  return (
    <div className="relative group/menu">
      <Dropdown
        label=""
        className="w-screen sm:w-[360px] py-6 rounded-sm z-[30]"
        dismissOnClick={false}
        renderTrigger={() => (
          <div className="relative">
            <span className="h-10 w-10 hover:bg-lightprimary text-darklink dark:text-white rounded-full flex justify-center items-center cursor-pointer group-hover/menu:bg-lightprimary group-hover/menu:text-primary">
              <Icon icon="solar:bell-bing-line-duotone" height={20} />
            </span>
          </div>
        )}
      >
        <div className="flex items-center px-6 justify-between mb-4">
          <h3 className="mb-0 text-lg font-semibold text-ld">Notificaciones</h3>
        </div>

        <div className="px-6 py-8 text-center">
          <Icon
            icon="solar:confetti-bold-duotone"
            height={64}
            className="text-primary mx-auto mb-4"
          />
          <h4 className="text-lg font-semibold text-dark dark:text-white mb-2">
            ¡Bienvenido a Guro!
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            El sistema de notificaciones estará disponible próximamente.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Aquí recibirás alertas sobre pólizas, renovaciones y más.
          </p>
        </div>
      </Dropdown>
    </div>
  );
};

export default Notifications;
