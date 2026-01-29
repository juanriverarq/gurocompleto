import { FC, useContext, lazy, Suspense } from 'react';
import { Outlet } from 'react-router';
import { Customizer } from './shared/customizer/Customizer';
import { CustomizerContext } from '../../context/CustomizerContext';
import Sidebar from './vertical/sidebar/Sidebar';
import Header from './vertical/header/Header';
import PartialTransitioning from 'src/components/headless-ui/Transition/PartialTransitioning';
import ScrollToTop from 'src/components/shared/ScrollToTop';

const WhatsAppToast = lazy(() => import('src/components/whatsapp/WhatsAppToast'));


const FullLayout: FC = () => {
  const { activeLayout, isLayout } = useContext(CustomizerContext);

  return (
      <>
      
    <div className="flex w-full min-h-screen dark:bg-darkgray">
      <div className="page-wrapper flex w-full min-w-0">
        {/* Header/sidebar */}

        {activeLayout == "vertical" ? <Sidebar /> : null}
        <div className="page-wrapper-sub flex flex-col w-full min-w-0 dark:bg-darkgray">
          {/* Top Header  */}
          {activeLayout == "horizontal" ? (
            <Header layoutType="horizontal" />
          ) : (
            <Header layoutType="vertical" />
          )}
          

          <div
            className={`bg-lightgray dark:bg-dark  h-full ${
              activeLayout != "horizontal" ? "rounded-bb" : "rounded-none"
            } `}
          >
            {/* Body Content  */}
            <div
              className={` ${
                isLayout == "full"
                  ? "w-full py-8 md:py-10 px-4 md:px-6 xl:px-8 2xl:px-10 min-w-0 overflow-x-auto"
                  : "container mx-auto py-8 md:py-10"
              } ${activeLayout == "horizontal" ? "xl:mt-3" : ""}
              `}
            >
              <ScrollToTop>
              <Outlet/>
              </ScrollToTop>
            </div>
            <Customizer />
            <PartialTransitioning/>
          </div>
        </div>
      </div>
      {/* Toast de notificaciones de WhatsApp */}
      <Suspense fallback={null}>
        <WhatsAppToast />
      </Suspense>
    </div>
      </>
  );
};

export default FullLayout;
