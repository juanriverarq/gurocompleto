const axios = require('axios');

// Replicar EXACTAMENTE el flujo de AGM para cotizar con SURA
// 1. Auth Cognito (public)
// 2. Orquestador Step Functions con SURA

const TENANT = 'ch.co.agentemotor.com';

async function main() {
  // STEP 1: Cognito auth
  console.log('=== STEP 1: Auth Cognito ===');
  const authResp = await axios.post(
    'https://e0rx3hrb03.execute-api.us-east-2.amazonaws.com/default/authenticate',
    { tenant: TENANT, username: 'public', password: 'public' },
    { headers: { 'Content-Type': 'application/json', 'Origin': `https://${TENANT}` } }
  );
  const idToken = authResp.data.id_token;
  console.log(`Token: ${idToken.slice(0, 60)}...`);

  // STEP 2: Orquestador cotización
  console.log('\n=== STEP 2: Orquestador SURA ===');
  // El Step Functions espera $.data.risk_in.business_line
  // La estructura real tiene un wrapper 'data' con risk_in, broker, etc.
  const quoteInput = {
    name: 'event-request-policy',
    tenant_data: { name: TENANT },
    data: {
      id: {
        broker_sales_team: 1,
        broker_id: 1,
        offer_id: '',
        company_id: 1,
        connection_id: 100,
      },
      broker: {
        broker_insurers_data: [{
          broker_code: '8670',
          id_office_related: '4037',
          con_mode: 'pro',
          insurer_name: 'SURA',
          insurer_interface: 'sura_ws',
        }],
      },
      risk_in: {
        business_line: 'vehicle',
        ubication: {
          city: 'BOGOTA',
          city_code: '11001',
          department: 'CUNDINAMARCA',
          department_code: '11',
        },
        parties: [{
          party_role: 'taker',
          identification_type: 'CC',
          identification: '1234567890',
          names: 'PRUEBA',
          last_names: 'TEST',
          city: 'BOGOTA',
          city_code: '11001',
          birthdate: '1990-01-01',
          gender: 'M',
          email: 'test@test.com',
          phone: '3001234567',
        }],
        insurable_objects: [{
          type: 'all_risk_vehicle',
          vehicle: {
            plate: '',
            brand: 'CHEVROLET',
            line: 'SPARK GT',
            model: 2024,
            code: '04411',
            type: 'AUTOMOVIL',
            cylinder: '1200',
            service: 'PARTICULAR',
            city: 'BOGOTA',
            city_code: '11001',
          },
          insurance_use: 'PARTICULAR',
        }],
        client: {
          identification_type: 'CC',
          identification: '1234567890',
          names: 'PRUEBA',
          last_names: 'TEST',
          city: 'BOGOTA',
          birthdate: '1990-01-01',
          gender: 'M',
        },
        accessories: [],
        additional_data: {},
      },
    },
  };

  const orqPayload = {
    input: JSON.stringify(quoteInput),
    name: `guro-test-${Date.now()}`,
    stateMachineArn: 'arn:aws:states:us-east-2:907888255793:stateMachine:EventRequestPolicy',
  };

  try {
    const orqResp = await axios.post(
      'https://47kw7otdmc.execute-api.us-east-2.amazonaws.com/prod/orquestator/syncstart',
      orqPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': idToken,
          'Origin': `https://${TENANT}`,
        },
        timeout: 120000,
      }
    );
    console.log('Status:', orqResp.status);
    console.log('Response:', JSON.stringify(orqResp.data, null, 2).slice(0, 5000));
  } catch (e) {
    console.log('Error:', e.response?.status, e.response?.statusText);
    console.log('Data:', JSON.stringify(e.response?.data, null, 2)?.slice(0, 2000));
  }

  // STEP 3: También probar la Lambda directa de SURA
  console.log('\n=== STEP 3: Lambda test-connection SURA ===');
  try {
    const testResp = await axios.post(
      'https://ttweah75sqwywikts6svfg4vwa0dyrsy.lambda-url.us-east-2.on.aws/',
      {
        name: 'event-test-connection',
        tenant_data: { name: TENANT },
        broker: {
          broker_insurers_data: [{
            broker_identification_type: 'NIT',
            broker_insurer_user: '9007093091',
            broker_insurer_pwd: '9007',
            con_mode: 'pro',
            insurer_name: 'SURA',
            insurer_interface: 'sura_plus',
          }],
        },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
    );
    console.log('Test connection:', JSON.stringify(testResp.data));
  } catch (e) {
    console.log('Test error:', e.message);
  }

  // STEP 4: Probar Lambda directa con evento de cotización
  console.log('\n=== STEP 4: Lambda directa con evento de cotización SURA ===');
  const quoteEvent = {
    name: 'event-request-policy',
    tenant_data: { name: TENANT },
    broker: {
      broker_insurers_data: [{
        broker_identification_type: 'NIT',
        broker_insurer_user: '9007093091',
        broker_insurer_pwd: '9007',
        con_mode: 'pro',
        insurer_name: 'SURA',
        insurer_interface: 'sura_plus',
      }],
    },
    risk_in: quoteInput.risk_in,
  };

  try {
    const quoteResp = await axios.post(
      'https://ttweah75sqwywikts6svfg4vwa0dyrsy.lambda-url.us-east-2.on.aws/',
      quoteEvent,
      { headers: { 'Content-Type': 'application/json' }, timeout: 120000 }
    );
    console.log('Quote response:', JSON.stringify(quoteResp.data, null, 2).slice(0, 5000));
  } catch (e) {
    console.log('Quote error:', e.response?.status);
    console.log('Quote data:', JSON.stringify(e.response?.data, null, 2)?.slice(0, 2000));
  }
}

main().catch(e => console.error('Fatal:', e.message));
