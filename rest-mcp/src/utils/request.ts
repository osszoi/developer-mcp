import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';

export interface RequestOptions {
  url: string;
  method: Method;
  withoutAuthorization?: boolean;
  headers?: Record<string, string>;
  contentType?: string;
  body?: any;
  queryParams?: Record<string, any>;
}

export interface RequestResult {
  data: any;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export async function makeRequest(options: RequestOptions, authToken?: string): Promise<RequestResult> {
  console.error(`[Request] ${options.method} ${options.url}`);
  
  const headers: Record<string, string> = { ...options.headers };
  
  // Only set Content-Type for methods that have a body
  if (['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase())) {
    headers['Content-Type'] = options.contentType || 'application/json';
  }
  
  const config: AxiosRequestConfig = {
    url: options.url,
    method: options.method,
    headers,
    params: options.queryParams,
    validateStatus: () => true, // Accept all status codes
  };

  // Add authorization header if token exists and not explicitly disabled
  if (authToken && !options.withoutAuthorization) {
    // Check if token already includes "Bearer " prefix
    if (authToken.toLowerCase().startsWith('bearer ')) {
      headers['Authorization'] = authToken;
    } else {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
  }
  
  // Update config headers
  config.headers = headers;

  // Add body for methods that support it
  if (['POST', 'PUT', 'PATCH'].includes(options.method.toUpperCase()) && options.body) {
    config.data = options.body;
  }

  try {
    const response: AxiosResponse = await axios(config);
    
    // Convert headers to plain object
    const headers: Record<string, string> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (typeof value === 'string') {
        headers[key] = value;
      }
    });

    console.error(`[Response] Status: ${response.status} ${response.statusText}`);
    
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers,
    };
  } catch (error: any) {
    console.error(`[Request Error]`, error.message);
    
    // Even network errors should return a structured response
    if (error.response) {
      const headers: Record<string, string> = {};
      Object.entries(error.response.headers || {}).forEach(([key, value]) => {
        if (typeof value === 'string') {
          headers[key] = value;
        }
      });

      console.error(`[Error Response] Status: ${error.response.status} ${error.response.statusText}`);
      
      return {
        data: error.response.data,
        status: error.response.status,
        statusText: error.response.statusText,
        headers,
      };
    }
    
    // Network error or other issue
    console.error(`[Network Error] ${error.message}`);
    throw new Error(`Request failed: ${error.message}`);
  }
}