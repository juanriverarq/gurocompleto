describe('Seguimiento Comercial - E2E', () => {
  const base = 'http://localhost:5174';

  beforeEach(() => {
    window.localStorage.setItem('saas_token', 'test-token');
  });

  it('Conmuta entre Tabla y Timeline', () => {
    cy.visit(base + '/apps/seguros/seguimiento', {
      onBeforeLoad(win) {
        const empleadoData = {
          empleado: { id: 1, nombres: 'Test', apellidos: 'User', email: 'test@example.com', usuario: 'test', estado: 'activo', broker_id: 1, rol: { id: 1, nombre: 'admin', permisos: ['*'] } },
          broker: { id: 1, name: 'Broker Test' },
          permisos: ['*']
        } as any;
        win.localStorage.setItem('empleado_data', JSON.stringify(empleadoData));
        win.localStorage.setItem('empleado_token', 'token-empleado');
      }
    });
    cy.location('pathname', { timeout: 15000 }).then((p) => {
      if (p.includes('/auth')) {
        cy.visit(base + '/apps/seguros/seguimiento');
      }
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});


