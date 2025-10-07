import { Card } from "flowbite-react";

import CardBox from "src/components/shared/CardBox";
import CodeModal from "../CodeModal";
import s3 from '/src/assets/images/blog/blog-img3.jpg';
import s4 from '/src/assets/images/blog/blog-img4.jpg';
const HorizontalCard = () => {
  return (
    <div>
      <CardBox>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-lg font-semibold">Horizontal Card</h4>
          <CodeModal>
            {`
      import { Card } from "flowbite-react";
      import s2 from '/src/assets/images/blog/blog-img2.jpg';

      <Card className="max-w-sm" imgsrc={s2} horizontal>
        <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white pl-4">
          Noteworthy technology acquisitions
        </h5>
        <p className="font-normal text-gray-700 dark:text-gray-400 pl-4">
          Here are the biggest enterprise technology acquisitions of 2024
          so far, in reverse chronological order.
        </p>
      </Card>
                  `}
          </CodeModal>
        </div>
        <div className="grid grid-cols-12 gap-30">
          <div className="lg:col-span-6 col-span-12">
            <Card
              className="max-w-sm"
              imgSrc={s3}
              horizontal
            >
              <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white pl-4">
                Noteworthy technology acquisitions
              </h5>
              <p className="font-normal text-gray-700 dark:text-gray-400 pl-4">
                Here are the biggest enterprise technology acquisitions of 2024
                so far, in reverse chronological order.
              </p>
            </Card>
          </div>
          <div className="lg:col-span-6 col-span-12">
            <Card
              className="max-w-sm"
              imgSrc={s4}
              horizontal
            >
              <h5 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white pl-4">
                Noteworthy technology acquisitions
              </h5>
              <p className="font-normal text-gray-700 dark:text-gray-400 pl-4">
                Here are the biggest enterprise technology acquisitions of 2024
                so far, in reverse chronological order.
              </p>
            </Card>
          </div>
        </div>
      </CardBox>
    </div>
  );
};

export default HorizontalCard;
