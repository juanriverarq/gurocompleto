
import { Drawer } from "flowbite-react";
import { useState } from "react";
import ProductFilter from "./ProductFilter";
import ProductList from "./ProductList";
import CardBox from "src/components/shared/CardBox";
import { EcommerceContextProvider } from "src/context/EcommerceContext";

const EcommerceShop = () => {
  const [isOpenShop, setIsOpenShop] = useState(false);
  const handleClose = () => setIsOpenShop(false);

  return (
    <>
      <EcommerceContextProvider>
        <CardBox className="p-0">
          {/* ------------------------------------------- */}
          {/* Left part */}
          {/* ------------------------------------------- */}
          <div className="flex">
            <Drawer
              open={isOpenShop}
              onClose={handleClose}
              className="lg:relative lg:transform-none lg:h-auto lg:bg-transparent max-w-[250px] w-full lg:z-[0]"
            >
              <ProductFilter />
            </Drawer>
            {/* ------------------------------------------- */}
            {/* Right part */}
            {/* ------------------------------------------- */}
            <div className="p-6 w-full">
              <ProductList openShopFilter={setIsOpenShop} />
            </div>
          </div>
        </CardBox>
      </EcommerceContextProvider>
    </>
  );
};

export default EcommerceShop;
