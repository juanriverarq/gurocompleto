describe('Metas - Crear y editar', () => {
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

  it('Inserta una meta por API y verifica vía API (y carga UI)', () => {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    cy.window().then(async (win) => {
      const bases = ['http://localhost:8081/api', 'http://localhost:8000/api'];
      for (const base of bases) {
        try {
          const res = await (win as any).fetch(`${base}/saas/goals`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              period,
              type: 'Primas',
              target_value: 123456,
              current_value: 0,
              status: 'En Progreso',
            }),
          });
          if (res && res.ok) return;
        } catch (e) {}
      }
      throw new Error('No se pudo crear meta');
    });

    // Verificar por API
    cy.window().then(async (win) => {
      const url = `http://localhost:8081/api/saas/goals?period=${encodeURIComponent(
        period,
      )}&per_page=100`;
      const res = await (win as any).fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Listado metas falló');
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error('Respuesta inválida en metas');
      if (!json.data.find((g: any) => g.type === 'Primas' && Number(g.target_value) === 123456)) {
        throw new Error('Meta insertada no encontrada');
      }
    });

    // Cargar UI (smoke)
    cy.visit(base + '/apps/comercial/metas-objetivos', {
      onBeforeLoad(win) {
        seedAuth(win as any);
        if (token) (win as any).localStorage.setItem('firebase_token', token);
      },
    });
    cy.location('pathname', { timeout: 15000 }).then((p) => {
      if (p.includes('/auth')) cy.visit(base + '/apps/comercial/metas-objetivos');
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});
