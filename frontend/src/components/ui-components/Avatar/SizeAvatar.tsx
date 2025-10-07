
import CardBox from "src/components/shared/CardBox";
import { Avatar } from "flowbite-react";
import SizeAvatarCode from "./Code/SizeAvatarCode";
import user5 from '/src/assets/images/profile/user-5.jpg';

const SizeAvatar = () => {
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Avatar Sizes</h4>
          <SizeAvatarCode />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Avatar img={user5} size="xs" />
          <Avatar img={user5} size="sm" />
          <Avatar img={user5} size="md" />
          <Avatar img={user5} size="lg" />
        </div>
      </CardBox>
    </div>
  );
};

export default SizeAvatar;
