
import { Icon } from "@iconify/react";
import Notifications from "./Notifications";
import Profile from "./Profile";

import { Navbar } from "flowbite-react";
import CreateButton from "./CreateButton";

import { useContext } from "react";
import { CustomizerContext } from "../../../../context/CustomizerContext";

const MobileHeaderItems = () => {
  const { activeMode, setActiveMode } = useContext(CustomizerContext);

  const toggleMode = () => {
    const newMode = activeMode === "light" ? "dark" : "light";
    document.documentElement.className = newMode;
    try { localStorage.setItem('guro_active_mode', newMode); } catch {}
    setActiveMode(newMode);
  };
  return (
    <Navbar
      fluid
      className="rounded-none bg-white dark:bg-darkgray flex-1 px-9 "
    >
      {/* Toggle Icon   */}

      <div className="xl:hidden block w-full">
        <div className="flex gap-3 justify-center items-center">
          {/* Light Mode Button */}
          {activeMode === "light" ? (
            <div
              className="h-10 w-10 hover:text-[#573CFF] hover:bg-[#573CFF]/10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer text-gray-500 dark:text-gray-300 transition-colors"
              onClick={toggleMode}
            >
              <span className="flex items-center">
                <Icon icon="solar:moon-line-duotone" width="20" />
              </span>
            </div>
          ) : (
            // Dark Mode Button
            <div
              className="h-10 w-10 hover:text-[#573CFF] hover:bg-[#573CFF]/10 focus:ring-0 rounded-xl flex justify-center items-center cursor-pointer text-gray-500 dark:text-gray-300 transition-colors"
              onClick={toggleMode}
            >
              <span className="flex items-center">
                <Icon icon="solar:sun-bold-duotone" width="20" />
              </span>
            </div>
          )}

          {/* Notification Dropdown */}
          <Notifications />

          {/* Create Button */}
          <CreateButton />

          {/* Profile Dropdown */}
          <Profile />
        </div>
      </div>
    </Navbar>
  );
};

export default MobileHeaderItems;
