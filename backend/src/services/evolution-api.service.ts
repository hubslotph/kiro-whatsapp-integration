import axios, { AxiosInstance } from 'axios';

interface EvolutionAPIConfig {
  baseURL: string;
  apiKey: string;
  instanceName: string;
}

interface SendMessagePayload {
  number: string;
  text: string;
}

interface InstanceInfo {
  instance: {
    instanceName: string;
    status: string;
  };
}

export class EvolutionAPIService {
  private client: AxiosInstance;
  private instanceName: string;

  constructor(config: EvolutionAPIConfig) {
    this.instanceName = config.instanceName;
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'apikey': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Create a new WhatsApp instance
   */
  async createInstance(): Promise<any> {
    try {
      const response = await this.client.post('/instance/create', {
        instanceName: this.instanceName,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
      });
      return response.data;
    } catch (error: any) {
      console.error('Error creating instance:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get QR code for WhatsApp connection
   */
  async getQRCode(): Promise<any> {
    try {
      const response = await this.client.get(`/instance/connect/${this.instanceName}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting QR code:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get instance connection status
   */
  async getInstanceStatus(): Promise<InstanceInfo> {
    try {
      const response = await this.client.get(`/instance/connectionState/${this.instanceName}`);
      return response.data;
    } catch (error: any) {
      console.error('Error getting instance status:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Send text message
   */
  async sendTextMessage(payload: SendMessagePayload): Promise<any> {
    try {
      const response = await this.client.post(
        `/message/sendText/${this.instanceName}`,
        {
          number: payload.number,
          text: payload.text,
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Check if instance exists
   */
  async instanceExists(): Promise<boolean> {
    try {
      await this.getInstanceStatus();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize instance (create if doesn't exist)
   */
  async initialize(): Promise<void> {
    const exists = await this.instanceExists();
    if (!exists) {
      console.log('Creating new Evolution API instance...');
      await this.createInstance();
      console.log('Instance created. Please scan QR code.');
    } else {
      console.log('Evolution API instance already exists.');
    }
  }
}

// Export singleton instance
const evolutionAPIService = new EvolutionAPIService({
  baseURL: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
  apiKey: process.env.EVOLUTION_API_KEY || '',
  instanceName: process.env.EVOLUTION_INSTANCE_NAME || 'kiro-whatsapp',
});

export default evolutionAPIService;
