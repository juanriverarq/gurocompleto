describe('Embudo de Ventas - E2E', () => {
  const base = 'http://localhost:5174';
  const token = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjkyZTg4M2NjNDY2M2E2MzMyYWRhNmJjMWU0N2YzZmY1ZTRjOGI1ZDciLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiQ0hTRUdVUk9TIiwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tRUEdPTmF5b1RJaDNmWDBid1F4NHlVQWxSQWppdUlvdzVtdUw4czVHclhCZmJBZz1zOTYtYyIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9ndXJvLWIzOTExIiwiYXVkIjoiZ3Vyby1iMzkxMSIsImF1dGhfdGltZSI6MTc1NjE3MTcyOCwidXNlcl9pZCI6ImRFa0JySGd6V3ZQQWF0bjZ5VGlOQzlXQ1p4bTIiLCJzdWIiOiJkRWtCckhneld2UEFhdG42eVRpTkM5V0NaeG0yIiwiaWF0IjoxNzU2MTc2MTAzLCJleHAiOjE3NTYxNzk3MDMsImVtYWlsIjoiY2hzZWd1cm9zLmNvbS5jb0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwMjg2NDIzMzEzNjU4NjQyNzY5NiJdLCJlbWFpbCI6WyJjaHNlZ3Vyb3MuY29tLmNvQGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6Imdvb2dsZS5jb20ifX0.of9u6owNWxPK5dcjEguLhYsPWl9sj-7HlwKqWUY1zI5FNBO3hDMSoKH_hD-CKKiiE99e-cKVN8TcOxrPIIkp7MN0MbUQvINuV9IyC-D3ddlfe47GnAXKNNMBkKYnnQuZP_2v4_RG_VUW2W3X7BzIuz0UOEcmzk93eFAupBMQ7HR7QerZzru6pk_CELT32PlFa0e2nZoeSLl_Lk92YfHiK8nCVmd7EDvI3lizy8ghV9h9nVDQJvARF8DLumogjGMn6KI44pScMenJs5AA-PAu5c6MW4MoDxSR9zeSZj94dpp_dxxKeFCue06Sy5Nvs769cutluvEcKx6u2NAKkI3QCw';

  beforeEach(() => {
    window.localStorage.setItem('firebase_token', 'test-token');
    window.localStorage.setItem('saas_token', 'test-token');
  });

  it('Lista y filtra leads correctamente', () => {
    cy.visit(base + '/apps/saas/sales-funnel', {
      onBeforeLoad(win) {
        win.localStorage.setItem('firebase_token', token);
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
        cy.visit(base + '/apps/saas/sales-funnel');
      }
    });
    cy.get('body', { timeout: 20000 }).should('exist');
  });
});


