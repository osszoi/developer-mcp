# REST MCP

A Model Context Protocol (MCP) server that provides tools for making REST API requests.

## Features

- **HTTP Methods**: Support for GET, POST, PUT, PATCH, and DELETE requests
- **Authentication**: Automatic Bearer token authentication via environment variable
- **Headers**: Custom header support with default Content-Type of application/json
- **Query Parameters**: Support for URL query parameters
- **Response Details**: Returns response body, status code, status text, and headers

## Installation

```bash
npm install
npm run build
```

## Configuration

Add to your MCP client configuration:

```json
{
  "rest-mcp": {
    "command": "node",
    "args": ["/path/to/rest-mcp/dist/index.js"],
    "env": {
      "REST_API_AUTH_TOKEN": "your-api-token-here"
    }
  }
}
```

## Available Tools

### rest_get
Make a GET request to an API endpoint

**Parameters:**
- `url` (string, required): The URL to send the GET request to
- `headers` (object, optional): Additional headers to include
- `withoutAuthorization` (boolean, optional): Skip authorization header
- `queryParams` (object, optional): Query parameters to append to URL

### rest_post
Make a POST request to an API endpoint

**Parameters:**
- `url` (string, required): The URL to send the POST request to
- `body` (any, optional): The request body (will be JSON stringified)
- `headers` (object, optional): Additional headers to include
- `withoutAuthorization` (boolean, optional): Skip authorization header
- `contentType` (string, optional): Content-Type header (default: application/json)
- `queryParams` (object, optional): Query parameters to append to URL

### rest_put
Make a PUT request to an API endpoint

**Parameters:**
- `url` (string, required): The URL to send the PUT request to
- `body` (any, optional): The request body (will be JSON stringified)
- `headers` (object, optional): Additional headers to include
- `withoutAuthorization` (boolean, optional): Skip authorization header
- `contentType` (string, optional): Content-Type header (default: application/json)
- `queryParams` (object, optional): Query parameters to append to URL

### rest_patch
Make a PATCH request to an API endpoint

**Parameters:**
- `url` (string, required): The URL to send the PATCH request to
- `body` (any, optional): The request body (will be JSON stringified)
- `headers` (object, optional): Additional headers to include
- `withoutAuthorization` (boolean, optional): Skip authorization header
- `contentType` (string, optional): Content-Type header (default: application/json)
- `queryParams` (object, optional): Query parameters to append to URL

### rest_delete
Make a DELETE request to an API endpoint

**Parameters:**
- `url` (string, required): The URL to send the DELETE request to
- `headers` (object, optional): Additional headers to include
- `withoutAuthorization` (boolean, optional): Skip authorization header
- `queryParams` (object, optional): Query parameters to append to URL

## Usage Example

```typescript
// Make a GET request with authentication
const result = await rest_get({
  url: "https://api.example.com/users"
});

// Make a POST request without authentication
const result = await rest_post({
  url: "https://api.example.com/login",
  body: { username: "user", password: "pass" },
  withoutAuthorization: true
});

// Make a request with custom headers
const result = await rest_get({
  url: "https://api.example.com/data",
  headers: {
    "X-Custom-Header": "value"
  }
});
```

## Environment Variables

- `REST_API_AUTH_TOKEN`: Bearer token for API authentication (optional)