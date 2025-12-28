# aidb

A template for creating general-purpose Postgres/Express backend APIs, but works very nicely with [@voscarmv/aichatbot](https://npmjs.com/@voscarmv/aichatbot) projects.

## Installation and usage

```bash
npm install
npm run build
npm run db:generate
npx dbinstall
npx migrate --dburl postgres://yourusername:yourpassword@yourhost/yourdbname
npm run start
```

This should run to server you define in `server.ts`. See [@voscarmv/apigen](https://npmjs.com/@voscarmv/apigen) for more configuration options.