const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Please enter a valid email address' }) };
  }

  const apiKey = process.env.KIT_API_KEY;
  const formId = process.env.KIT_FORM_ID;
  if (!apiKey || !formId) {
    console.error('subscribe: KIT_API_KEY / KIT_FORM_ID not configured');
    return { statusCode: 502, body: JSON.stringify({ error: 'Subscription failed — please try again.' }) };
  }

  // Step 1: Create/upsert the subscriber, get back their ID
  const createRes = await fetch('https://api.kit.com/v4/subscribers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Kit-Api-Key': apiKey },
    body: JSON.stringify({ email_address: email }),
  });

  if (!createRes.ok) {
    console.error('subscribe: Kit create failed', createRes.status, await createRes.text());
    return { statusCode: 502, body: JSON.stringify({ error: 'Subscription failed — please try again.' }) };
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
    console.error('subscribe: Kit form add failed', addRes.status, await addRes.text());
    return { statusCode: 502, body: JSON.stringify({ error: 'Subscription failed — please try again.' }) };
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
