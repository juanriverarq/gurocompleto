const axios = require('axios');

const COOKIES = 'session_id=df0996eec969b39952108ea89cd9306c20030dbc; frontend_lang=es_CO; avs_version=13';
const BASE = 'https://ch.co.agentemotor.com';

async function odooRpc(model, method, domain = [], fields = null, limit = 50) {
  const kwargs = { limit };
  if (fields) kwargs.fields = fields;
  const { data } = await axios.post(`${BASE}/web/dataset/call_kw`, {
    jsonrpc: '2.0', method: 'call', id: 1,
    params: { model, method, args: [domain], kwargs },
  }, { headers: { 'Content-Type': 'application/json', Cookie: COOKIES } });
  return data.result;
}

(async () => {
  // 1. Get SURA connections
  console.log('=== SURA CONNECTIONS ===');
  const conns = await odooRpc('connections', 'search_read',
    [['connection_internal_name', 'ilike', 'sura']],
    null, 10
  );
  for (const c of conns || []) {
    console.log(`\nID: ${c.id} | ${c.connection_internal_name} | ${c.connection_name}`);
    console.log(`  active=${c.active}, mode=${c.con_mode}, type=${c.integration_type}`);
    console.log(`  connection_id=${c.connection_id}`);
    console.log(`  FULL RECORD:`, JSON.stringify(c, null, 2).slice(0, 3000));
  }

  // 2. Get agm.create.offer for SURA to see the exact payload structure
  console.log('\n=== RECENT SURA OFFERS ===');
  const offers = await odooRpc('agm.create.offer', 'search_read',
    [['insurer_name', 'ilike', 'sura']],
    ['insurer_name', 'insurer_interface', 'state', 'risk_in', 'response_data', 'create_date', 'broker_insurers_data'],
    3
  );
  for (const o of offers || []) {
    console.log(`\nOffer ID: ${o.id} | ${o.insurer_name} | ${o.insurer_interface} | ${o.state} | ${o.create_date}`);
    if (o.risk_in) console.log('  risk_in:', JSON.stringify(JSON.parse(o.risk_in || '{}'), null, 2).slice(0, 2000));
    if (o.broker_insurers_data) console.log('  broker_data:', JSON.stringify(JSON.parse(o.broker_insurers_data || '{}'), null, 2).slice(0, 1000));
    if (o.response_data) console.log('  response:', JSON.stringify(JSON.parse(o.response_data || '{}'), null, 2).slice(0, 2000));
  }

  // 3. Get company/broker info
  console.log('\n=== COMPANY/BROKER INFO ===');
  const companies = await odooRpc('res.company', 'search_read', [], ['name', 'vat', 'partner_id'], 5);
  for (const c of companies || []) {
    console.log(`  Company: ${c.name} (${c.vat}) partner_id=${JSON.stringify(c.partner_id)}`);
  }

  // 4. Sales teams
  console.log('\n=== SALES TEAMS ===');
  const teams = await odooRpc('crm.team', 'search_read', [], ['name', 'id'], 10);
  for (const t of teams || []) {
    console.log(`  Team: ${t.id} - ${t.name}`);
  }
})().catch(e => console.error('Error:', e.response?.data || e.message));
