describe('Embudo - Inserción por API y verificación', () => {
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

  it('Inserta lead por API, verifica por API y carga UI', () => {
    const firstName = 'LeadCypress';
    const lastName = String(Date.now());
    const payload = {
      first_name: firstName,
      last_name: lastName,
      email: `lead.${lastName}@test.local`,
      stage: 'lead',
      lead_source: 'website',
      insurance_type: 'auto',
      potential_value: 100000,
      close_probability: 10,
      preferred_contact_method: 'phone',
      quality_rating: 'warm',
    };

    // Crear por API
    cy.window().then(async (win) => {
      const bases = ['http://localhost:8081/api', 'http://localhost:8000/api'];
      for (const api of bases) {
        try {
          const res = await (win as any).fetch(`${api}/saas/sales-funnel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          if (res && res.ok) break;
        } catch (_) {}
      }
    });

    // Verificar por API
    cy.window().then(async (win) => {
      const url = `http://localhost:8081/api/saas/sales-funnel?search=${encodeURIComponent(
        firstName,
      )}`;
      const res = await (win as any).fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Listado leads falló');
      const json = await res.json();
      if (!Array.isArray(json.data)) throw new Error('Respuesta inválida en leads');
      if (
        !json.data.find((l: any) => l.first_name === firstName && String(l.last_name) === lastName)
      ) {
        throw new Error('Lead insertado no encontrado');
      }
    });

    // Cargar UI (smoke)
    cy.visit(base + '/apps/saas/sales-funnel', {
      onBeforeLoad(win) {
        seedAuth(win as any);
        if (token) (win as any).localStorage.setItem('firebase_token', token);
      },
    });
    cy.location('pathname', { timeout: 15000 }).then((p) => {
      if (p.includes('/auth')) cy.visit(base + '/apps/saas/sales-funnel');
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});
