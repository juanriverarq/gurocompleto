import { Avatar } from "flowbite-react";
import CardBox from "src/components/shared/CardBox";
import StackLayoutCode from "./Code/StackLayoutCode";
import user2 from '/src/assets/images/profile/user-2.jpg';
import user3 from '/src/assets/images/profile/user-3.jpg';
import user4 from '/src/assets/images/profile/user-4.jpg';
import user5 from '/src/assets/images/profile/user-5.jpg';
import user6 from '/src/assets/images/profile/user-6.jpg';

const StackAvatar = () => {
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Stacked layout</h4>
          <StackLayoutCode />
        </div>
        <div className="flex flex-col flex-wrap gap-5">
          <Avatar.Group>
            <Avatar img={user2} rounded stacked />
            <Avatar img={user3} rounded stacked />
            <Avatar img={user4} rounded stacked />
            <Avatar img={user5} rounded stacked />
            <Avatar img={user6} rounded stacked />
          </Avatar.Group>
          <Avatar.Group>
            <Avatar img={user2} rounded stacked />
            <Avatar img={user3} rounded stacked />
            <Avatar img={user4} rounded stacked />
            <Avatar img={user5} rounded stacked />
            <Avatar.Counter total={99} href="#" />
          </Avatar.Group>
        </div>
      </CardBox>
    </div>
  );
};

export default StackAvatar;
