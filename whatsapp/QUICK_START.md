# 🚀 Inicio Rápido - Deploy WhatsApp a Producción

## Opción 1: Deploy Automático (Recomendado)

### Paso 1: Configurar Variables
```bash
export REMOTE_HOST="178.18.246.209"
export REMOTE_USER="guro"
export SSH_KEY="$HOME/.ssh/guro_deploy"
```

### Paso 2: Ejecutar Deploy
```bash
cd whatsapp
./deploy-quick.sh
```

¡Listo! El servicio estará disponible en `https://whatsapp.guro.co`

---

## Opción 2: Deploy con Script Completo

```bash
# Configurar variables
export CONNECT_USER=root
export REMOTE_SUDO_USER=guro
export SSH_IDENTITY_FILE=$HOME/.ssh/guro_deploy
export WHATSAPP_SUBDOMAIN=whatsapp.guro.co
export WHATSAPP_PORT=3300

# Ejecutar
chmod +x deploy/whatsapp_scp.sh
./deploy/whatsapp_scp.sh
```

---

## Opción 3: Deploy Manual

### 1. Empaquetar
```bash
cd whatsapp
tar -czf ../whatsapp.tar.gz \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='auth_info' \
  .
```

### 2. Subir al Servidor
```bash
scp -i ~/.ssh/guro_deploy whatsapp.tar.gz guro@178.18.246.209:/tmp/
```

### 3. En el Servidor
```bash
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209

# Extraer
cd /home/guro/whatsapp/current
tar -xzf /tmp/whatsapp.tar.gz

# Instalar dependencias
npm ci --production

# Reiniciar servicio
sudo systemctl restart gurowhatsapp.service

# Verificar
sudo systemctl status gurowhatsapp.service
curl https://whatsapp.guro.co/health
```

---

## 📊 Verificar Deploy

```bash
# Health check
curl https://whatsapp.guro.co/health

# Estado del servicio
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo systemctl status gurowhatsapp.service'

# Ver logs
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo journalctl -u gurowhatsapp.service -n 50'
```

---

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo journalctl -u gurowhatsapp.service -f'

# Reiniciar servicio
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo systemctl restart gurowhatsapp.service'

# Detener servicio
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo systemctl stop gurowhatsapp.service'

# Iniciar servicio
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo systemctl start gurowhatsapp.service'
```

---

## 🆘 Problemas Comunes

### El servicio no inicia
```bash
# Ver logs detallados
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo journalctl -u gurowhatsapp.service -n 100'
```

### Puerto en uso
```bash
# Ver qué está usando el puerto
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo lsof -i :3300'
```

### Permisos incorrectos
```bash
# Corregir permisos
ssh -i ~/.ssh/guro_deploy guro@178.18.246.209 'sudo chown -R guro:guro /home/guro/whatsapp'
```

---

## 📚 Documentación Completa

Para más detalles, consulta [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md)