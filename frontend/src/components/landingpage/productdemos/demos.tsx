import user1 from "/src/assets/images/profile/user-2.jpg";
import user2 from "/src/assets/images/profile/user-3.jpg";
import user3 from "/src/assets/images/profile/user-4.jpg";

const ProductDemos = () => {
  const userImg = [
    {
      user: user1,
    },
    {
      user: user2,
    },
    {
      user: user3,
    },
  ];
  return (
    <>
      <div className="md:py-20 py-12 relative bg-white dark:bg-dark" id="demos">
        <div className="container">
          {/* Sección eliminada para evitar redundancia */}
        </div>
      </div>
    </>
  );
};

export default ProductDemos;
