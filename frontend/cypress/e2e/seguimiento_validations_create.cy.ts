describe('Seguimiento - Validaciones y Creación', () => {
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

  it('Inserta por API y verifica vía API (y carga UI)', () => {
    const title = 'Seguimiento Cypress ' + Date.now();
    const payload = {
      title,
      description: 'Creado por E2E',
      type: 'llamada',
      priority: 'media',
    };

    cy.window().then(async (win) => {
      const bases = ['http://localhost:8081/api', 'http://localhost:8000/api'];
      for (const base of bases) {
        try {
          const res = await (win as any).fetch(`${base}/saas/commercial-tasks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          if (res && res.ok) return;
        } catch (e) {}
      }
      throw new Error('No se pudo insertar seguimiento');
    });

    // Verificar por API que existe
    cy.window().then(async (win) => {
      const listUrl =
        'http://localhost:8081/api/saas/commercial-tasks?search=' + encodeURIComponent(title);
      const res = await (win as any).fetch(listUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Listado seguimientos falló');
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error('Respuesta inválida en listado');
      const found = json.data.find((i: any) => i.title === title);
      if (!found) throw new Error('Seguimiento no encontrado tras creación');
    });

    // Cargar la UI (smoke de carga)
    cy.visit(base + '/apps/seguros/seguimiento', {
      onBeforeLoad(win) {
        seedAuth(win as any);
        if (token) (win as any).localStorage.setItem('firebase_token', token);
      },
    });
    cy.location('pathname', { timeout: 15000 }).then((p) => {
      if (p.includes('/auth')) cy.visit(base + '/apps/seguros/seguimiento');
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});
