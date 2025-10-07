import React from 'react';
import { Card, Badge, Button, Avatar, Dropdown } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { User } from '../../types/admin';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onToggleStatus: (user: User, status: User['estado']) => void;
  onViewAudit: (user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({
  user,
  onEdit,
  onDelete,
  onToggleStatus,
  onViewAudit
}) => {
  const getStatusColor = (status: User['estado']) => {
    switch (status) {
      case 'ACTIVO': return 'success';
      case 'INACTIVO': return 'gray';
      case 'SUSPENDIDO': return 'failure';
      case 'EN_REVISION': return 'warning';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status: User['estado']) => {
    switch (status) {
      case 'ACTIVO': return 'solar:check-circle-bold';
      case 'INACTIVO': return 'solar:pause-circle-bold';
      case 'SUSPENDIDO': return 'solar:close-circle-bold';
      case 'EN_REVISION': return 'solar:clock-circle-bold';
      default: return 'solar:question-circle-bold';
    }
  };

  const getVinculacionColor = (tipo: User['tipo_vinculacion']) => {
    switch (tipo) {
      case 'PLANTA': return 'info';
      case 'INDEPENDIENTE': return 'purple';
      case 'FREELANCE': return 'pink';
      case 'EXTERNO': return 'yellow';
      default: return 'gray';
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <Avatar
            img={user.foto_perfil}
            alt={user.nombre_completo}
            size="lg"
            status={user.estado === 'ACTIVO' ? 'online' : 'offline'}
            statusPosition="bottom-right"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {user.nombre_completo}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.correo_corporativo}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.tipo_documento}: {user.numero_documento}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge 
                color={getStatusColor(user.estado)} 
                icon={() => <Icon icon={getStatusIcon(user.estado)} className="w-3 h-3" />}
              >
                {user.estado}
              </Badge>
              <Badge color={getVinculacionColor(user.tipo_vinculacion)}>
                {user.tipo_vinculacion}
              </Badge>
            </div>
          </div>
        </div>

        <Dropdown
          label=""
          dismissOnClick={false}
          renderTrigger={() => (
            <Button size="sm" color="gray" className="p-2">
              <Icon icon="solar:menu-dots-bold" className="w-4 h-4" />
            </Button>
          )}
        >
          <Dropdown.Item onClick={() => onEdit(user)}>
            <Icon icon="solar:pen-bold" className="w-4 h-4 mr-2" />
            Editar
          </Dropdown.Item>
          <Dropdown.Item onClick={() => onViewAudit(user)}>
            <Icon icon="solar:history-bold" className="w-4 h-4 mr-2" />
            Auditoría
          </Dropdown.Item>
          <Dropdown.Divider />
          {user.estado === 'ACTIVO' ? (
            <>
              <Dropdown.Item onClick={() => onToggleStatus(user, 'INACTIVO')}>
                <Icon icon="solar:pause-circle-bold" className="w-4 h-4 mr-2" />
                Desactivar
              </Dropdown.Item>
              <Dropdown.Item onClick={() => onToggleStatus(user, 'SUSPENDIDO')}>
                <Icon icon="solar:close-circle-bold" className="w-4 h-4 mr-2" />
                Suspender
              </Dropdown.Item>
            </>
          ) : (
            <Dropdown.Item onClick={() => onToggleStatus(user, 'ACTIVO')}>
              <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-2" />
              Activar
            </Dropdown.Item>
          )}
          <Dropdown.Divider />
          <Dropdown.Item onClick={() => onDelete(user)} className="text-red-600">
            <Icon icon="solar:trash-bin-bold" className="w-4 h-4 mr-2" />
            Eliminar
          </Dropdown.Item>
        </Dropdown>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Teléfono:</span>
          <p className="text-gray-600 dark:text-gray-400">{user.telefono_movil}</p>
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Ciudad:</span>
          <p className="text-gray-600 dark:text-gray-400">{user.ciudad}</p>
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Ingreso:</span>
          <p className="text-gray-600 dark:text-gray-400">
            {new Date(user.fecha_ingreso).toLocaleDateString()}
          </p>
        </div>
        <div>
          <span className="font-medium text-gray-700 dark:text-gray-300">Última conexión:</span>
          <p className="text-gray-600 dark:text-gray-400">
            {user.fecha_ultima_conexion 
              ? new Date(user.fecha_ultima_conexion).toLocaleDateString()
              : 'Nunca'
            }
          </p>
        </div>
      </div>

      {user.aseguradoras_permitidas && user.aseguradoras_permitidas.length > 0 && (
        <div className="mt-4">
          <span className="font-medium text-gray-700 dark:text-gray-300 text-sm">
            Aseguradoras:
          </span>
          <div className="flex flex-wrap gap-1 mt-1">
            {user.aseguradoras_permitidas.map((aseguradora, index) => (
              <Badge key={index} color="light" size="sm">
                {aseguradora}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default UserCard; 