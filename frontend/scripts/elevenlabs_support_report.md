# ElevenLabs Support Report: "Missing required dynamic variables in first message" Error

## Issue Summary
We are experiencing an error when making outbound phone calls using the ElevenLabs Conversational AI API with Twilio integration. The error message we receive is:

```
"Missing required dynamic variables in first message: {'customer_name'}"
```

## Technical Details

### Endpoint Used
```
POST https://api.elevenlabs.io/v1/convai/twilio/outbound-call
```

### Request Headers
```json
{
  "Content-Type": "application/json",
  "xi-api-key": "sk_06bf990afaf79a11677ac77a93d58d3abbdc6e254f776c7e"
}
```

### Request Body Structure
```json
{
  "agent_id": "agent_4KT1TAjbm5KHqIdE7MKr",
  "agent_phone_number_id": "phnum_01k0avytwkfgesvwxb5bdbp7qy",
  "to_number": "+573001234567",
  "dynamic_variables": {
    "customer_name": "Juan Pérez",
    "companyName": "Seguros XYZ",
    "policyNumber": "POL-12345",
    "policyExpirationDate": "2024-12-31",
    "monthlyPayment": "85000",
    "debt_amount": "170000",
    "payment_due_date": "2024-01-15",
    "city": "Bogotá",
    "phone_number": "+573001234567",
    "campaign_name": "Cobranza Enero 2024",
    "agent_name": "Sofia"
  },
  "customer_data": {
    "name": "Juan Pérez",
    "phone": "+573001234567",
    "policy": "POL-12345",
    "debt": 170000
  }
}
```

### Agent Configuration
Our conversational agent has the following `first_message` configuration:

```
"Hola {{customer_name}}, soy Sofia de {{companyName}}. Te llamo porque tenemos registrado un pago pendiente de tu póliza {{policyNumber}} por valor de ${{debt_amount}} pesos. ¿Podrías confirmarme si ya realizaste este pago?"
```

## Problem Description

1. **Dynamic Variables Present**: As you can see in the request body, we are explicitly sending `customer_name` in the `dynamic_variables` object.

2. **First Message Template**: Our agent's first message template includes the `{{customer_name}}` placeholder.

3. **Error Occurs**: Despite both conditions being met, we receive the error about missing `customer_name`.

## What We've Tried

1. ✅ **Verified dynamic_variables format**: Using camelCase `customer_name` as documented
2. ✅ **Ensured customer_name is always present**: We have fallback logic to guarantee this field exists
3. ✅ **Tested different variable combinations**: Added multiple variables that might be needed
4. ✅ **Verified agent configuration**: The first_message template uses `{{customer_name}}` syntax
5. ✅ **Used correct endpoint**: `/convai/twilio/outbound-call` as per documentation

## Questions for Support

1. **Dynamic Variables Format**: Is there a specific format or additional field required for dynamic variables in outbound calls?

2. **Agent Configuration**: Does the agent's `first_message` need to be configured differently when using the API vs. the web interface?

3. **Required Fields**: Are there additional required fields in the request body that we might be missing?

4. **Variable Scope**: Should dynamic variables be nested under a different object or at a different level in the JSON?

## Expected Behavior
The call should be initiated successfully with the dynamic variables being properly substituted in the agent's first message.

## Actual Behavior  
The API returns an error indicating that `customer_name` is missing from the first message, even though it's explicitly provided in the `dynamic_variables` object.

## Additional Context

- **Use Case**: Insurance company debt collection calls
- **Call Volume**: Batch processing of 50-200 calls per campaign
- **Integration**: Node.js/TypeScript application with React frontend
- **Phone Numbers**: Colombian phone numbers (+57 country code)

## Request for Assistance

Could you please help us understand:
1. The correct format for sending dynamic variables with outbound calls
2. Any specific requirements for agent configuration when using dynamic variables
3. If there are any known issues with the current API version

We would greatly appreciate your guidance on resolving this issue so we can proceed with our implementation.

Thank you for your support!

---

**Contact Information:**
- Technical Contact: [Your Email]
- Company: [Your Company Name]
- Integration Type: Twilio Outbound Calls via ElevenLabs API
- Priority: High (blocking production deployment)
