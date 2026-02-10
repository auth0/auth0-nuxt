# Kitchen Sink API

A simple Fastify API protected by Auth0 using `@auth0/auth0-fastify-api`.

## Setup

This API is typically started automatically by the main kitchen-sink app via `npm run dev` from the parent directory.

If you want to run it standalone:

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `AUTH0_DOMAIN`: Your Auth0 tenant domain (e.g., `your-tenant.auth0.com`)
- `AUTH0_AUDIENCE`: The API identifier/audience (e.g., `https://api.example.com`)
- `API_PORT`: Port to run the API on (default: `3001`)
- `APP_BASE_URL`: The Nuxt app URL for CORS (default: `http://localhost:3000`)

## Running Standalone

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## Running with Main App

From the parent `kitchen-sink` directory:
```bash
npm run dev
```

This will start both the API and Nuxt app concurrently.

## Endpoints

### `GET /api/team`
**Protected endpoint** - Returns team members data. Requires a valid access token with the configured audience.

### `GET /health`
**Public endpoint** - Health check endpoint.

## Testing

You can test the protected endpoint with curl:

```bash
# Get an access token from your Nuxt app's /api/token endpoint first
TOKEN="your-access-token"

curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/team
```
