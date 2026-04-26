import Notifications from "./Notifications";
import Profile from "./Profile";

import { Navbar } from "flowbite-react";
import CreateButton from "./CreateButton";

const MobileHeaderItems = () => {
  return (
    <Navbar
      fluid
      className="rounded-none bg-white dark:bg-darkgray flex-1 px-9 "
    >
      {/* Toggle Icon   */}

      <div className="xl:hidden block w-full">
        <div className="flex gap-3 justify-center items-center">
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
