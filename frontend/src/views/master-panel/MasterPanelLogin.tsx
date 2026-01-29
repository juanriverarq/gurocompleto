import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Label, TextInput, Button, Alert } from 'flowbite-react';
import { HiMail, HiLockClosed, HiExclamationCircle } from 'react-icons/hi';
import masterPanelService from '../../services/masterPanelService';

const MasterPanelLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await masterPanelService.login(email, password);
      
      if (response.success && response.data) {
        masterPanelService.setAuth(response.data.token, response.data.user);
        navigate('/master-panel/dashboard');
      } else {
        setError(response.message || 'Error al iniciar sesión');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🛡️ Panel Master</h1>
          <p className="text-purple-200">Acceso exclusivo para administradores</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-lg border-purple-500/30">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert color="failure" icon={HiExclamationCircle}>
                {error}
              </Alert>
            )}

            <div>
              <Label htmlFor="email" className="text-white mb-2 block">
                Correo electrónico
              </Label>
              <TextInput
                id="email"
                type="email"
                icon={HiMail}
                placeholder="admin@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white/20"
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-white mb-2 block">
                Contraseña
              </Label>
              <TextInput
                id="password"
                type="password"
                icon={HiLockClosed}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-white/20"
              />
            </div>

            <Button
              type="submit"
              gradientDuoTone="purpleToPink"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Ingresando...' : 'Ingresar al Panel'}
            </Button>
          </form>
        </Card>

        <p className="text-center text-purple-300 mt-6 text-sm">
          © {new Date().getFullYear()} Guro - Panel de Administración
        </p>
      </div>
    </div>
  );
};

export default MasterPanelLogin;
