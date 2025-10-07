import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { useUnifiedAuth } from "src/context/UnifiedAuthContext";
import Google from "/src/assets/images/svgs/google-icon.svg";
import FB from "/src/assets/images/svgs/facebook-icon.svg";

interface MyAppProps {
  title: string;
}

const SocialButtons: React.FC<MyAppProps> = ({ title }) => {
  const { loginWithGoogle } = useUnifiedAuth();
  const navigate = useNavigate();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError('');
    
    try {
      const result = await loginWithGoogle();
      
      if (result.success) {
        // El UnifiedAuthContext se encargará automáticamente de verificar el estado SaaS
        // y redirigir según corresponda (al dashboard o al onboarding)
        navigate("/apps");
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Error al conectar con Google');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between gap-8 my-6">
        <button
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="px-4 py-2.5 border border-ld flex gap-2 items-center w-full rounded-md text-center justify-center text-dark dark:text-white text-primary-ld hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-white"></div>
          ) : (
            <img src={Google} alt="google" height={18} width={18} />
          )}
          {googleLoading ? 'Conectando...' : 'Google'}
        </button>
        <Link
          to={"/apps"}
          className="px-4 py-2.5 border border-ld flex gap-2 items-center w-full rounded-md text-center justify-center text-dark dark:text-white text-primary-ld hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <img src={FB} alt="facebook" height={18} width={18} />
          Facebook
        </Link>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
      
      {/* Divider */}
      <div className="flex justify-center items-center my-5">
        <hr className="border-ld" />
        <span className="px-4 text-sm text-gray-500 dark:text-gray-400 bg-white dark:bg-darkgray relative">
          {title}
        </span>
        <hr className="border-ld" />
      </div>
    </>
  );
};

export default SocialButtons;
