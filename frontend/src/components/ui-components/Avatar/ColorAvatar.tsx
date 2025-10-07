import { Avatar } from "flowbite-react";

import CardBox from "src/components/shared/CardBox";

import ColorAvatarCode from "./Code/ColorAvatarCode";
import user5 from '/src/assets/images/profile/user-5.jpg';

const ColorAvatar = () => {
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Colors</h4>
          <ColorAvatarCode />
        </div>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Avatar
              img={user5}
              rounded
              bordered
              color="gray"
            />
            <Avatar
              img={user5}
              rounded
              bordered
              color="light"
            />
            <Avatar
              img={user5}
              rounded
              bordered
              color="purple"
            />
            <Avatar
              img={user5}
              rounded
              bordered
              color="success"
            />
            <Avatar
              img={user5}
              rounded
              bordered
              color="pink"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Avatar img={user5} bordered color="gray" />
            <Avatar img={user5} bordered color="light" />
            <Avatar img={user5} bordered color="purple" />
            <Avatar img={user5} bordered color="success" />
            <Avatar img={user5} bordered color="pink" />
          </div>
        </div>
      </CardBox>
    </div>
  );
};

export default ColorAvatar;
