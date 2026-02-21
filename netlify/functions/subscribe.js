exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let email;
  try {
    ({ email } = JSON.parse(event.body));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email is required' }) };
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;

  // Step 1: Create/upsert the subscriber, get back their ID
  const createRes = await fetch('https://api.kit.com/v4/subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey },
    body: JSON.stringify({ email_address: email }),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    return { statusCode: createRes.status, body };
  }

  const { subscriber } = await createRes.json();

  // Step 2: Add that subscriber to the waitlist form
  const addRes = await fetch(
    `https://api.kit.com/v4/forms/${formId}/subscribers/${subscriber.id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey },
      body: JSON.stringify({ referrer: 'https://gripply.app' }),
    }
  );

  if (!addRes.ok) {
    const body = await addRes.text();
    return { statusCode: addRes.status, body };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
