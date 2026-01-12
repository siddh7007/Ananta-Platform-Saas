// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {SubscriptionServiceApplication} from './application';
import {ApplicationConfig} from '@loopback/core';
import * as dotenv from 'dotenv';
import * as dotenvExt from 'dotenv-extended';

export * from './application';
export * from './component';

export async function main(options: ApplicationConfig = {}) {
  // Load environment variables
  dotenv.config();
  dotenvExt.load({
    schema: '.env.example',
    defaults: '.env.defaults',
    errorOnMissing: false,
    includeProcessEnv: true,
  });

  const app = new SubscriptionServiceApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Subscription Service is running at ${url}`);
  console.log(`Try ${url}/ping`);
  console.log(`OpenAPI spec: ${url}/openapi.json`);
  console.log(`API Explorer: ${url}/explorer`);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 3002),
      host: process.env.HOST ?? '0.0.0.0',
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        setServersFromRequest: true,
      },
      cors: {
        origin: '*',
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        preflightContinue: false,
        optionsSuccessStatus: 204,
        credentials: true,
      },
    },
  };
  main(config).catch(err => {
    console.error('Cannot start the Subscription Service.', err);
    process.exit(1);
  });
}
