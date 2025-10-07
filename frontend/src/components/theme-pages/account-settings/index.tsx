
import { Tabs } from "flowbite-react";
import {
  IconArticle,
  IconBell,
  IconLock,
  IconUserCircle,
} from "@tabler/icons-react";
import CardBox from "src/components/shared/CardBox";
import AccountTab from "./AccountTab";
import BillsTabs from "./BillsTab";
import NotificationTab from "./NotificationTab";
import SecurityTab from "./SecurityTab";


const AccountSettingIndex = () => {
  return (
    <>
      <CardBox className="px-0 py-0 ">
        <Tabs aria-label="Tabs with underline"  variant="underline">
          <Tabs.Item
            active
            title="Account"
            icon={() => <IconUserCircle size={20} />}
          >
            <div className="p-6">
              <AccountTab />
            </div>
          </Tabs.Item>
          <Tabs.Item title="Notification" icon={() => <IconBell size={20} />}>
            <div className="p-6">
              <NotificationTab />
            </div>
          </Tabs.Item>
          <Tabs.Item title="Bills" icon={() => <IconArticle size={20} />}>
            <div className="p-6">
              <BillsTabs />
            </div>
          </Tabs.Item>
          <Tabs.Item title="Security" icon={() => <IconLock size={20} />}>
            <div className="p-6">
              <SecurityTab />
            </div>
          </Tabs.Item>
        </Tabs>
      </CardBox>
    </>
  );
};

export default AccountSettingIndex;
