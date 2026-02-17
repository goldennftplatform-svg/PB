# Poof PartyServer API

Type-safe HTTP API for real-time applications

**Version:** 1.0.0  
**Generated:** 2026-02-04T16:02:43.081Z

## 🔐 Authentication

**Available Strategies:** public, jwt, tarobase  
**Default:** public

## 📊 Standard Status Codes

All endpoints use these standardized status codes:

- **200** (SUCCESS): All successful responses
- **400** (BAD_REQUEST): Client errors (validation, invalid input)
- **401** (UNAUTHORIZED): Authentication/authorization errors
- **404** (NOT_FOUND): Resource not found
- **500** (INTERNAL_ERROR): Server errors (uncaught exceptions)

## 🌐 HTTP Endpoints

### GET /health

Retrieves comprehensive system health information including service status, uptime, and connectivity to external services like Tarobase. Use this endpoint to monitor system availability and diagnose potential issues before they affect users.

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/health` |
| **Public** | ✅ Yes |
| **Authentication** | None |
| **Tags** | system, monitoring |
| **Secrets** | None |
| **Status Codes** | 200, 500 |
| **Rate Limit** | 100 requests per 60s |

**Response Schema:**
```typescript
export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.number(),
  version: z.string(),
  uptime: z.number(),
  services: z.object({
    tarobase: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      latency: z.number().optional(),
    })
```

---

