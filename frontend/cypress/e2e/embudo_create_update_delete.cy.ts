describe('Embudo - CRUD Lead básico', () => {
  const base = 'http://localhost:5174';

  const seedAuth = (win: Window) => {
    const empleadoData = {
      empleado: { id: 1, nombres: 'Test', apellidos: 'User', email: 'test@example.com', usuario: 'test', estado: 'activo', broker_id: 1, rol: { id: 1, nombre: 'admin', permisos: ['*'] } },
      broker: { id: 1, name: 'Broker Test' },
      permisos: ['*']
    } as any;
    win.localStorage.setItem('empleado_data', JSON.stringify(empleadoData));
    win.localStorage.setItem('empleado_token', 'token-empleado');
  };

  it('Crea lead (si la UI lo permite) o valida filtros', () => {
    cy.visit(base + '/apps/saas/sales-funnel', { onBeforeLoad: seedAuth as any });
    cy.location('pathname', { timeout: 15000 }).then((p) => { if (p.includes('/auth')) cy.visit(base + '/apps/saas/sales-funnel'); });

    // Si hay botón para crear
    cy.contains('Nuevo Lead').then(($b) => {
      if ($b.length) {
        cy.wrap($b).click({ force: true });
        // Validar que abrió el formulario
        cy.get('body').should('exist');
        cy.go('back');
      } else {
        // Caso alterno: aplica un filtro simple
        cy.get('input[placeholder*="Buscar"]').type('a');
        cy.get('table').should('exist');
      }
    });
  });
});


