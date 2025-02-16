export interface ServiceResponse {
  success: boolean;
  message: string | string[];
  data?: any;
  error?: any;
  metadata?: any;
  statusCode?: number;
}
