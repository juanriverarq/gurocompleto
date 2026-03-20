const axios = require('axios');

// Payload EXACTO basado en la función Ah() de agm_bundle.js
// Evento correcto: "event-create-quote" (NO event-request-policy)
// Integrity key: "rqMLJ%xSV2O19l7z"

const TENANT = 'ch.co.agentemotor.com';

(async () => {
  // 1. Auth
  console.log('=== AUTH ===');
  const auth = await axios.post(
    'https://e0rx3hrb03.execute-api.us-east-2.amazonaws.com/default/authenticate',
    { tenant: TENANT, username: 'public', password: 'public' },
    { headers: { 'Content-Type': 'application/json', 'Origin': `https://${TENANT}` } }
  );
  const token = auth.data.id_token;
  console.log('Token OK');

  // 2. Build payload exactly like Ah() in agm_bundle.js
  const payload = {
    mode: 'pro',
    version: '1',
    analytics: true,
    tenant_data: {
      name: TENANT,
      integrity: 'rqMLJ%xSV2O19l7z',
      user: 2,
      event: 'event-create-quote',
      origin: 'formWeb',
    },
    broker: {
      organizartion: {  // Note: typo is in AGM's original code
        name: 'CH SEGUROS',
        identification_type: 'NIT',
        identification_number: '9007093091',
      },
      company: {
        name: 'CH SEGUROS',
        identification_type: 'NIT',
        identification_number: '9007093091',
      },
    },
    data: {
      business_line: 'vehiculos',
      insurable_objects: [{
        identification: 'INM807-CHEVROLET-SPARK',
        price_sugested: 35000000,
        tag: 'INM807',
        type: 'vehicle',
        vehicle: {
          brand: 'CHEVROLET',
          codification: {
            code: '04411',
            fuel: '*',
            nationality: '',
          },
          cylinder: '1200',
          line: 'SPARK GT',
          model: 2024,
          number_passengers: 5,
          plate: 'INM807',
          type: 'AUTOMOVIL',
          vehicle_risk: {
            accesories_price: 0,
            in_agency: false,
            plate_type: 'particular',
            protection_type: 'alarma',
            reference_price: 35000000,
            commercial_price: 35000000,
            use_type: 'particular',
            use_time: 1,
          },
          weight: 0,
        },
      }],
      parties: [{
        party_rol: 'Asegurado',
        party_type: 'person',
        person: {
          occupation: 'Profesional Independiente',
          profession: 'No definida',
          birht_date: '1990-01-15',  // Note: typo is in AGM's original code
          age: 35,
          logs_terms_and_policy: [{
            date: new Date().toISOString(),
            event: 'terms',
            ip: '0.0.0.0',
            link: '',
            origin: 'formWeb',
            name: 'PRUEBA TEST',
            identification_number: '1234567890',
            identification_type: 'CC',
            email: 'test@test.com',
            phone: '3001234567',
          }, {
            date: new Date().toISOString(),
            event: 'politics',
            ip: '0.0.0.0',
            link: '',
            origin: 'formWeb',
            name: 'PRUEBA TEST',
            identification_number: '1234567890',
            identification_type: 'CC',
            email: 'test@test.com',
            phone: '3001234567',
          }],
          contact_data: [{
            contact_info: {
              email: 'test@test.com',
              phone: '3001234567',
              ubication: {
                address_line1: '',
                place: {
                  city_code: '001',
                  city_name: 'BOGOTA',
                  country_code: 'CO',
                  country_name: 'COLOMBIA',
                  state_code: '11',
                  state_name: 'BOGOTA D.C.',
                },
                postal_code: '11001',
              },
            },
            contact_tag: 'Email',
          }],
          educational_level: 'primary',
          firstname: 'PRUEBA',
          gender: 'M',
          identification_number: '1234567890',
          identification_type: 'CC',
          lastname: 'TEST',
          marital_status: 'single',
          id_expedition_date: '2010-01-01',
          insured_address: '',
        },
      }],
      type: 'all_risk_vehicle',
      ubication: {
        address_line1: '',
        place: {
          city_code: '001',
          city_name: 'BOGOTA',
          country_code: 'CO',
          country_name: 'COLOMBIA',
          state_code: '11',
          state_name: 'BOGOTA D.C.',
        },
        postal_code: '11001',
      },
    },
    name: 'event-create-quote',
    origin: 'formWeb',
  };

  // 3. Call orchestrator
  console.log('\n=== ORQUESTADOR ===');
  const orqPayload = {
    input: JSON.stringify(payload),
    name: `ch_vehiculos_INM807-CHEVROLET-SPARK`,
    stateMachineArn: 'arn:aws:states:us-east-2:907888255793:stateMachine:EventRequestPolicy',
  };

  try {
    const r = await axios.post(
      'https://47kw7otdmc.execute-api.us-east-2.amazonaws.com/prod/orquestator/syncstart',
      orqPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
          Origin: `https://${TENANT}`,
        },
        timeout: 300000, // 5 min - scraping can take time
      }
    );
    console.log('Status:', r.data.status);
    if (r.data.output) {
      const output = JSON.parse(r.data.output);
      console.log('OUTPUT:', JSON.stringify(output, null, 2).slice(0, 5000));
    }
    if (r.data.cause) {
      try {
        const cause = JSON.parse(r.data.cause);
        console.log('ERROR:', cause.errorMessage);
        console.log('TRACE:', (cause.stackTrace || []).join('\n'));
      } catch (e) {
        console.log('CAUSE:', r.data.cause.slice(0, 2000));
      }
    }
    if (r.data.status !== 'SUCCEEDED' && r.data.status !== 'FAILED') {
      console.log('FULL:', JSON.stringify(r.data, null, 2).slice(0, 3000));
    }
  } catch (e) {
    console.log('HTTP Error:', e.response?.status);
    console.log('Data:', JSON.stringify(e.response?.data)?.slice(0, 2000));
  }
})().catch(e => console.error('Fatal:', e.message));
