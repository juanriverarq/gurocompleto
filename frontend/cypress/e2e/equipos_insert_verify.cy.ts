describe('Equipos - Inserción por API y verificación', () => {
  const base = 'http://localhost:5174';
  const token = Cypress.env('FIREBASE_TOKEN') as string;

  const seedAuth = (win: Window) => {
    const empleadoData = {
      empleado: {
        id: 1,
        nombres: 'Test',
        apellidos: 'User',
        email: 'test@example.com',
        usuario: 'test',
        estado: 'activo',
        broker_id: 1,
        rol: { id: 1, nombre: 'admin', permisos: ['*'] },
      },
      broker: { id: 1, name: 'Broker Test' },
      permisos: ['*'],
    } as any;
    win.localStorage.setItem('empleado_data', JSON.stringify(empleadoData));
    win.localStorage.setItem('empleado_token', 'token-empleado');
  };

  it('Crea equipo por API, verifica por API y carga UI', () => {
    const name = 'Equipo Cypress ' + Date.now();

    // Crear por API
    cy.window().then(async (win) => {
      const bases = ['http://localhost:8081/api', 'http://localhost:8000/api'];
      for (const api of bases) {
        try {
          const res = await (win as any).fetch(`${api}/saas/sales-teams`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name, description: 'Creado por E2E', status: 'active' }),
          });
          if (res && res.ok) break;
        } catch (_) {}
      }
    });

    // Verificar por API
    cy.window().then(async (win) => {
      const url = `http://localhost:8081/api/saas/sales-teams?per_page=100`;
      const res = await (win as any).fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Listado equipos falló');
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error('Respuesta inválida equipos');
      if (!json.data.find((t: any) => t.name === name)) throw new Error('Equipo no encontrado');
    });

    // Cargar UI (smoke)
    cy.visit(base + '/apps/comercial/equipos-ventas', {
      onBeforeLoad(win) {
        seedAuth(win as any);
        if (token) (win as any).localStorage.setItem('firebase_token', token);
      },
    });
    cy.location('pathname', { timeout: 15000 }).then((p) => {
      if (p.includes('/auth')) cy.visit(base + '/apps/comercial/equipos-ventas');
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});
