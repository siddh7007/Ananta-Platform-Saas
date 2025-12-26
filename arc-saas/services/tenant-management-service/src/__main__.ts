// Copyright (c) 2023 Sourcefuse Technologies
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {TenantMgmtServiceApplication} from './application';
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

  const app = new TenantMgmtServiceApplication(options);
  await app.boot();
  await app.start();

  const url = app.restServer.url;
  console.log(`Server is running at ${url}`);
  console.log(`Try ${url}/ping`);
  console.log(`OpenAPI spec: ${url}/openapi.json`);
  console.log(`API Explorer: ${url}/explorer`);

  return app;
}

if (require.main === module) {
  // Run the application
  const config = {
    rest: {
      port: +(process.env.PORT ?? 4300),
      // Don't specify host - let Node pick available interface
      gracePeriodForClose: 5000, // 5 seconds
      openApiSpec: {
        // useful when used with OpenAPI-to-GraphQL to locate your application
        setServersFromRequest: true,
      },
      // Use the LB4 cors settings
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
    console.error('Cannot start the application.', err);
    process.exit(1);
  });
}
