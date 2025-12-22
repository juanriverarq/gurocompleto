import customTheme from "src/utils/theme/custom-theme";
import { Flowbite } from "flowbite-react";
import { Outlet } from "react-router";
import ScrollToTop from "src/components/shared/ScrollToTop";
import Header from "src/components/landingpage/header/Header";
import Footer from "src/components/landingpage/footer/Footer";
import AnnouncementBar from "src/components/front-pages/layout/AnnouncementBar";

const FrontendLayout = () => (
    <>
    <div className="frontend-page bg-white dark:bg-dark">
    <Flowbite theme={{ theme: customTheme }}>
        <AnnouncementBar />
        <Header />
        <ScrollToTop>
        <Outlet />
        </ScrollToTop>
        <Footer />
        </Flowbite>
        </div>
    </>
);

export default FrontendLayout;
