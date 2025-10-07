import customTheme from "src/utils/theme/custom-theme";
import { Flowbite } from "flowbite-react";
import { Outlet } from "react-router";
import ScrollToTop from "src/components/shared/ScrollToTop";

// Componentes básicos temporales
const AnnouncementBar = () => null;
const FrontHeader = () => null;
const Footer = () => null;

const FrontendLayout = () => (
    <>
    <div className="frontend-page bg-white dark:bg-dark">
    <Flowbite theme={{ theme: customTheme }}>
        <AnnouncementBar />
        <FrontHeader />
        <ScrollToTop>
        <Outlet />
        </ScrollToTop>
        <Footer />
        </Flowbite>
        </div>
    </>
);

export default FrontendLayout;
