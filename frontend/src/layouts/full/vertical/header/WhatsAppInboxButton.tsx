import { Icon } from "@iconify/react";
import { Tooltip } from "flowbite-react";
import { useNavigate } from "react-router-dom";

const WhatsAppInboxButton = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/apps/whatsapp/inbox');
  };

  return (
    <Tooltip content="Inbox WhatsApp" placement="bottom" className="flowbite-tooltip">
      <button
        onClick={handleClick}
        className="h-10 w-10 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 dark:hover:text-green-400 focus:ring-0 rounded-full flex justify-center items-center cursor-pointer text-darklink dark:text-white transition-colors"
      >
        <Icon icon="ic:baseline-whatsapp" width="22" />
      </button>
    </Tooltip>
  );
};

export default WhatsAppInboxButton;
