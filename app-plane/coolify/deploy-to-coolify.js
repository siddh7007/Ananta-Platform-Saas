const fs = require('fs');
const path = require('path');

const COOLIFY_BASE_URL = 'http://172.25.76.67:8000';
const COOLIFY_ACCESS_TOKEN = '1|GnE24NL8I1rQ3wnf48vq2czwTl38VHvF1AVwVVli2a200755';
const PROJECT_UUID = 'pg04008c4o8c84cowcccskg4';
const SERVER_UUID = 'yocso88gkwgswkokscggc40c';

async function deployDockerCompose() {
  // Read the docker-compose file
  const composePath = path.join(__dirname, 'docker-compose.core-databases.yml');
  const dockerComposeRaw = fs.readFileSync(composePath, 'utf8');

  console.log('Deploying docker-compose to Coolify...');
  console.log('Project UUID:', PROJECT_UUID);
  console.log('Server UUID:', SERVER_UUID);
  console.log('Compose file length:', dockerComposeRaw.length, 'chars');

  // Base64 encode the docker-compose content
  const dockerComposeBase64 = Buffer.from(dockerComposeRaw).toString('base64');
  console.log('Base64 encoded length:', dockerComposeBase64.length, 'chars');

  const payload = {
    name: 'Ananta Core Databases',
    description: 'Core infrastructure: PostgreSQL, Redis, RabbitMQ, Temporal',
    project_uuid: PROJECT_UUID,
    server_uuid: SERVER_UUID,
    environment_name: 'production',
    docker_compose_raw: dockerComposeBase64,
    instant_deploy: false // Don't deploy immediately, let us configure first
  };

  try {
    const response = await fetch(`${COOLIFY_BASE_URL}/api/v1/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${COOLIFY_ACCESS_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Error response:', response.status, response.statusText);
      console.error('Error details:', JSON.stringify(data, null, 2));
      return null;
    }

    console.log('Success! Service created:');
    console.log(JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Request failed:', error.message);
    return null;
  }
}

deployDockerCompose();
