import { Avatar } from "flowbite-react";

import CardBox from "src/components/shared/CardBox";
import CodeModal from "../CodeModal";
import user2 from '/src/assets/images/profile/user-2.jpg';
import user3 from '/src/assets/images/profile/user-3.jpg';


const BorderAvatar = () => {
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Border Avatar</h4>
          <CodeModal>
            {`
      import { Avatar } from "flowbite-react";
      
      <div className="flex flex-wrap gap-2">
        <Avatar img={user2} rounded bordered />
        <Avatar img={user3} bordered />
      </div>
                `}
          </CodeModal>
        </div>
        <div className="flex flex-wrap gap-2">
          <Avatar img={user2} rounded bordered />
          <Avatar img={user3} bordered />
        </div>
      </CardBox>
    </div>
  );
};

export default BorderAvatar;
