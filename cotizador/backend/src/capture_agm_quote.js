const axios = require('axios');

// Capturar el flujo COMPLETO de cotización de AGM
// Para ver exactamente qué payload envía al orquestador

const TENANT = 'ch.co.agentemotor.com';
const ODOO_COOKIES = 'session_id=df0996eec969b39952108ea89cd9306c20030dbc; frontend_lang=es_CO; avs_version=13';

async function odooRpc(model, method, domain, fields, limit) {
  const kwargs = { limit: limit || 50 };
  if (fields) kwargs.fields = fields;
  const { data } = await axios.post(`https://${TENANT}/web/dataset/call_kw`, {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { model, method, args: [domain || []], kwargs },
  }, { headers: { 'Content-Type': 'application/json', Cookie: ODOO_COOKIES } });
  return data.result;
}

async function odooCall(model, method, args, kwargs) {
  const { data } = await axios.post(`https://${TENANT}/web/dataset/call_kw`, {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { model, method, args: args || [], kwargs: kwargs || {} },
  }, { headers: { 'Content-Type': 'application/json', Cookie: ODOO_COOKIES } });
  return data;
}

(async () => {
  // STRATEGY 1: Look at existing agm.create.offer records to see the EXACT structure
  // that was used for ANY successful quote (not just SURA)
  console.log('=== STRATEGY 1: Find ANY successful offer to see payload structure ===');
  
  const offers = await odooRpc('agm.create.offer', 'search_read',
    [['state', 'not in', ['error', 'expired']]],
    ['insurer_name', 'insurer_interface', 'state', 'create_date'],
    5
  );
  console.log(`Found ${(offers || []).length} non-error offers`);
  for (const o of offers || []) {
    console.log(`  ${o.id}: ${o.insurer_name} (${o.insurer_interface}) - ${o.state} - ${o.create_date}`);
  }

  // Get ALL offers, any state
  console.log('\n=== ALL offers (last 10) ===');
  const allOffers = await odooRpc('agm.create.offer', 'search_read',
    [],
    ['insurer_name', 'insurer_interface', 'state', 'create_date', 'response_data', 'risk_in', 'broker_insurers_data'],
    10
  );
  console.log(`Found ${(allOffers || []).length} total offers`);
  for (const o of allOffers || []) {
    console.log(`\n  ID ${o.id}: ${o.insurer_name} (${o.insurer_interface}) - ${o.state} - ${o.create_date}`);
    if (o.broker_insurers_data && o.broker_insurers_data !== 'false') {
      try {
        console.log('  BROKER DATA:', o.broker_insurers_data.slice(0, 500));
      } catch(e) {}
    }
    if (o.risk_in && o.risk_in !== 'false') {
      try {
        console.log('  RISK_IN:', o.risk_in.slice(0, 500));
      } catch(e) {}
    }
    if (o.response_data && o.response_data !== 'false') {
      try {
        console.log('  RESPONSE:', o.response_data.slice(0, 500));
      } catch(e) {}
    }
  }

  // STRATEGY 2: Look at agm.create.offer fields to understand the full model
  console.log('\n=== agm.create.offer fields ===');
  const offerFields = await odooRpc('ir.model.fields', 'search_read',
    [['model', '=', 'agm.create.offer']],
    ['name', 'field_description', 'ttype'],
    100
  );
  const importantFields = (offerFields || []).filter(f => 
    !f.name.startsWith('__') && 
    !['create_date','create_uid','write_date','write_uid','display_name','id'].includes(f.name)
  );
  for (const f of importantFields) {
    console.log(`  ${f.name} (${f.ttype}): ${f.field_description}`);
  }

  // STRATEGY 3: Try to create an offer via Odoo API (this is what the frontend does)
  console.log('\n=== STRATEGY 3: Create offer via Odoo ===');
  // The frontend likely calls a controller or creates an offer record that triggers the Lambda
  // Let's check available controllers
  const routes = await odooRpc('ir.model', 'search_read',
    [['model', 'ilike', 'agm']],
    ['model', 'name'],
    50
  );
  for (const r of routes || []) {
    console.log(`  ${r.model}: ${r.name}`);
  }

})().catch(e => {
  console.error('Error:', e.response?.data?.error?.data?.message || e.response?.data || e.message);
});
