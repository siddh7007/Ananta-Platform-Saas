const fs = require('fs');
const path = require('path');

const COOLIFY_BASE_URL = 'http://172.25.76.67:8000';
const COOLIFY_ACCESS_TOKEN = '1|GnE24NL8I1rQ3wnf48vq2czwTl38VHvF1AVwVVli2a200755';
const SERVICE_UUID = 'e448o8og40w80k804ccoc84g';

async function updateCoolifyService() {
  // Read the docker-compose file
  const composePath = path.join(__dirname, 'docker-compose.core-databases.yml');
  const dockerComposeRaw = fs.readFileSync(composePath, 'utf8');

  console.log('Updating Coolify service with fixed compose file...');
  console.log('Service UUID:', SERVICE_UUID);
  console.log('Compose file length:', dockerComposeRaw.length, 'chars');

  // Show key changes
  console.log('\nKey fixes in this update:');
  console.log('  - temporal-postgresql: Added POSTGRES_HOST_AUTH_METHOD: trust');
  console.log('  - temporal-ui: Changed to version 2.21.3 (from 2.26.2)');

  // Base64 encode the docker-compose content (required by Coolify API)
  const dockerComposeBase64 = Buffer.from(dockerComposeRaw).toString('base64');
  console.log('Base64 encoded length:', dockerComposeBase64.length, 'chars');

  const payload = {
    docker_compose_raw: dockerComposeBase64
  };

  try {
    const response = await fetch(`${COOLIFY_BASE_URL}/api/v1/services/${SERVICE_UUID}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COOLIFY_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('\nError response:', response.status, response.statusText);
      console.error('Error details:', JSON.stringify(data, null, 2));
      return null;
    }

    console.log('\nSuccess! Service updated.');
    console.log('Response:', JSON.stringify(data, null, 2));

    // Trigger a deploy
    console.log('\nTriggering service restart...');
    const restartResponse = await fetch(`${COOLIFY_BASE_URL}/api/v1/services/${SERVICE_UUID}/restart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COOLIFY_ACCESS_TOKEN}`
      }
    });

    if (restartResponse.ok) {
      console.log('Service restart triggered successfully!');
    } else {
      const restartData = await restartResponse.json();
      console.log('Restart response:', restartResponse.status, JSON.stringify(restartData, null, 2));
    }

    return data;
  } catch (error) {
    console.error('Request failed:', error.message);
    return null;
  }
}

updateCoolifyService();
