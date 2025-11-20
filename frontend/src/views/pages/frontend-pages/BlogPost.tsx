import FrontBlogPost from "src/components/front-pages/blog/BlogPost";
import PurchaseTemp from "src/components/front-pages/homepage/PurchaseTemp";
import { BlogProvider } from "src/context/BlogContext";
import FrontEndBreadcrumb from "src/layouts/full/shared/breadcrumb/FrontBreadcrumb";


const BlogPost = () => {
  return (
    <>
      <FrontEndBreadcrumb title="Our most recent articles" link="Blog Details" />
      <div className="bg-lightgray dark:bg-darkgray">
        <div className="container-1218 mx-auto pb-12">
          <BlogProvider>
            <FrontBlogPost />
          </BlogProvider>
        </div>
      </div>
      <PurchaseTemp />
    </>
  );
};

export default BlogPost;
