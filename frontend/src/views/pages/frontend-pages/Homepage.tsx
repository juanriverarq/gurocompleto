const HomePage = () => {
  return (
    <div className="min-h-screen bg-white dark:bg-dark">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Bienvenido a Guro
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Sistema de Gestión de Seguros
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-2">
                Gestión de Pólizas
              </h3>
              <p className="text-blue-700 dark:text-blue-300">
                Administra todas tus pólizas de seguros de manera eficiente
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">
                Clientes
              </h3>
              <p className="text-green-700 dark:text-green-300">
                Gestiona tu base de clientes y mejora la relación
              </p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-purple-900 dark:text-purple-100 mb-2">
                Siniestros
              </h3>
              <p className="text-purple-700 dark:text-purple-300">
                Maneja los siniestros de forma rápida y efectiva
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
