const NewsLetter = () => {
  const handleSubmit = (event) => {
    event.preventDefault(); // prevent default form submission behavior
    // handle form submission logic
  };

  return (
    <form onClick={handleSubmit} className="position-relative">
      <input type="email" placeholder="Ingresa tu correo" required />
      <button className="tran3s fw-500 position-absolute">Registrarse</button>
    </form>
  );
};

export default NewsLetter;
